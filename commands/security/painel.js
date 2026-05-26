// commands/security/painel.js
// Reth Morgan Shield System V8 — Painel Redesenhado
'use strict';

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const fs   = require('fs');
const path = require('path');

// ─── IDs dos donos (deve espelhar o index.js) ────────────────────────────────
const OWNER_IDS = ['1507543140800921610', '1272650221402194095'];

function ehDono(userId) {
    return OWNER_IDS.includes(userId);
}

module.exports = {
    name: 'painel',
    aliases: ['config', 'dashboard', 'setup'],

    execute: async (msg, args, client, OWNER_ID) => {
        // ✅ FIX: agora aceita qualquer ID do array OWNER_IDS
        const eDonoSupremo = ehDono(msg.author.id);
        const eDonoServer  = msg.author.id === msg.guild.ownerId;

        if (!eDonoSupremo && !eDonoServer) {
            return msg.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#f53b57')
                        .setTitle('🔒 ACESSO NEGADO — ÁREA RESTRITA')
                        .setDescription(
                            '> Este painel é reservado ao **Proprietário do servidor** ou ao **Desenvolvedor Supremo**.\n\n' +
                            '`Credenciais insuficientes. Acesso bloqueado por protocolos de segurança.`'
                        )
                        .setFooter({ text: 'RETH MORGAN SHIELD SYSTEM V8' })
                        .setTimestamp()
                ]
            });
        }

        // ─── I/O de configurações ─────────────────────────────────────────────

        function obterConfigs() {
            let configs = {};
            try {
                const raw = fs.readFileSync('./database/config.json', 'utf-8');
                if (raw.trim()) configs = JSON.parse(raw);
            } catch { configs = {}; }

            if (!configs[msg.guild.id]) configs[msg.guild.id] = {};
            const sc = configs[msg.guild.id];

            const defaults = {
                antiflood: false, limiteFlood: 5,
                antilink: false, antiinvite: false,
                anticaps: false, antipreconceito: false,
                antiSpoiler: false, filtroEmojis: false, maxEmojis: 10,
                limiteMencoes: false,
                antibot: false, antinuke: false,
                antiMassBan: false, maxBans: 5,
                antiMassKick: false, maxKicks: 5,
                anticargos: false, cargos_protegidos: [],
                antifake: false, diasFake: 7,
                detectorSelfbots: false,
                autoModNomes: false,
                logs_seguranca: null, logs_staff: null,
                logs_msg: null, logs_join: null,
                logs_anticargos: null,
                autorole: null, msg_join: null,
                bypass_roles: [],
                canal_fun: null, xp_ativo: true, coins_ativo: true,
                morgan_ativo: false, morgan_canal: null,
                autoPunicaoWarns: 3,
                limpezaAgendada: false, horasLimpeza: 24,
            };

            for (const [k, v] of Object.entries(defaults)) {
                if (sc[k] === undefined) sc[k] = v;
            }
            if (!Array.isArray(sc.bypass_roles))      sc.bypass_roles = [];
            if (!Array.isArray(sc.cargos_protegidos)) sc.cargos_protegidos = [];

            return { configs, sc };
        }

        function salvarConfigs(dados) {
            fs.writeFileSync('./database/config.json', JSON.stringify(dados, null, 2));
        }

        // ─── Helpers ──────────────────────────────────────────────────────────

        const ON  = '`✅ ON `';
        const OFF = '`❌ OFF`';
        const statusIcon = (v) => v ? ON : OFF;
        const nomeCanal  = (id) => id ? `<#${id}>` : '`—`';
        const nomeCargo  = (id) => id ? `<@&${id}>` : '`—`';

        // Barra de progresso de features ativas
        function barraStatus(sc) {
            const toggles = [
                sc.antiflood, sc.antilink, sc.antiinvite, sc.anticaps,
                sc.antipreconceito, sc.antibot, sc.antinuke, sc.anticargos,
                sc.antifake, sc.antiMassBan, sc.antiMassKick,
                sc.detectorSelfbots, sc.morgan_ativo
            ];
            const ativas = toggles.filter(Boolean).length;
            const total  = toggles.length;
            const blocos = Math.round((ativas / total) * 10);
            const barra  = '█'.repeat(blocos) + '░'.repeat(10 - blocos);
            return { barra, ativas, total };
        }

        // ─── EMBEDS ───────────────────────────────────────────────────────────

        function gerarEmbedHome() {
            const { barra, ativas, total } = barraStatus(obterConfigs().sc);
            const guild = msg.guild;
            return new EmbedBuilder()
                .setColor('#5865f2')
                .setAuthor({
                    name: 'RETH MORGAN — SHIELD SYSTEM V8',
                    iconURL: client.user.displayAvatarURL()
                })
                .setTitle(`🛡️ Central de Operações — ${guild.name}`)
                .setThumbnail(guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL())
                .setDescription(
                    `> **Operador:** <@${msg.author.id}>\n` +
                    `> **Servidor:** \`${guild.name}\` · \`${guild.memberCount}\` membros\n` +
                    `> **Status do Bot:** 🟢 Online · \`${client.guilds.cache.size}\` servidores\n\n` +
                    `**Proteções Ativas:** \`${ativas}/${total}\`\n` +
                    `\`\`\`\n[${barra}] ${Math.round((ativas / total) * 100)}%\n\`\`\``
                )
                .addFields(
                    { name: '🛑  Chat & Filtros',      value: 'Flood · Links · Caps · Emojis · Menções', inline: true },
                    { name: '☢️  Segurança Anti-Raid', value: 'Nuke · Bot · Fake · Mass Ban/Kick', inline: true },
                    { name: '📋  Logs & Registros',    value: 'Segurança · Staff · Mensagens · Joins', inline: true },
                    { name: '⚙️  Automação',           value: 'Auto-Role · Boas-Vindas · Bypass', inline: true },
                    { name: '🎮  Diversão',             value: 'Canal Fun · XP · Economy', inline: true },
                    { name: '🤖  I.A. Morgan',          value: 'Canal · Status · Inteligência', inline: true },
                )
                .setFooter({ text: `RETH MORGAN V8  •  ${new Date().toLocaleString('pt-BR')}` });
        }

        function gerarEmbedChat(sc) {
            return new EmbedBuilder()
                .setColor('#3498db')
                .setAuthor({ name: 'RETH MORGAN — FILTROS DE CHAT', iconURL: client.user.displayAvatarURL() })
                .setTitle('🛑 Moderação de Mensagens')
                .setDescription('> Controle o conteúdo do chat em tempo real. Clique nos botões para ativar/desativar.')
                .addFields(
                    {
                        name: '┌ 🌊 Anti-Flood',
                        value: `${statusIcon(sc.antiflood)}\n↳ Limite: \`${sc.limiteFlood} msgs / 4s\``,
                        inline: true
                    },
                    {
                        name: '├ 🔗 Anti-Links',
                        value: `${statusIcon(sc.antilink)}\n↳ Bloqueia URLs externas`,
                        inline: true
                    },
                    {
                        name: '├ 📩 Anti-Convites',
                        value: `${statusIcon(sc.antiinvite)}\n↳ Bloqueia discord.gg`,
                        inline: true
                    },
                    {
                        name: '├ 🔠 Anti-Caps Lock',
                        value: `${statusIcon(sc.anticaps)}\n↳ Limite 70% maiúsculas`,
                        inline: true
                    },
                    {
                        name: '├ 🤬 Anti-Preconceito',
                        value: `${statusIcon(sc.antipreconceito)}\n↳ Filtro de palavras`,
                        inline: true
                    },
                    {
                        name: '├ 🙈 Anti-Spoiler',
                        value: `${statusIcon(sc.antiSpoiler)}\n↳ Máx 3 spoilers`,
                        inline: true
                    },
                    {
                        name: '├ 😅 Filtro de Emojis',
                        value: `${statusIcon(sc.filtroEmojis)}\n↳ Máx \`${sc.maxEmojis}\` emojis`,
                        inline: true
                    },
                    {
                        name: '└ 🔇 Limite de Menções',
                        value: `${statusIcon(sc.limiteMencoes)}\n↳ Máx por mensagem`,
                        inline: true
                    },
                )
                .setFooter({ text: 'RETH MORGAN V8  •  Chat & Filtros' });
        }

        function gerarEmbedSeguranca(sc) {
            const listaCargos = sc.cargos_protegidos.length > 0
                ? sc.cargos_protegidos.map(id => `<@&${id}>`).join(' · ')
                : '`Nenhum cargo protegido`';

            return new EmbedBuilder()
                .setColor('#e74c3c')
                .setAuthor({ name: 'RETH MORGAN — SEGURANÇA ANTI-RAID', iconURL: client.user.displayAvatarURL() })
                .setTitle('☢️ Protocolos de Defesa')
                .setDescription('> Proteções contra traições internas, raids e invasões externas.')
                .addFields(
                    {
                        name: '┌ 🤖 Anti-Bot Invasor',
                        value: `${statusIcon(sc.antibot)}\n↳ Bane bot + executor`,
                        inline: true
                    },
                    {
                        name: '├ 💣 Anti-Nuke',
                        value: `${statusIcon(sc.antinuke)}\n↳ 3+ canais deletados`,
                        inline: true
                    },
                    {
                        name: '├ 🎭 Anti-Fake',
                        value: `${statusIcon(sc.antifake)}\n↳ Mín. \`${sc.diasFake} dias\` de conta`,
                        inline: true
                    },
                    {
                        name: '├ 🔰 Anti-Cargos',
                        value: `${statusIcon(sc.anticargos)}\n↳ Protege cargos VIP`,
                        inline: true
                    },
                    {
                        name: '├ 🔨 Anti-Mass Ban',
                        value: `${statusIcon(sc.antiMassBan)}\n↳ Máx \`${sc.maxBans}\` bans/min`,
                        inline: true
                    },
                    {
                        name: '├ 👢 Anti-Mass Kick',
                        value: `${statusIcon(sc.antiMassKick)}\n↳ Máx \`${sc.maxKicks}\` kicks/min`,
                        inline: true
                    },
                    {
                        name: '├ 🤖 Detector Selfbots',
                        value: `${statusIcon(sc.detectorSelfbots)}\n↳ Padrão suspeito`,
                        inline: true
                    },
                    {
                        name: '├ ✏️ Auto-Mod Nomes',
                        value: `${statusIcon(sc.autoModNomes)}\n↳ Nicks inválidos`,
                        inline: true
                    },
                    {
                        name: '└ ⚠️ Auto-Ban por Warns',
                        value: `\`${sc.autoPunicaoWarns} warns\` → ban auto`,
                        inline: true
                    },
                    {
                        name: '🔒 Cargos Protegidos',
                        value: listaCargos,
                        inline: false
                    },
                )
                .setFooter({ text: 'RETH MORGAN V8  •  Segurança' });
        }

        function gerarEmbedLogs(sc) {
            return new EmbedBuilder()
                .setColor('#9b59b6')
                .setAuthor({ name: 'RETH MORGAN — CANAIS DE LOG', iconURL: client.user.displayAvatarURL() })
                .setTitle('📋 Registros & Auditoria')
                .setDescription('> Configure onde cada tipo de evento será registrado.')
                .addFields(
                    { name: '🛡️ Segurança',       value: nomeCanal(sc.logs_seguranca),  inline: true },
                    { name: '👮 Staff',             value: nomeCanal(sc.logs_staff),      inline: true },
                    { name: '📝 Mensagens',         value: nomeCanal(sc.logs_msg),        inline: true },
                    { name: '🚪 Entradas/Saídas',   value: nomeCanal(sc.logs_join),       inline: true },
                    { name: '🔰 Anti-Cargos',       value: nomeCanal(sc.logs_anticargos), inline: true },
                    { name: '\u200b',               value: '\u200b',                      inline: true },
                )
                .setFooter({ text: 'RETH MORGAN V8  •  Logs & Registros' });
        }

        function gerarEmbedAutomacao(sc) {
            const listaBypass = sc.bypass_roles.length > 0
                ? sc.bypass_roles.map(id => `<@&${id}>`).join(' · ')
                : '`Nenhum cargo imune`';
            return new EmbedBuilder()
                .setColor('#2ecc71')
                .setAuthor({ name: 'RETH MORGAN — AUTOMAÇÃO', iconURL: client.user.displayAvatarURL() })
                .setTitle('⚙️ Configurações Gerais')
                .setDescription('> Configure as funções automáticas do servidor.')
                .addFields(
                    { name: '🎒 Auto-Role',              value: nomeCargo(sc.autorole),  inline: true },
                    { name: '👋 Canal Boas-Vindas',      value: nomeCanal(sc.msg_join),  inline: true },
                    {
                        name: '🗑️ Limpeza Agendada',
                        value: `${statusIcon(sc.limpezaAgendada)}\n↳ A cada \`${sc.horasLimpeza}h\``,
                        inline: true
                    },
                    { name: '👑 Cargos Imunes (Bypass)', value: listaBypass, inline: false },
                )
                .setFooter({ text: 'RETH MORGAN V8  •  Automação' });
        }

        function gerarEmbedDiversao(sc) {
            return new EmbedBuilder()
                .setColor('#e91e8c')
                .setAuthor({ name: 'RETH MORGAN — DIVERSÃO', iconURL: client.user.displayAvatarURL() })
                .setTitle('🎮 Sistema de Diversão & Progressão')
                .setDescription('> Configure o canal de fun e os sistemas de progressão dos membros.')
                .addFields(
                    {
                        name: '🎯 Canal de Diversão',
                        value: `${nomeCanal(sc.canal_fun)}\n↳ Comandos fun exclusivos aqui`,
                        inline: false
                    },
                    {
                        name: '⭐ Sistema de XP',
                        value: `${statusIcon(sc.xp_ativo)}\n↳ Ranking de atividade`,
                        inline: true
                    },
                    {
                        name: '💰 Sistema Economy',
                        value: `${statusIcon(sc.coins_ativo)}\n↳ Moedas & recompensas`,
                        inline: true
                    },
                )
                .setFooter({ text: 'RETH MORGAN V8  •  Diversão' });
        }

        function gerarEmbedMorgan(sc) {
            return new EmbedBuilder()
                .setColor('#5865f2')
                .setAuthor({ name: 'RETH MORGAN — INTELIGÊNCIA ARTIFICIAL', iconURL: client.user.displayAvatarURL() })
                .setTitle('🤖 I.A. Morgan · Groq llama-3.3-70b')
                .setDescription(
                    '> Configure o comportamento da I.A. Morgan no servidor.\n' +
                    '> Quando ativada, responde no canal definido e ao ser chamada pelo nome.\n\n' +
                    '```ansi\n[2;34m[SISTEMA][0m[2;32m Protocolo de IA inicializado.[0m\n```'
                )
                .addFields(
                    {
                        name: '⚡ Status da I.A.',
                        value: `${statusIcon(sc.morgan_ativo)}\n↳ Responde ao nome e menções`,
                        inline: true
                    },
                    {
                        name: '📢 Canal Exclusivo',
                        value: `${nomeCanal(sc.morgan_canal)}\n↳ Morgan responde tudo aqui`,
                        inline: true
                    },
                )
                .setFooter({ text: 'RETH MORGAN V8  •  I.A. Morgan  •  Groq' });
        }

        // ─── BOTÕES ───────────────────────────────────────────────────────────

        function gerarBotoesNavegacao() {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('nav_home').setLabel('Início').setEmoji('🏠').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('nav_chat').setLabel('Chat').setEmoji('🛑').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('nav_seguranca').setLabel('Segurança').setEmoji('☢️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('nav_logs').setLabel('Logs').setEmoji('📋').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('nav_mais').setLabel('Mais ▶').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
            );
        }

        function gerarBotoesNavegacao2() {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('nav_home').setLabel('Início').setEmoji('🏠').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('nav_automacao').setLabel('Automação').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('nav_diversao').setLabel('Diversão').setEmoji('🎮').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('nav_morgan').setLabel('I.A. Morgan').setEmoji('🤖').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('nav_voltar').setLabel('◀ Voltar').setEmoji('🔙').setStyle(ButtonStyle.Secondary),
            );
        }

        function gerarBotoesChat(sc) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('toggle_flood').setLabel('Anti-Flood').setEmoji(sc.antiflood ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_limite_flood').setLabel('Limite Flood').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_link').setLabel('Anti-Link').setEmoji(sc.antilink ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_invite').setLabel('Anti-Invite').setEmoji(sc.antiinvite ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_precon').setLabel('Anti-Ódio').setEmoji(sc.antipreconceito ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
            );
        }

        function gerarBotoesChat2(sc) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('toggle_caps').setLabel('Anti-Caps').setEmoji(sc.anticaps ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_spoiler').setLabel('Anti-Spoiler').setEmoji(sc.antiSpoiler ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_emojis').setLabel('Filtro Emoji').setEmoji(sc.filtroEmojis ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_mencoes').setLabel('Lim. Menções').setEmoji(sc.limiteMencoes ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
            );
        }

        function gerarBotoesSeguranca(sc) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('toggle_bot').setLabel('Anti-Bot').setEmoji(sc.antibot ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_nuke').setLabel('Anti-Nuke').setEmoji(sc.antinuke ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_cargos').setLabel('Anti-Cargos').setEmoji(sc.anticargos ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_fake').setLabel('Anti-Fake').setEmoji(sc.antifake ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_massban').setLabel('Anti-MassBan').setEmoji(sc.antiMassBan ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
            );
        }

        function gerarBotoesSeguranca2(sc) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('toggle_masskick').setLabel('Anti-MassKick').setEmoji(sc.antiMassKick ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_selfbot').setLabel('Selfbots').setEmoji(sc.detectorSelfbots ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_automod').setLabel('Auto-Mod Nomes').setEmoji(sc.autoModNomes ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_prot_cargo').setLabel('Cargos Prot.').setEmoji('🔒').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('set_dias_fake').setLabel('Config Fake').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
            );
        }

        function gerarBotoesLogs() {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('set_log_seg').setLabel('Segurança').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_log_staff').setLabel('Staff').setEmoji('👮').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_log_msg').setLabel('Mensagens').setEmoji('📝').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_log_join').setLabel('Entradas').setEmoji('🚪').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_log_anticargos').setLabel('Anti-Cargos').setEmoji('🔰').setStyle(ButtonStyle.Primary),
            );
        }

        function gerarBotoesAutomacao() {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('set_auto_role').setLabel('Auto-Role').setEmoji('🎒').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_boas_vindas').setLabel('Boas-Vindas').setEmoji('👋').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_bypass').setLabel('Bypass').setEmoji('👑').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_limpeza').setLabel('Limpeza').setEmoji('🗑️').setStyle(ButtonStyle.Secondary),
            );
        }

        function gerarBotoesDiversao(sc) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('set_canal_fun').setLabel('Canal Fun').setEmoji('🎯').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('clear_canal_fun').setLabel('Limpar Canal').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('toggle_xp').setLabel('Sistema XP').setEmoji(sc.xp_ativo ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_coins').setLabel('Economy').setEmoji(sc.coins_ativo ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
            );
        }

        function gerarBotoesMorgan(sc) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('toggle_morgan')
                    .setLabel(sc.morgan_ativo ? 'Desativar I.A.' : 'Ativar I.A.')
                    .setEmoji(sc.morgan_ativo ? '🟩' : '🟥')
                    .setStyle(sc.morgan_ativo ? ButtonStyle.Success : ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('set_canal_morgan')
                    .setLabel('Definir Canal')
                    .setEmoji('📢')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('clear_canal_morgan')
                    .setLabel('Limpar Canal')
                    .setEmoji('🗑️')
                    .setStyle(ButtonStyle.Danger),
            );
        }

        // ─── Envio inicial ────────────────────────────────────────────────────

        const botoesNavegacao = gerarBotoesNavegacao();
        const painelMensagem  = await msg.channel.send({
            embeds: [gerarEmbedHome()],
            components: [botoesNavegacao],
        });

        // ─── Collector principal ──────────────────────────────────────────────

        const collector = painelMensagem.createMessageComponentCollector({
            filter: (i) => i.user.id === msg.author.id,
            time: 10 * 60 * 1000, // 10 minutos
        });

        collector.on('collect', async (i) => {
            const { configs, sc: currentSc } = obterConfigs();

            // ── Navegação ─────────────────────────────────────────────────────
            const navMap = {
                'nav_home': {
                    embeds: [gerarEmbedHome()],
                    components: [botoesNavegacao]
                },
                'nav_chat': {
                    embeds: [gerarEmbedChat(currentSc)],
                    components: [botoesNavegacao, gerarBotoesChat(currentSc), gerarBotoesChat2(currentSc)]
                },
                'nav_seguranca': {
                    embeds: [gerarEmbedSeguranca(currentSc)],
                    components: [botoesNavegacao, gerarBotoesSeguranca(currentSc), gerarBotoesSeguranca2(currentSc)]
                },
                'nav_seg_back': {
                    embeds: [gerarEmbedSeguranca(currentSc)],
                    components: [botoesNavegacao, gerarBotoesSeguranca(currentSc), gerarBotoesSeguranca2(currentSc)]
                },
                'nav_logs': {
                    embeds: [gerarEmbedLogs(currentSc)],
                    components: [botoesNavegacao, gerarBotoesLogs()]
                },
                'nav_mais': {
                    embeds: [gerarEmbedHome()],
                    components: [gerarBotoesNavegacao2()]
                },
                'nav_voltar': {
                    embeds: [gerarEmbedHome()],
                    components: [botoesNavegacao]
                },
                'nav_automacao': {
                    embeds: [gerarEmbedAutomacao(currentSc)],
                    components: [gerarBotoesNavegacao2(), gerarBotoesAutomacao()]
                },
                'nav_diversao': {
                    embeds: [gerarEmbedDiversao(currentSc)],
                    components: [gerarBotoesNavegacao2(), gerarBotoesDiversao(currentSc)]
                },
                'nav_morgan': {
                    embeds: [gerarEmbedMorgan(currentSc)],
                    components: [gerarBotoesNavegacao2(), gerarBotoesMorgan(currentSc)]
                },
            };

            if (navMap[i.customId]) {
                await i.update(navMap[i.customId]);
                return;
            }

            // ── Toggles ───────────────────────────────────────────────────────
            const mapeamentoToggle = {
                'toggle_flood':    { chave: 'antiflood',        grupo: 'chat' },
                'toggle_link':     { chave: 'antilink',         grupo: 'chat' },
                'toggle_invite':   { chave: 'antiinvite',       grupo: 'chat' },
                'toggle_caps':     { chave: 'anticaps',         grupo: 'chat' },
                'toggle_precon':   { chave: 'antipreconceito',  grupo: 'chat' },
                'toggle_spoiler':  { chave: 'antiSpoiler',      grupo: 'chat' },
                'toggle_emojis':   { chave: 'filtroEmojis',     grupo: 'chat' },
                'toggle_mencoes':  { chave: 'limiteMencoes',    grupo: 'chat' },
                'toggle_bot':      { chave: 'antibot',          grupo: 'seg'  },
                'toggle_nuke':     { chave: 'antinuke',         grupo: 'seg'  },
                'toggle_cargos':   { chave: 'anticargos',       grupo: 'seg'  },
                'toggle_fake':     { chave: 'antifake',         grupo: 'seg'  },
                'toggle_massban':  { chave: 'antiMassBan',      grupo: 'seg'  },
                'toggle_masskick': { chave: 'antiMassKick',     grupo: 'seg'  },
                'toggle_selfbot':  { chave: 'detectorSelfbots', grupo: 'seg'  },
                'toggle_automod':  { chave: 'autoModNomes',     grupo: 'seg'  },
                'toggle_xp':       { chave: 'xp_ativo',        grupo: 'fun'  },
                'toggle_coins':    { chave: 'coins_ativo',      grupo: 'fun'  },
                'toggle_limpeza':  { chave: 'limpezaAgendada',  grupo: 'auto' },
                'toggle_morgan':   { chave: 'morgan_ativo',     grupo: 'morgan' },
            };

            const togInfo = mapeamentoToggle[i.customId];
            if (togInfo) {
                configs[msg.guild.id][togInfo.chave] = !currentSc[togInfo.chave];
                salvarConfigs(configs);
                const { sc: upd } = obterConfigs();
                if (togInfo.grupo === 'chat') {
                    await i.update({ embeds: [gerarEmbedChat(upd)], components: [botoesNavegacao, gerarBotoesChat(upd), gerarBotoesChat2(upd)] });
                } else if (togInfo.grupo === 'seg') {
                    await i.update({ embeds: [gerarEmbedSeguranca(upd)], components: [botoesNavegacao, gerarBotoesSeguranca(upd), gerarBotoesSeguranca2(upd)] });
                } else if (togInfo.grupo === 'fun') {
                    await i.update({ embeds: [gerarEmbedDiversao(upd)], components: [gerarBotoesNavegacao2(), gerarBotoesDiversao(upd)] });
                } else if (togInfo.grupo === 'auto') {
                    await i.update({ embeds: [gerarEmbedAutomacao(upd)], components: [gerarBotoesNavegacao2(), gerarBotoesAutomacao()] });
                } else if (togInfo.grupo === 'morgan') {
                    await i.update({ embeds: [gerarEmbedMorgan(upd)], components: [gerarBotoesNavegacao2(), gerarBotoesMorgan(upd)] });
                }
                return;
            }

            // ── Limpar canais ─────────────────────────────────────────────────
            if (i.customId === 'clear_canal_fun') {
                configs[msg.guild.id].canal_fun = null;
                salvarConfigs(configs);
                const { sc: upd } = obterConfigs();
                await i.update({ embeds: [gerarEmbedDiversao(upd)], components: [gerarBotoesNavegacao2(), gerarBotoesDiversao(upd)] });
                return;
            }

            if (i.customId === 'clear_canal_morgan') {
                configs[msg.guild.id].morgan_canal = null;
                salvarConfigs(configs);
                const { sc: upd } = obterConfigs();
                await i.update({ embeds: [gerarEmbedMorgan(upd)], components: [gerarBotoesNavegacao2(), gerarBotoesMorgan(upd)] });
                return;
            }

            // ── Inputs de texto ───────────────────────────────────────────────
            const inputsDisponiveis = {
                'set_limite_flood':   { texto: '🌊 Digite o novo limite de flood (**2 a 20**):', chave: 'limiteFlood', tipo: 'numero' },
                'set_dias_fake':      { texto: '🎭 Idade mínima da conta em dias (**1 a 60**):', chave: 'diasFake',    tipo: 'numero' },
                'set_log_seg':        { texto: '🛡️ Mencione o canal para **Logs de Segurança**:', chave: 'logs_seguranca',  tipo: 'canal' },
                'set_log_staff':      { texto: '👮 Mencione o canal para **Logs de Staff**:', chave: 'logs_staff',          tipo: 'canal' },
                'set_log_msg':        { texto: '📝 Mencione o canal para **Logs de Mensagens**:', chave: 'logs_msg',         tipo: 'canal' },
                'set_log_join':       { texto: '🚪 Mencione o canal para **Logs de Entradas**:', chave: 'logs_join',         tipo: 'canal' },
                'set_log_anticargos': { texto: '🔰 Mencione o canal para **Logs Anti-Cargos**:', chave: 'logs_anticargos',   tipo: 'canal' },
                'set_auto_role':      { texto: '🎒 Mencione o cargo para o **Auto-Role**:', chave: 'autorole',               tipo: 'cargo' },
                'set_boas_vindas':    { texto: '👋 Mencione o canal para **Boas-Vindas**:', chave: 'msg_join',               tipo: 'canal' },
                'set_bypass':         { texto: '👑 Mencione o cargo para **Bypass (Imunidade)**:', chave: 'bypass_roles',    tipo: 'bypass' },
                'set_prot_cargo':     { texto: '🔒 Mencione o cargo para **Adicionar/Remover da Proteção**:', chave: 'cargos_protegidos', tipo: 'protecao' },
                'set_canal_fun':      { texto: '🎮 Mencione o canal de **Diversão**:', chave: 'canal_fun',                  tipo: 'canal' },
                'set_canal_morgan':   { texto: '🤖 Mencione o canal para a **I.A. Morgan**:', chave: 'morgan_canal',         tipo: 'canal' },
            };

            const inputAlvo = inputsDisponiveis[i.customId];
            if (!inputAlvo) return;

            await i.deferUpdate();
            const avisoChat = await msg.channel.send(
                `> ⌨️ <@${msg.author.id}> — ${inputAlvo.texto}\n> *Digite \`cancelar\` para abortar. (30s)*`
            );

            const coletorResposta = msg.channel.createMessageCollector({
                filter: (m) => m.author.id === msg.author.id,
                max: 1, time: 30_000,
            });

            coletorResposta.on('collect', async (m) => {
                await m.delete().catch(() => {});
                await avisoChat.delete().catch(() => {});
                if (m.content.toLowerCase() === 'cancelar') return;

                const { configs: dadosUpd } = obterConfigs();
                const scAlvo = dadosUpd[msg.guild.id];

                if (inputAlvo.tipo === 'numero') {
                    const val = parseInt(m.content);
                    if (!isNaN(val) && val > 0) scAlvo[inputAlvo.chave] = val;
                } else if (inputAlvo.tipo === 'canal') {
                    const ch = m.mentions.channels.first() || msg.guild.channels.cache.get(m.content.trim());
                    if (ch) scAlvo[inputAlvo.chave] = ch.id;
                } else if (inputAlvo.tipo === 'cargo') {
                    const r = m.mentions.roles.first() || msg.guild.roles.cache.get(m.content.trim());
                    if (r) scAlvo[inputAlvo.chave] = r.id;
                } else if (inputAlvo.tipo === 'bypass') {
                    const r = m.mentions.roles.first() || msg.guild.roles.cache.get(m.content.trim());
                    if (r) {
                        const idx = scAlvo.bypass_roles.indexOf(r.id);
                        idx > -1 ? scAlvo.bypass_roles.splice(idx, 1) : scAlvo.bypass_roles.push(r.id);
                    }
                } else if (inputAlvo.tipo === 'protecao') {
                    const cargo = m.mentions.roles.first() || msg.guild.roles.cache.get(m.content.trim());
                    if (cargo) {
                        const idx = scAlvo.cargos_protegidos.indexOf(cargo.id);
                        idx > -1 ? scAlvo.cargos_protegidos.splice(idx, 1) : scAlvo.cargos_protegidos.push(cargo.id);
                    }
                }

                salvarConfigs(dadosUpd);
                const { sc: freshSc } = obterConfigs();

                // Atualizar embed correto após salvar
                const logIds = ['set_log_seg','set_log_staff','set_log_msg','set_log_join','set_log_anticargos'];
                if (logIds.includes(i.customId)) {
                    await painelMensagem.edit({ embeds: [gerarEmbedLogs(freshSc)], components: [botoesNavegacao, gerarBotoesLogs()] });
                } else if (i.customId === 'set_prot_cargo' || i.customId === 'set_dias_fake') {
                    await painelMensagem.edit({ embeds: [gerarEmbedSeguranca(freshSc)], components: [botoesNavegacao, gerarBotoesSeguranca(freshSc), gerarBotoesSeguranca2(freshSc)] });
                } else if (['set_auto_role','set_boas_vindas','set_bypass'].includes(i.customId)) {
                    await painelMensagem.edit({ embeds: [gerarEmbedAutomacao(freshSc)], components: [gerarBotoesNavegacao2(), gerarBotoesAutomacao()] });
                } else if (i.customId === 'set_canal_fun') {
                    await painelMensagem.edit({ embeds: [gerarEmbedDiversao(freshSc)], components: [gerarBotoesNavegacao2(), gerarBotoesDiversao(freshSc)] });
                } else if (i.customId === 'set_canal_morgan') {
                    await painelMensagem.edit({ embeds: [gerarEmbedMorgan(freshSc)], components: [gerarBotoesNavegacao2(), gerarBotoesMorgan(freshSc)] });
                } else if (i.customId === 'set_limite_flood') {
                    await painelMensagem.edit({ embeds: [gerarEmbedChat(freshSc)], components: [botoesNavegacao, gerarBotoesChat(freshSc), gerarBotoesChat2(freshSc)] });
                }
            });

            coletorResposta.on('end', async (collected) => {
                if (collected.size === 0) await avisoChat.delete().catch(() => {});
            });
        });

        collector.on('end', async () => {
            try {
                const nav = gerarBotoesNavegacao();
                nav.components.forEach(btn => btn.setDisabled(true));
                await painelMensagem.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#2b2d31')
                            .setTitle('🛡️ Painel Encerrado')
                            .setDescription('> A sessão expirou. Use `r!painel` para abrir novamente.')
                            .setFooter({ text: 'RETH MORGAN V8' })
                    ],
                    components: [nav]
                }).catch(() => {});
            } catch {}
        });
    },
};
