'use strict';
// ============================================================
//  RETH MORGAN — MINES (Campo Minado)
//  ✅ Grid 5x5 interativo com botões do Discord
//  ✅ Suporte a aposta com "k" (ex: 1k = 1000, 2.5k = 2500)
//  ✅ Cashout via subcomando: r!mines cashout
//  ✅ Multiplicador crescente a cada célula revelada
//  ✅ Cooldown entre partidas
//  ✅ Bônus de sorte do inventário
//  FIX: Discord só permite 5 ActionRows — grid 5x5 ocupa todas;
//       cashout movido para subcomando de texto para contornar o limite.
// ============================================================
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const bonus = require('../../lib/bonus');

const COOLDOWNS = new Map();
const CD_MS     = 15_000; // 15s entre partidas

const LINHAS  = 5;
const COLUNAS = 5;
const TOTAL   = LINHAS * COLUNAS; // 25 células

// Multiplicadores por célula revelada (sem bomba)
const MULT_TABLE = [
    1.00, 1.10, 1.22, 1.36, 1.52,
    1.70, 1.90, 2.13, 2.38, 2.67,
    3.00, 3.37, 3.78, 4.25, 4.78,
    5.37, 6.04, 6.79, 7.64, 8.60,
    9.68, 10.9, 12.3, 13.8, 15.6,
];

// ── Partidas ativas (para cashout via texto) ──────────────────────────────────
// uid → { grid, reveladas, stepAtual, aposta, qtdBombas, msg, multSorte, gid }
const PARTIDAS_ATIVAS = new Map();

// ── Parser de aposta com suporte a "k" ───────────────────────────────────────
// Exemplos: "1k" → 1000, "2.5k" → 2500, "500" → 500
function parseAposta(str) {
    if (!str) return NaN;
    const s = str.toLowerCase().trim();
    if (s.endsWith('k')) {
        const n = parseFloat(s.slice(0, -1));
        return isNaN(n) ? NaN : Math.floor(n * 1000);
    }
    return parseInt(s);
}

function gerarGrid(qtdBombas) {
    const cells = Array(TOTAL).fill('safe');
    let colocadas = 0;
    while (colocadas < qtdBombas) {
        const idx = Math.floor(Math.random() * TOTAL);
        if (cells[idx] !== 'bomb') { cells[idx] = 'bomb'; colocadas++; }
    }
    return cells;
}

function buildRows(grid, reveladas, encerrado) {
    const rows = [];
    for (let l = 0; l < LINHAS; l++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < COLUNAS; c++) {
            const idx = l * COLUNAS + c;
            const rev = reveladas[idx];
            let label, style, disabled;

            if (encerrado) {
                if (grid[idx] === 'bomb') {
                    label = '💣'; style = ButtonStyle.Danger; disabled = true;
                } else if (rev) {
                    label = '💎'; style = ButtonStyle.Success; disabled = true;
                } else {
                    label = '·'; style = ButtonStyle.Secondary; disabled = true;
                }
            } else if (rev) {
                label = '💎'; style = ButtonStyle.Success; disabled = true;
            } else {
                label = '·'; style = ButtonStyle.Secondary; disabled = false;
            }

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`mines_${idx}`)
                    .setLabel(label)
                    .setStyle(style)
                    .setDisabled(disabled)
            );
        }
        rows.push(row);
    }
    return rows; // sempre 5 linhas = 5 ActionRows (máximo do Discord)
}

