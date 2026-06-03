// ══════════════════════════════════════════════════════════════════
//  commands/diversao/gartic.js  —  v2.2
//  Bot de adivinhar imagens, estilo Gartic.io original
//  Prefixo: r!
//  MUDANÇAS v2.2:
//   - Sempre começa do nível 0, sem atalho
//   - Record do canal salvo e exibido
//   - Ao bater/igualar o record → opção de continuar aparece
//   - Se ninguém acertar no tempo → jogo encerra
//   - r!gartic reiniciar = r!gartic (apenas alias, ambos começam do 0)
// ══════════════════════════════════════════════════════════════════
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits
} = require('discord.js');
const fs   = require('fs');
const path = require('path');

const PACK_PATH   = path.join(__dirname, '../../data/gartic_pack.json');
const RECORD_PATH = path.join(__dirname, '../../data/gartic_records.json');
const CONFIG_PATH = path.join(__dirname, '../../data/gartic_config.json');

function lerJSON(filePath, fallback = {}) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch { return fallback; }
}
function salvarJSON(filePath, data) {
    try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch { return false; }
}

function carregarPack()      { return lerJSON(PACK_PATH, []); }
function lerRecords()        { return lerJSON(RECORD_PATH, {}); }
function salvarRecords(data) { return salvarJSON(RECORD_PATH, data); }
function lerConfig()         { return lerJSON(CONFIG_PATH, {}); }
function salvarConfig(data)  { return salvarJSON(CONFIG_PATH, data); }

const partidasAtivas = new Map();

function norm(str) {
    return str.toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ');
}
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function gerarDica(palavra, pct) {
    const chars    = [...palavra];
    const indices  = chars.reduce((acc, c, i) => (c !== ' ' ? [...acc, i] : acc), []);
    const revelar  = Math.floor(indices.length * pct);
    const escolhidos = shuffle(indices).slice(0, revelar);
    return chars.map((c, i) => {
        if (c === ' ') return ' ';
        return escolhidos.includes(i) ? c.toUpperCase() : '\\_';
    }).join(' ');
}

function corNivel(nivel) {
    return { facil: '#57F287', medio: '#FEE75C', dificil: '#ED4245', extremo: '#EB459E' }[nivel] || '#5865F2';
}

function tempoParaNivel(nivel) {
    if (nivel < 10)  return 90;
    if (nivel < 25)  return 75;
    if (nivel < 50)  return 60;
    if (nivel < 100) return 45;
    return 30;
}

// Retorna true se bateu record novo
function atualizarRecord(channelId, nivelAtual, holderName) {
    const records = lerRecords();
    const rec = records[channelId] || { record: 0, holder: null };
    if (nivelAtual > rec.record) {
        records[channelId] = { record: nivelAtual, holder: holderName };
        salvarRecords(records);
        return true;
    }
    return false;
}

