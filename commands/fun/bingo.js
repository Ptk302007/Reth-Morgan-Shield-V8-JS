'use strict';
// ============================================================
//  RETH MORGAN — BINGO
//  ✅ Cartela 5x5 com números únicos (1-75 estilo bingo real)
//  ✅ Sorteio automático a cada 9s
//  ✅ Modos de vitória: linha, coluna, diagonal, full house
//  ✅ Aposta de coins — prêmio varia conforme dificuldade
//  ✅ Até 4 jogadores simultâneos por partida pública
//  ✅ Marcação automática dos números na cartela
//  FIX: renderCartela não usava mais bold dentro de bloco de código
//  FIX: iniciarPartida movida para escopo do módulo (sem closure bug)
//  FIX: collector de entrada protegido contra cliques simultâneos
//  FIX: limpeza de PARTIDAS_MAP garantida em todos os caminhos
// ============================================================
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const bonus = require('../../lib/bonus');

const COOLDOWNS         = new Map();
const CD_MS             = 30_000;
const INTERVALO_SORTEIO = 9_000;
const MAX_PLAYERS       = 4;
const TOTAL_NUMS        = 75;
const TAMANHO           = 5;

const PREMIOS = {
    linha:    1.5,
    coluna:   1.5,
    diagonal: 2.0,
    fullhouse: 5.0,
};

// ── Partidas ativas ───────────────────────────────────────────────────────────
const PARTIDAS = new Map(); // guildId → partida

// ── Gera cartela 5x5 ──────────────────────────────────────────────────────────
function gerarCartela() {
    const grid = [];
    for (let l = 0; l < TAMANHO; l++) grid.push([]);

    for (let col = 0; col < TAMANHO; col++) {
        const min  = col * 15 + 1;
        const pool = [];
        while (pool.length < TAMANHO) {
            const n = Math.floor(Math.random() * 15) + min;
            if (!pool.includes(n)) pool.push(n);
        }
        for (let l = 0; l < TAMANHO; l++) grid[l][col] = pool[l];
    }

    grid[2][2] = 'FREE';
    return grid;
}

// ── Verifica vitória ──────────────────────────────────────────────────────────
function checarVitoria(grid, marcados) {
    const m = (l, c) => grid[l][c] === 'FREE' || marcados.has(grid[l][c]);

    for (let l = 0; l < TAMANHO; l++)
        if ([0,1,2,3,4].every(c => m(l, c))) return 'linha';

    for (let c = 0; c < TAMANHO; c++)
        if ([0,1,2,3,4].every(l => m(l, c))) return 'coluna';

    if ([0,1,2,3,4].every(i => m(i, i))) return 'diagonal';
    if ([0,1,2,3,4].every(i => m(i, 4 - i))) return 'diagonal';

    if (grid.flat().every(n => n === 'FREE' || marcados.has(n))) return 'fullhouse';

    return null;
}

// ── Renderiza cartela em texto ────────────────────────────────────────────────
// FIX: usa emojis para marcados em vez de bold (bold não funciona dentro de ```)
function renderCartela(grid, marcados) {
    const COLS = ['B', 'I', 'N', 'G', 'O'];
    const linhas = [COLS.join('   ')];

    for (let l = 0; l < TAMANHO; l++) {
        const linha = grid[l].map(n => {
            if (n === 'FREE') return '✨ ';
            const str = String(n).padStart(2, ' ');
            return marcados.has(n) ? `✅` : str;
        }).join(' ');
        linhas.push(linha);
    }

    return '```\n' + linhas.join('\n') + '\n```';
}

// ── Embed da cartela ──────────────────────────────────────────────────────────
function embedCartela(player, grid, marcados, sorteados, ultimo, aposta) {
    const vitoria = checarVitoria(grid, marcados);
    return new EmbedBuilder()
        .setColor(vitoria ? '#f1c40f' : '#3498db')
        .setTitle(vitoria ? `🎉 BINGO! ${vitoria.toUpperCase()}!` : '🎰 BINGO — Sua Cartela')
        .setAuthor({ name: player.username, iconURL: player.displayAvatarURL({ dynamic: true }) })
        .addFields(
            { name: 'B    I    N    G    O', value: renderCartela(grid, marcados), inline: false },
            { name: '🔢 Último Sorteado',   value: ultimo ? `**${ultimo}**` : '`Aguardando...`', inline: true },
            { name: '📊 Sorteados',         value: `\`${sorteados.length}/75\``,                  inline: true },
            { name: '💰 Aposta',            value: `\`${aposta} 🪙\``,                            inline: true },
        )
        .setFooter({ text: vitoria ? `Prêmio: ×${PREMIOS[vitoria]}` : 'Marcação automática · Seja o primeiro!' });
}