function embedStatus(author, aposta, mult, reveladas, qtdBombas, status = 'jogando') {
    const seguras   = reveladas.filter(Boolean).length;
    const restantes = TOTAL - qtdBombas - seguras;
    const ganhoAtual = Math.floor(aposta * mult);
    const cor = status === 'ganhou' ? '#2ecc71' : status === 'perdeu' ? '#e74c3c' : '#f39c12';
    const titulo = status === 'jogando' ? '💣 CAMPO MINADO'
        : status === 'ganhou' ? '💸 VOCÊ RETIROU!'
        : '💥 BOMBA! GAME OVER';

    const embedBuilder = new EmbedBuilder()
        .setColor(cor)
        .setTitle(titulo)
        .setAuthor({ name: author.username, iconURL: author.displayAvatarURL({ dynamic: true }) })
        .addFields(
            { name: '💰 Aposta',        value: `\`${aposta} 🪙\``,                               inline: true },
            { name: '📈 Multiplicador', value: `\`×${mult.toFixed(2)}\``,                         inline: true },
            { name: '🏆 Ganho',         value: `\`${ganhoAtual} 🪙\``,                            inline: true },
            { name: '💎 Reveladas',     value: `\`${seguras}\``,                                   inline: true },
            { name: '💣 Bombas',        value: `\`${qtdBombas}\``,                                 inline: true },
            { name: '🔲 Restantes',     value: `\`${restantes > 0 ? restantes : 0} seguras\``,    inline: true },
        );

    if (status === 'jogando' && seguras >= 1) {
        embedBuilder.addFields({
            name: '💸 Cash Out',
            value: `Digite \`r!mines cashout\` para retirar **${ganhoAtual} 🪙** agora!`,
            inline: false,
        });
    }

    embedBuilder.setFooter({
        text: status === 'jogando'
            ? 'Clique em uma célula · r!mines cashout para retirar'
            : 'Use r!mines <aposta> [bombas] para jogar de novo',
    });

    return embedBuilder;
}