// ══════════════════════════════════════════════
//  MÓDULO PRINCIPAL
// ══════════════════════════════════════════════
module.exports = {
    name: 'gartic',
    aliases: ['gt', 'adivinhar'],

    execute: async (msg, args, client) => {
        const prefix    = 'r!';
        const guildId   = msg.guild.id;
        const channelId = msg.channel.id;

        // ── SETUP ────────────────────────────────
        if (args[0] === 'setup') {
            if (!msg.member.permissions.has(PermissionFlagsBits.Administrator))
                return msg.reply({ embeds: [
                    new EmbedBuilder().setColor('#ED4245')
                        .setTitle('❌ Sem permissão')
                        .setDescription('Apenas **administradores** podem configurar o Gartic.')
                ] });

            const configs  = lerConfig();
            const cfgAtual = configs[guildId] || {};

            const embedSetup = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('⚙️ Configuração do Gartic')
                .setDescription(
                    '**Bem-vindo ao setup!**\n\n' +
                    '> 🎭 **Cargo Mod** — quem pode dar dicas durante o jogo\n' +
                    '> ✅ **Finalizar** — marca o servidor como configurado\n' +
                    '> 🔄 **Resetar** — apaga as configurações\n\n' +
                    `**Status:** ${cfgAtual.configured ? '✅ Configurado' : '❌ Não configurado'}\n` +
                    `**Cargo Mod:** ${cfgAtual.modRoleId ? `<@&${cfgAtual.modRoleId}>` : '*não definido*'}`
                )
                .setFooter({ text: `${msg.guild.name} • Setup` })
                .setTimestamp();

            const rowSetup = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('gs_cargo').setLabel('Definir Cargo Mod').setEmoji('🎭').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('gs_ok').setLabel('Finalizar Setup').setEmoji('✅').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('gs_reset').setLabel('Resetar').setEmoji('🔄').setStyle(ButtonStyle.Danger)
            );

            const msgS = await msg.channel.send({ embeds: [embedSetup], components: [rowSetup] });
            const col = msgS.createMessageComponentCollector({ filter: i => i.user.id === msg.author.id, time: 60000 });

            col.on('collect', async i => {
                if (i.customId === 'gs_cargo') {
                    await i.reply({ content: '📝 Mencione o cargo que será o `garticMod`:', ephemeral: true });
                    const colMsg = msg.channel.createMessageCollector({
                        filter: m => m.author.id === msg.author.id && m.mentions.roles.size > 0,
                        time: 30000, max: 1
                    });
                    colMsg.on('collect', async m => {
                        let role = m.mentions.roles.first();
                        if (!role) {
                            role = await msg.guild.roles.create({ name: 'garticMod', color: '#5865F2', reason: 'Setup Gartic' }).catch(() => null);
                        }
                        if (!role) return m.reply('❌ Não consegui criar o cargo.');
                        const c2 = lerConfig();
                        c2[guildId] = { ...c2[guildId], modRoleId: role.id, configured: true };
                        salvarConfig(c2);
                        await m.delete().catch(() => {});
                        await msg.channel.send({ embeds: [
                            new EmbedBuilder().setColor('#57F287').setDescription(`✅ Cargo <@&${role.id}> definido como **garticMod**!`)
                        ] });
                        msgS.edit({ components: [] }).catch(() => {});
                    });
                } else if (i.customId === 'gs_ok') {
                    const c2 = lerConfig();
                    c2[guildId] = { ...c2[guildId], configured: true };
                    salvarConfig(c2);
                    await i.update({ embeds: [
                        new EmbedBuilder().setColor('#57F287')
                            .setTitle('✅ Setup concluído!')
                            .setDescription(`Use \`${prefix}gartic\` para iniciar!\n\nCargo Mod: ${c2[guildId]?.modRoleId ? `<@&${c2[guildId].modRoleId}>` : '*não definido*'}`)
                    ], components: [] });
                } else if (i.customId === 'gs_reset') {
                    const c2 = lerConfig();
                    delete c2[guildId];
                    salvarConfig(c2);
                    await i.update({ embeds: [
                        new EmbedBuilder().setColor('#FEE75C').setDescription('🔄 Configurações resetadas.')
                    ], components: [] });
                }
            });
            col.on('end', () => msgS.edit({ components: [] }).catch(() => {}));
            return;
        }

        // ── VERIFICAÇÃO DE SETUP ─────────────────
        const configs = lerConfig();
        const cfg     = configs[guildId];
        if (!cfg || !cfg.configured) {
            return msg.channel.send({ embeds: [
                new EmbedBuilder().setColor('#FEE75C')
                    .setTitle('⚙️ Configuração necessária')
                    .setDescription(`Um administrador precisa executar \`${prefix}gartic setup\` primeiro.`)
            ] });
        }

        // ── PARAR ────────────────────────────────
        if (args[0] === 'parar' || args[0] === 'stop') {
            if (!partidasAtivas.has(channelId))
                return msg.reply({ embeds: [new EmbedBuilder().setColor('#ED4245').setDescription('❌ Nenhum jogo ativo neste canal.')] });

            const p = partidasAtivas.get(channelId);
            const podeParar = msg.author.id === p.dono
                || msg.member.permissions.has(PermissionFlagsBits.ManageMessages)
                || (cfg.modRoleId && msg.member.roles.cache.has(cfg.modRoleId));

            if (!podeParar)
                return msg.reply({ embeds: [new EmbedBuilder().setColor('#ED4245').setDescription('❌ Apenas o dono da partida, um mod ou garticMod pode parar.')] });

            p.ativa = false;
            p.collector?.stop('forcado');
            partidasAtivas.delete(channelId);
            return msg.channel.send({ embeds: [
                new EmbedBuilder().setColor('#ED4245').setTitle('🛑 Jogo encerrado').setDescription('A partida foi encerrada manualmente.')
            ] });
        }

        // ── AJUDA ────────────────────────────────
        if (args[0] === 'ajuda' || args[0] === 'help') {
            return msg.channel.send({ embeds: [
                new EmbedBuilder().setColor('#5865F2')
                    .setTitle('🎨 Gartic — Ajuda')
                    .setDescription('Adivinhe a palavra baseada na imagem exibida!')
                    .addFields(
                        { name: `\`${prefix}gartic\``, value: 'Inicia uma partida do nível 0', inline: false },
                        { name: `\`${prefix}gartic reiniciar\``, value: 'Mesmo que iniciar — sempre começa do 0', inline: false },
                        { name: `\`${prefix}gartic [facil|medio|dificil|extremo]\``, value: 'Filtra imagens por dificuldade', inline: false },
                        { name: `\`${prefix}gartic parar\``, value: 'Encerra a partida atual', inline: false },
                        { name: `\`${prefix}gartic record\``, value: 'Vê o record deste canal', inline: false },
                        { name: `\`${prefix}gartic setup\``, value: 'Configura o Gartic *(admin)*', inline: false },
                        { name: '🏅 Como funciona',
                          value: 'Sempre começa do **nível 0**.\nAcerte para subir de nível.\nSe o tempo acabar → **jogo encerra**.\nAo bater o record → pode escolher continuar ou parar!',
                          inline: false }
                    )
                    .setFooter({ text: 'Gartic — boa sorte!' })
            ] });
        }

        // ── RECORD ───────────────────────────────
        if (args[0] === 'record') {
            const rec = lerRecords()[channelId];
            return msg.channel.send({ embeds: [
                new EmbedBuilder().setColor('#F1C40F')
                    .setTitle('🏆 Record do Canal')
                    .setDescription(rec
                        ? `**Nível mais alto:** ${rec.record}\n**Alcançado por:** ${rec.holder || 'Desconhecido'}`
                        : 'Nenhum record ainda. Inicie uma partida!')
                    .setFooter({ text: `#${msg.channel.name}` })
                    .setTimestamp()
            ] });
        }

        // ── PARTIDA JÁ ATIVA ─────────────────────
        if (partidasAtivas.has(channelId))
            return msg.reply({ embeds: [
                new EmbedBuilder().setColor('#FEE75C')
                    .setDescription(`⚠️ Já há uma partida em andamento! Use \`${prefix}gartic parar\` para encerrar.`)
            ] });

        // ── PARSE: filtro de nível ───────────────
        const niveisValidos = ['facil', 'medio', 'dificil', 'extremo'];
        let filtroNivel = null;
        for (const a of args) {
            if (niveisValidos.includes(a.toLowerCase())) { filtroNivel = a.toLowerCase(); break; }
        }

        // ── CARREGAR PACK ────────────────────────
        let pack = carregarPack();
        if (pack.length === 0)
            return msg.channel.send({ embeds: [
                new EmbedBuilder().setColor('#ED4245').setDescription('❌ Pack de imagens não encontrado em `data/gartic_pack.json`.')
            ] });

        if (filtroNivel) pack = pack.filter(i => i.nivel === filtroNivel);
        if (pack.length === 0)
            return msg.channel.send({ embeds: [
                new EmbedBuilder().setColor('#FEE75C').setDescription(`⚠️ Nenhuma imagem para o nível **${filtroNivel}**.`)
            ] });

        pack = shuffle(pack);

        // ── CRIAR PARTIDA ─────────────────────────
        // Sempre começa do nível 0 — sem atalho
        const recAtual = lerRecords()[channelId] || { record: 0, holder: null };

        const partida = {
            dono:       msg.author.id,
            ativa:      true,
            rodada:     0,
            nivel:      0,           // sempre começa do 0
            pontuacao:  {},
            pack,
            collector:  null,
            filtroNivel
        };

        partidasAtivas.set(channelId, partida);

        // ── EMBED DE INÍCIO ───────────────────────
        const embedInicio = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎨 Gartic — Nova partida!')
            .setDescription(
                `**${msg.author.username}** iniciou uma partida!\n\n` +
                `📦 **Pack:** ${pack.length} imagens\n` +
                (filtroNivel ? `🎯 **Filtro:** ${filtroNivel}\n` : '') +
                `🚀 **Começa do nível 0** — acerte para subir!\n\n` +
                `A primeira imagem aparece em **5 segundos**...`
            )
            .addFields(
                { name: '🏆 Record do Canal', value: `Nível ${recAtual.record}`, inline: true },
                { name: '👑 Recordista',      value: recAtual.holder || '*ninguém ainda*', inline: true }
            )
            .setFooter({ text: `Use ${prefix}gartic parar para encerrar` })
            .setTimestamp();

        await msg.channel.send({ embeds: [embedInicio] });
        await new Promise(r => setTimeout(r, 5000));
        await proximaRodada(msg.channel, partida, client, cfg);

        // ════════════════════════════════════════
        //  PRÓXIMA RODADA
        // ════════════════════════════════════════
        async function proximaRodada(canal, partida, client, cfg) {
            if (!partida.ativa || !partidasAtivas.has(canal.id)) return;

            partida.rodada++;
            if (partida.rodada > partida.pack.length)
                return encerrarPartida(canal, partida, client, '✅ Todas as imagens do pack foram usadas!');

            const item    = partida.pack[partida.rodada - 1];
            const tempo   = tempoParaNivel(partida.nivel);
            let dicaPct   = 0;
            let tempoRest = tempo;

            const recAgora = () => lerRecords()[canal.id]?.record || 0;

            // ── Embed da imagem ──────────────────
            const embedImg = () => new EmbedBuilder()
                .setColor(corNivel(item.nivel))
                .setTitle(`🔽 NÍVEL ${partida.nivel}`)
                .setDescription(
                    `⏱️ Tempo: **${tempo}s** | 🎯 Categoria: **${item.categoria || '?'}**\n` +
                    `Dica: \`${gerarDica(item.respostas[0], 0)}\` *(${item.respostas[0].length} letras)*`
                )
                .setImage(item.imagem)
                .addFields(
                    { name: 'Próxima Etapa',   value: `Nível ${partida.nivel + 1}`, inline: true },
                    { name: 'Record do Canal', value: `Nível ${recAgora()}`, inline: true }
                )
                .setFooter({ text: `Rodada ${partida.rodada}/${partida.pack.length} • Digite sua resposta!` })
                .setTimestamp();

            const msgImg = await canal.send({ embeds: [embedImg()] });

            // ── Collector de respostas ───────────
            const collectorChat = canal.createMessageCollector({
                filter: m => !m.author.bot,
                time: tempo * 1000
            });
            partida.collector = collectorChat;

            // Timer de dicas progressivas (a cada 15s)
            const timerInterval = setInterval(async () => {
                if (!partida.ativa) { clearInterval(timerInterval); return; }
                tempoRest = Math.max(0, tempoRest - 15);
                dicaPct   = Math.min(dicaPct + 0.15, 0.6);

                const cor = tempoRest <= 20 ? '#ED4245' : tempoRest <= 40 ? '#FEE75C' : corNivel(item.nivel);
                msgImg.edit({ embeds: [
                    new EmbedBuilder()
                        .setColor(cor)
                        .setTitle(`🔽 NÍVEL ${partida.nivel}`)
                        .setDescription(
                            `⏱️ Tempo restante: **${tempoRest}s**\n` +
                            `Dica: \`${gerarDica(item.respostas[0], dicaPct)}\` *(${item.respostas[0].length} letras)*`
                        )
                        .setImage(item.imagem)
                        .addFields(
                            { name: 'Próxima Etapa',   value: `Nível ${partida.nivel + 1}`, inline: true },
                            { name: 'Record do Canal', value: `Nível ${recAgora()}`, inline: true }
                        )
                        .setFooter({ text: `Rodada ${partida.rodada}/${partida.pack.length}` })
                ] }).catch(() => {});

                if (tempoRest <= 0) { clearInterval(timerInterval); collectorChat.stop('tempo'); }
            }, 15000);

            collectorChat.on('collect', async m => {
                if (!partida.ativa) return collectorChat.stop('encerrado');

                // garticMod fala livremente sem contar como resposta
                const membro = m.member || await msg.guild.members.fetch(m.author.id).catch(() => null);
                if (cfg.modRoleId && membro?.roles.cache.has(cfg.modRoleId)) return;

                if (item.respostas.some(r => norm(r) === norm(m.content))) {
                    clearInterval(timerInterval);
                    collectorChat.stop('acertou');

                    const pts = Math.max(10, tempoRest) + (partida.nivel * 5);
                    partida.pontuacao[m.author.id] = (partida.pontuacao[m.author.id] || 0) + pts;
                    partida.nivel++;
                    await m.delete().catch(() => {});

                    // Verifica record
                    const recordAntes  = recAgora();
                    const bateuRecord  = atualizarRecord(canal.id, partida.nivel, m.author.username);
                    const igualouRecord = !bateuRecord && partida.nivel === recordAntes;

                    const embedAcerto = new EmbedBuilder()
                        .setColor(bateuRecord ? '#EB459E' : '#57F287')
                        .setTitle(bateuRecord ? '✅ Acertou! 🆕 NOVO RECORD!' : '✅ Acertou!')
                        .setDescription(
                            `**${m.author.username}** acertou! A resposta era **${item.respostas[0].toUpperCase()}**\n\n` +
                            `+**${pts} pontos** 🎉` +
                            (bateuRecord ? `\n\n🏆 **NOVO RECORD DO CANAL: Nível ${partida.nivel}!**` : '')
                        )
                        .addFields(
                            { name: '📈 Nível', value: `${partida.nivel - 1} → **${partida.nivel}**`, inline: true },
                            { name: '🏆 Pontuação', value: `**${partida.pontuacao[m.author.id]} pts**`, inline: true }
                        )
                        .setThumbnail(m.author.displayAvatarURL())
                        .setTimestamp();

                    const topLinhas = Object.entries(partida.pontuacao)
                        .sort((a, b) => b[1] - a[1]).slice(0, 3)
                        .map(([id, p], i) => `${['🥇','🥈','🥉'][i]} <@${id}> — **${p} pts**`)
                        .join('\n');

                    const embedRanking = new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle('📊 RANKING')
                        .setDescription(topLinhas || '*Ainda sem pontuações*')
                        .addFields(
                            { name: 'Próxima Etapa',   value: `Nível ${partida.nivel}`, inline: true },
                            { name: 'Record do Canal', value: `Nível ${recAgora()}`, inline: true }
                        );

                    await canal.send({ embeds: [embedAcerto, embedRanking] });

                    // ── Bateu/igualou o record → pergunta se quer continuar ──
                    if (bateuRecord || igualouRecord) {
                        const parou = await perguntarContinuar(canal, partida, m.author, bateuRecord);
                        if (parou) return; // encerrou por escolha do jogador
                    }

                    await enviarCountdown(canal);
                    await proximaRodada(canal, partida, client, cfg);
                }
            });

            collectorChat.on('end', async (_, reason) => {
                clearInterval(timerInterval);
                if (!partida.ativa || reason === 'encerrado' || reason === 'forcado' || reason === 'acertou') return;

                // Tempo acabou → encerra o jogo
                await canal.send({ embeds: [
                    new EmbedBuilder()
                        .setColor('#ED4245')
                        .setTitle('💀 Tempo esgotado! Fim de jogo!')
                        .setDescription(
                            `Ninguém acertou! A resposta era **${item.respostas[0].toUpperCase()}**\n\n` +
                            `A partida encerrou no **Nível ${partida.nivel}**.\n\n` +
                            `> Use \`${prefix}gartic\` para jogar novamente do nível 0`
                        )
                        .setImage(item.imagem)
                        .setTimestamp()
                ] });

                await encerrarPartida(canal, partida, client, '⏱️ O tempo acabou e ninguém acertou.');
            });
        }

        // ════════════════════════════════════════
        //  PERGUNTAR SE QUER CONTINUAR
        //  Aparece apenas quando bate/iguala o record
        // ════════════════════════════════════════
        async function perguntarContinuar(canal, partida, quemAcertou, bateuRecord) {
            return new Promise(async resolve => {
                const recAgora = lerRecords()[canal.id]?.record || 0;

                const embed = new EmbedBuilder()
                    .setColor(bateuRecord ? '#EB459E' : '#F1C40F')
                    .setTitle(bateuRecord ? '🏆 NOVO RECORD BATIDO!' : '🎯 Você chegou ao record do canal!')
                    .setDescription(
                        bateuRecord
                            ? `**${quemAcertou.username}** bateu o record do canal!\n**Novo record: Nível ${recAgora}**\n\nDeseja continuar tentando ir ainda mais longe?`
                            : `Você chegou ao **Nível ${partida.nivel}**, o record deste canal!\n\nDeseja continuar tentando superá-lo?`
                    )
                    .setFooter({ text: 'Você tem 30 segundos para decidir.' });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('gc_continuar').setLabel('▶️ Continuar').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('gc_parar').setLabel('🛑 Encerrar aqui').setStyle(ButtonStyle.Danger)
                );

                const msgP = await canal.send({ embeds: [embed], components: [row] });

                // Qualquer um pode votar, mas só o dono da partida ou quem acertou decide
                const col = msgP.createMessageComponentCollector({
                    filter: i => i.user.id === quemAcertou.id || i.user.id === partida.dono,
                    time: 30000,
                    max: 1
                });

                col.on('collect', async i => {
                    await i.deferUpdate();
                    msgP.edit({ components: [] }).catch(() => {});

                    if (i.customId === 'gc_parar') {
                        await canal.send({ embeds: [
                            new EmbedBuilder().setColor('#FEE75C')
                                .setDescription(`🛑 **${i.user.username}** decidiu encerrar a partida aqui.\n\nRecord do canal: **Nível ${recAgora}**`)
                        ] });
                        await encerrarPartida(canal, partida, client, '🛑 Partida encerrada por escolha do jogador.');
                        resolve(true); // parou
                    } else {
                        await canal.send({ embeds: [
                            new EmbedBuilder().setColor('#57F287')
                                .setDescription(`▶️ **${i.user.username}** decidiu continuar! Boa sorte! 🍀`)
                        ] });
                        resolve(false); // continua
                    }
                });

                col.on('end', (_, reason) => {
                    msgP.edit({ components: [] }).catch(() => {});
                    // Se ninguém decidiu em 30s → continua automaticamente
                    if (reason === 'time') {
                        canal.send({ embeds: [
                            new EmbedBuilder().setColor('#5865F2')
                                .setDescription('⏳ Nenhuma decisão em 30s — continuando automaticamente...')
                        ] }).catch(() => {});
                        resolve(false);
                    }
                });
            });
        }

        // ════════════════════════════════════════
        //  COUNTDOWN ENTRE RODADAS
        // ════════════════════════════════════════
        async function enviarCountdown(canal) {
            return new Promise(async resolve => {
                const segundos = 15;
                const msgC = await canal.send({ embeds: [
                    new EmbedBuilder().setColor('#5865F2').setDescription(`⏳ Próxima imagem em **${segundos}s**...`)
                ] });

                let restante = segundos;
                const iv = setInterval(async () => {
                    restante -= 5;
                    if (restante <= 0) {
                        clearInterval(iv);
                        await msgC.delete().catch(() => {});
                        resolve();
                        return;
                    }
                    msgC.edit({ embeds: [
                        new EmbedBuilder().setColor('#5865F2').setDescription(`⏳ Próxima imagem em **${restante}s**...`)
                    ] }).catch(() => {});
                }, 5000);
            });
        }

        // ════════════════════════════════════════
        //  ENCERRAR PARTIDA
        // ════════════════════════════════════════
        async function encerrarPartida(canal, partida, client, motivo = '') {
            if (!partida.ativa) return;
            partida.ativa = false;
            partida.collector?.stop('encerrado');
            partidasAtivas.delete(canal.id);

            const sorted = Object.entries(partida.pontuacao).sort((a, b) => b[1] - a[1]);
            const medals  = ['🥇', '🥈', '🥉'];

            const linhas = await Promise.all(sorted.map(async ([id, pts], i) => {
                const u = await client.users.fetch(id).catch(() => ({ username: 'Desconhecido' }));
                return `${medals[i] || `\`${i + 1}.\``} **${u.username}** — ${pts} pts`;
            }));

            const vencedor = sorted[0]
                ? await client.users.fetch(sorted[0][0]).catch(() => null)
                : null;

            const recFinal = lerRecords()[canal.id];

            const embedFinal = new EmbedBuilder()
                .setColor('#F1C40F')
                .setTitle('🏆 FIM DE JOGO!')
                .setDescription(
                    (motivo ? `*${motivo}*\n\n` : '') +
                    (vencedor
                        ? `🎉 **${vencedor.username}** foi o maior pontuador!\n\n**Placar Final:**\n${linhas.join('\n')}`
                        : 'Ninguém pontuou desta vez.')
                )
                .addFields(
                    { name: 'Nível Alcançado', value: `${partida.nivel}`, inline: true },
                    { name: 'Record do Canal', value: `Nível ${recFinal?.record || 0}${recFinal?.holder ? ` — ${recFinal.holder}` : ''}`, inline: true }
                )
                .setFooter({ text: `Use ${prefix}gartic para jogar novamente!` })
                .setTimestamp();

            if (vencedor) embedFinal.setThumbnail(vencedor.displayAvatarURL());

            await canal.send({ embeds: [embedFinal] });
        }
    }
};