// ── Embed sala de espera ──────────────────────────────────────────────────────
function embedEspera(players, aposta, tempoRestante) {
    return new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('🎰 BINGO — Sala de Espera')
        .setDescription(
            `**${players.length}/${MAX_PLAYERS}** jogadores prontos.\n` +
            `O jogo começa em **${tempoRestante}s** ou quando a sala lotar.\n\n` +
            players.map((p, i) => `${i + 1}. ${p.username}`).join('\n')
        )
        .addFields(
            { name: '💰 Aposta por jogador', value: `\`${aposta} 🪙\``,                                         inline: true },
            { name: '🏆 Prêmios',            value: 'Linha/Coluna: ×1.5\nDiagonal: ×2.0\nFull House: ×5.0', inline: true },
        )
        .setFooter({ text: 'Clique em Entrar para participar!' });
}

// ── Inicia a partida ──────────────────────────────────────────────────────────
// FIX: movida para escopo do módulo para evitar problemas de closure
async function iniciarPartida(partida, channel, guildId) {
    partida.fase = 'jogando';
    await partida.msgEspera.edit({ components: [] }).catch(() => {});

    const pool = [];
    for (let i = 1; i <= TOTAL_NUMS; i++) pool.push(i);
    pool.sort(() => Math.random() - 0.5);

    await channel.send({
        embeds: [new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🎰 BINGO COMEÇOU!')
            .setDescription(
                partida.jogadores.map(p => `🎫 ${p.username}`).join('\n') + '\n\n' +
                '**Números serão sorteados a cada 9 segundos!**\n' +
                'A marcação é **automática** na sua cartela.\n\n' +
                '🏆 **Premiação:**\nLinha/Coluna: ×1.5 · Diagonal: ×2.0 · Full House: ×5.0'
            )
        ],
    }).catch(() => {});

    // Envia cartelas
    const msgCartelas = new Map();
    for (const jogador of partida.jogadores) {
        const c = partida.cartelas.get(jogador.id);
        try {
            const dm = await jogador.createDM();
            const mm = await dm.send({
                embeds: [embedCartela(jogador, c.grid, c.marcados, [], null, partida.aposta)],
            });
            msgCartelas.set(jogador.id, mm);
        } catch {
            const mm = await channel.send({
                content: `${jogador} — sua cartela:`,
                embeds:  [embedCartela(jogador, c.grid, c.marcados, [], null, partida.aposta)],
            }).catch(() => null);
            if (mm) msgCartelas.set(jogador.id, mm);
        }
    }

    let poolIdx = 0;

    partida.intervalSorteio = setInterval(async () => {
        // Guarda de segurança
        if (partida.fase !== 'jogando') {
            clearInterval(partida.intervalSorteio);
            return;
        }

        if (poolIdx >= pool.length) {
            clearInterval(partida.intervalSorteio);
            PARTIDAS.delete(guildId);
            partida.fase = 'encerrado';

            await channel.send('❌ Todos os números foram sorteados sem vencedor. Apostas devolvidas.').catch(() => {});
            const d2 = bonus.ler();
            for (const j of partida.jogadores) {
                bonus.garantir(d2, guildId, j.id);
                d2[guildId][j.id].coins += partida.aposta;
            }
            require('fs').writeFileSync('./database/xp.json', JSON.stringify(d2, null, 2));
            return;
        }

        const num = pool[poolIdx++];
        partida.sorteados.push(num);

        const ultCinco = partida.sorteados.slice(-5).join(' · ');
        await channel.send({
            embeds: [new EmbedBuilder()
                .setColor('#f39c12')
                .setTitle(`🎲 Sorteado: **${num}**`)
                .setDescription(`Últimos: \`${ultCinco}\`\n📊 Total: \`${partida.sorteados.length}/75\``)
            ],
        }).catch(() => {});

        // Marca e checa vitória
        let vencedor = null;
        let tipoVit  = null;

        for (const jogador of partida.jogadores) {
            const c = partida.cartelas.get(jogador.id);
            c.marcados.add(num);

            const vit = checarVitoria(c.grid, c.marcados);
            if (vit && !vencedor) { vencedor = jogador; tipoVit = vit; }

            const mc = msgCartelas.get(jogador.id);
            if (mc) {
                mc.edit({
                    embeds: [embedCartela(jogador, c.grid, c.marcados, partida.sorteados, num, partida.aposta)],
                }).catch(() => {});
            }
        }

        if (vencedor) {
            clearInterval(partida.intervalSorteio);
            partida.fase = 'encerrado';
            PARTIDAS.delete(guildId);

            const mult   = PREMIOS[tipoVit];
            const premio = Math.floor(partida.aposta * partida.jogadores.length * mult);

            const d2 = bonus.ler();
            bonus.garantir(d2, guildId, vencedor.id);
            d2[guildId][vencedor.id].coins += premio;
            require('fs').writeFileSync('./database/xp.json', JSON.stringify(d2, null, 2));

            await channel.send({
                embeds: [new EmbedBuilder()
                    .setColor('#f1c40f')
                    .setTitle('🎉 BINGO!')
                    .setDescription(
                        `**${vencedor.username}** ganhou com **${tipoVit.toUpperCase()}**!\n\n` +
                        `🏆 Prêmio: \`${premio} 🪙\` (×${mult} · ${partida.jogadores.length} jogador${partida.jogadores.length > 1 ? 'es' : ''})`
                    )
                    .setThumbnail(vencedor.displayAvatarURL({ dynamic: true }))
                    .setTimestamp()
                ],
            }).catch(() => {});
        }
    }, INTERVALO_SORTEIO);
}