module.exports = {
    name: 'mines',
    aliases: ['minefield', 'campo'],

    execute: async (msg, args) => {
        const gid = msg.guild.id;
        const uid = msg.author.id;

        // ── Subcomando: cashout ───────────────────────────────────────────────
        if (args[0]?.toLowerCase() === 'cashout') {
            const partida = PARTIDAS_ATIVAS.get(uid);
            if (!partida) return msg.reply('❌ Você não tem uma partida ativa!');
            if (partida.stepAtual < 1) return msg.reply('❌ Revele ao menos uma célula antes de retirar!');

            partida.encerrado = true;
            PARTIDAS_ATIVAS.delete(uid);

            const mult = +(MULT_TABLE[Math.min(partida.stepAtual, MULT_TABLE.length - 1)] * partida.multSorte).toFixed(2);
            const ganho = Math.floor(partida.aposta * mult);

            const d2 = bonus.ler();
            bonus.garantir(d2, partida.gid, uid);
            d2[partida.gid][uid].coins += ganho;
            require('fs').writeFileSync('./database/xp.json', JSON.stringify(d2, null, 2));

            await partida.msg.edit({
                embeds: [embedStatus(msg.author, partida.aposta, mult, partida.reveladas, partida.qtdBombas, 'ganhou')],
                components: buildRows(partida.grid, partida.reveladas, true),
            }).catch(() => {});

            return msg.reply(`💸 Você retirou **${ganho} 🪙**!`);
        }

        // ── Cooldown ─────────────────────────────────────────────────────────
        const agora = Date.now();
        const ultimo = COOLDOWNS.get(uid) ?? 0;
        if (agora - ultimo < CD_MS) {
            const restante = Math.ceil((CD_MS - (agora - ultimo)) / 1000);
            return msg.reply(`⏰ Aguarde **${restante}s** antes de jogar de novo.`);
        }

        // ── Args — suporte a "k" e ordem flexível (aposta bombas ou bombas aposta) ──
        // Aceita: r!mines 1k 2 | r!mines 2 1k | r!mines 1000 3
        const aposta    = parseAposta(args[0]);
        const qtdBombas = Math.min(Math.max(parseInt(args[1]) || 3, 1), 24);

        if (!aposta || aposta < 10)
            return msg.reply('❌ Use: `r!mines <aposta> [bombas 1-24]`\nAposta mínima: **10 🪙**\nExemplo: `r!mines 1k 3` ou `r!mines 500 5`');

        // ── Saldo ─────────────────────────────────────────────────────────────
        const dados = bonus.ler();
        bonus.garantir(dados, gid, uid);
        const u = dados[gid][uid];

        if ((u.coins ?? 0) < aposta)
            return msg.reply(`❌ Você não tem \`${aposta} 🪙\` na carteira!`);

        // Desconta aposta
        u.coins -= aposta;
        bonus.salvar
            ? bonus.salvar(dados)
            : require('fs').writeFileSync('./database/xp.json', JSON.stringify(dados, null, 2));

        COOLDOWNS.set(uid, agora);

        // ── Estado do jogo ────────────────────────────────────────────────────
        const grid      = gerarGrid(qtdBombas);
        const reveladas = Array(TOTAL).fill(false);
        let   stepAtual = 0;
        let   encerrado = false;

        const multSorte = bonus.getMultSorte ? bonus.getMultSorte(gid, uid) : 1;

        function multAtual() {
            const base = MULT_TABLE[Math.min(stepAtual, MULT_TABLE.length - 1)];
            return +(base * multSorte).toFixed(2);
        }

        // ── Mensagem inicial ──────────────────────────────────────────────────
        // 5 ActionRows para o grid (máximo permitido pelo Discord)
        const embed = embedStatus(msg.author, aposta, multAtual(), reveladas, qtdBombas);
        const m = await msg.reply({ embeds: [embed], components: buildRows(grid, reveladas, false) });

        // Registra partida ativa para cashout via texto
        PARTIDAS_ATIVAS.set(uid, {
            grid, reveladas, stepAtual, aposta, qtdBombas,
            multSorte, gid, msg: m, encerrado: false,
        });

        // ── Collector ─────────────────────────────────────────────────────────
        const coletor = m.createMessageComponentCollector({
            filter: i => i.user.id === uid,
            time:   5 * 60_000,
        });

        coletor.on('collect', async i => {
            if (encerrado) return i.deferUpdate();
            await i.deferUpdate();

            const idx = parseInt(i.customId.split('_')[1]);
            if (isNaN(idx) || reveladas[idx]) return;

            reveladas[idx] = true;

            // Sincroniza referência do step na partida ativa
            const partidaRef = PARTIDAS_ATIVAS.get(uid);

            if (grid[idx] === 'bomb') {
                // PERDEU
                encerrado = true;
                coletor.stop();
                PARTIDAS_ATIVAS.delete(uid);

                await m.edit({
                    embeds: [embedStatus(msg.author, aposta, multAtual(), reveladas, qtdBombas, 'perdeu')],
                    components: buildRows(grid, reveladas, true),
                });
                return;
            }

            // Célula segura
            stepAtual++;
            if (partidaRef) partidaRef.stepAtual = stepAtual;

            const seguras = reveladas.filter(Boolean).length;
            const totalSeguras = TOTAL - qtdBombas;

            if (seguras >= totalSeguras) {
                // Revelou todas as seguras — ganhou automaticamente
                encerrado = true;
                coletor.stop();
                PARTIDAS_ATIVAS.delete(uid);

                const ganho = Math.floor(aposta * multAtual());
                const d2 = bonus.ler();
                bonus.garantir(d2, gid, uid);
                d2[gid][uid].coins += ganho;
                require('fs').writeFileSync('./database/xp.json', JSON.stringify(d2, null, 2));

                await m.edit({
                    embeds: [embedStatus(msg.author, aposta, multAtual(), reveladas, qtdBombas, 'ganhou')],
                    components: buildRows(grid, reveladas, true),
                });
                return;
            }

            // Atualiza tabuleiro
            await m.edit({
                embeds: [embedStatus(msg.author, aposta, multAtual(), reveladas, qtdBombas)],
                components: buildRows(grid, reveladas, false),
            });
        });

        coletor.on('end', (_, reason) => {
            if (!encerrado) {
                // Tempo esgotado — devolve aposta
                encerrado = true;
                PARTIDAS_ATIVAS.delete(uid);

                const d2 = bonus.ler();
                bonus.garantir(d2, gid, uid);
                d2[gid][uid].coins += aposta;
                require('fs').writeFileSync('./database/xp.json', JSON.stringify(d2, null, 2));

                m.edit({
                    embeds: [new EmbedBuilder()
                        .setColor('#95a5a6')
                        .setTitle('⏰ Tempo esgotado!')
                        .setDescription(`Sua aposta de \`${aposta} 🪙\` foi devolvida.`)
                    ],
                    components: [],
                }).catch(() => {});
            }
        });
    },
};