// ── Comando ───────────────────────────────────────────────────────────────────
module.exports = {
    name: 'bingo',
    aliases: ['bg', 'loteria'],

    execute: async (msg, args) => {
        const gid = msg.guild.id;
        const uid = msg.author.id;

        // ── Já tem partida ativa — tenta entrar ──────────────────────────────
        if (PARTIDAS.has(gid)) {
            const partida = PARTIDAS.get(gid);

            if (partida.fase !== 'espera')
                return msg.reply('❌ Já tem uma partida de Bingo em andamento. Aguarde terminar.');

            if (partida.jogadores.find(p => p.id === uid))
                return msg.reply('Você já está nessa partida!');

            if (partida.jogadores.length >= MAX_PLAYERS)
                return msg.reply('❌ Sala cheia!');

            const dados = bonus.ler();
            bonus.garantir(dados, gid, uid);
            if ((dados[gid][uid].coins ?? 0) < partida.aposta)
                return msg.reply(`❌ Você precisa de \`${partida.aposta} 🪙\` para entrar.`);

            dados[gid][uid].coins -= partida.aposta;
            require('fs').writeFileSync('./database/xp.json', JSON.stringify(dados, null, 2));

            partida.jogadores.push(msg.author);
            partida.cartelas.set(uid, { grid: gerarCartela(), marcados: new Set() });

            await msg.reply(`✅ Você entrou no Bingo! Aposta: \`${partida.aposta} 🪙\`. Aguarde o início.`).catch(() => {});
            await partida.msgEspera.edit({
                embeds: [embedEspera(partida.jogadores, partida.aposta, '...')],
            }).catch(() => {});

            if (partida.jogadores.length >= MAX_PLAYERS) {
                clearTimeout(partida.timerEspera);
                iniciarPartida(partida, msg.channel, gid);
            }
            return;
        }

        // ── Criar nova partida ────────────────────────────────────────────────
        const agora = Date.now();
        if ((agora - (COOLDOWNS.get(uid) ?? 0)) < CD_MS) {
            const r = Math.ceil((CD_MS - (agora - COOLDOWNS.get(uid))) / 1000);
            return msg.reply(`⏰ Aguarde **${r}s** para criar uma nova partida.`);
        }

        const aposta = parseInt(args[0]) || 50;
        if (aposta < 10)
            return msg.reply('❌ Use: `r!bingo <aposta>`\nAposta mínima: **10 🪙**');

        const dados = bonus.ler();
        bonus.garantir(dados, gid, uid);
        if ((dados[gid][uid].coins ?? 0) < aposta)
            return msg.reply(`❌ Você não tem \`${aposta} 🪙\`!`);

        dados[gid][uid].coins -= aposta;
        require('fs').writeFileSync('./database/xp.json', JSON.stringify(dados, null, 2));
        COOLDOWNS.set(uid, agora);

        const partida = {
            fase:            'espera',
            aposta,
            jogadores:       [msg.author],
            cartelas:        new Map([[uid, { grid: gerarCartela(), marcados: new Set() }]]),
            sorteados:       [],
            msgEspera:       null,
            timerEspera:     null,
            intervalSorteio: null,
        };

        PARTIDAS.set(gid, partida);

        let countdown = 30;
        const rowEntrar = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('bingo_entrar')
                .setLabel('🎰 Entrar')
                .setStyle(ButtonStyle.Success),
        );

        partida.msgEspera = await msg.reply({
            embeds: [embedEspera(partida.jogadores, aposta, countdown)],
            components: [rowEntrar],
        });

        // Countdown visual
        const timerContagem = setInterval(async () => {
            countdown -= 5;
            if (countdown <= 0 || partida.fase !== 'espera') {
                clearInterval(timerContagem);
                return;
            }
            await partida.msgEspera.edit({
                embeds: [embedEspera(partida.jogadores, aposta, countdown)],
                components: [rowEntrar],
            }).catch(() => {});
        }, 5_000);

        // FIX: flag para evitar race condition em cliques simultâneos
        let entrando = false;

        const colEspera = partida.msgEspera.createMessageComponentCollector({
            filter: i => i.customId === 'bingo_entrar',
            time: 35_000,
        });

        colEspera.on('collect', async i => {
            const pidx = i.user.id;

            if (partida.fase !== 'espera')
                return i.reply({ content: '❌ O jogo já começou!', ephemeral: true }).catch(() => {});

            if (partida.jogadores.find(p => p.id === pidx))
                return i.reply({ content: '❌ Você já está na partida!', ephemeral: true }).catch(() => {});

            if (partida.jogadores.length >= MAX_PLAYERS)
                return i.reply({ content: '❌ Sala cheia!', ephemeral: true }).catch(() => {});

            // FIX: lock simples contra cliques simultâneos
            if (entrando) return i.deferUpdate().catch(() => {});
            entrando = true;

            try {
                const d2 = bonus.ler();
                bonus.garantir(d2, gid, pidx);
                if ((d2[gid][pidx].coins ?? 0) < aposta) {
                    entrando = false;
                    return i.reply({ content: `❌ Você precisa de \`${aposta} 🪙\`.`, ephemeral: true }).catch(() => {});
                }

                d2[gid][pidx].coins -= aposta;
                require('fs').writeFileSync('./database/xp.json', JSON.stringify(d2, null, 2));

                partida.jogadores.push(i.user);
                partida.cartelas.set(pidx, { grid: gerarCartela(), marcados: new Set() });

                await i.update({
                    embeds: [embedEspera(partida.jogadores, aposta, countdown)],
                    components: [rowEntrar],
                }).catch(() => {});

                if (partida.jogadores.length >= MAX_PLAYERS) {
                    clearInterval(timerContagem);
                    colEspera.stop('cheio');
                    clearTimeout(partida.timerEspera);
                    iniciarPartida(partida, msg.channel, gid);
                }
            } finally {
                entrando = false;
            }
        });

        colEspera.on('end', (_, reason) => {
            clearInterval(timerContagem);
            if (reason !== 'cheio' && partida.fase === 'espera') {
                iniciarPartida(partida, msg.channel, gid);
            }
        });

        // Timer de início automático
        partida.timerEspera = setTimeout(() => {
            colEspera.stop('timeout');
        }, 32_000);
    },
};