'use strict';
// ============================================================
//  RETH MORGAN — PAINEL V9 (REMASTER + BLACKLIST)
//  Tema: Dexter Morgan | Foto executor/bot | Todos os logs
//  GIF de ban configurável | Confirmações configuráveis
//  BLACKLIST: embed + log canal integrado
// ============================================================
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs   = require('fs');
const path = require('path');

module.exports = {
    name: 'painel',
    aliases: ['config', 'dashboard', 'setup', 'panel'],

    execute: async (msg, args, client, OWNER_ID) => {
        const OWNER_IDS    = [OWNER_ID, '1507543140800921610'];
        const eDonoSupremo = OWNER_IDS.includes(msg.author.id);
        const eDonoServer  = msg.author.id === msg.guild.ownerId;

        if (!eDonoSupremo && !eDonoServer) {
            return msg.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#8B0000')
                    .setAuthor({ name: 'RETH MORGAN — ACESSO NEGADO', iconURL: client.user.displayAvatarURL() })
                    .setDescription('👑 Apenas o **Proprietário do Servidor** ou o **Desenvolvedor Supremo** podem acessar o painel.')
                    .setTimestamp()
                ]
            });
        }

        // ─── I/O ─────────────────────────────────────────────────

        function obterConfigs() {
            let configs = {};
            try {
                const raw = fs.readFileSync('./database/config.json', 'utf-8');
                if (raw.trim()) configs = JSON.parse(raw);
            } catch { configs = {}; }
            if (!configs[msg.guild.id]) configs[msg.guild.id] = {};
            const sc = configs[msg.guild.id];
            const defaults = {
                // Chat
                antiflood: false, limiteFlood: 5,
                antilink: false, antiinvite: false,
                anticaps: false, antipreconceito: false,
                antiSpoiler: false, filtroEmojis: false, maxEmojis: 10,
                limiteMencoes: false, maxMencoes: 5,
                // Segurança
                antibot: false, antinuke: false,
                anticargos: false, cargos_protegidos: [],
                antifake: false, diasFake: 7,
                antiMassBan: false, maxBans: 5,
                antiMassKick: false, maxKicks: 5,
                detectorSelfbots: false,
                autoModNomes: false,
                // Logs
                logs_seguranca: null, logs_staff: null,
                logs_msg: null, logs_join: null,
                logs_anticargos: null,
                logs_ban: null, logs_castigo: null, logs_mute: null,
                logs_warn: null, logs_blacklist: null,
                // Automação
                autorole: null, msg_join: null, bypass_roles: [],
                whitelistIds: '',
                autoPunicaoWarns: 3,
                limpezaAgendada: false, horasLimpeza: 24,
                // Diversão
                canal_fun: null, xp_ativo: true, coins_ativo: true,
                // I.A.
                morgan_ativo: false, morgan_canal: null,
                // Punições
                ban_confirmacao: true, castigo_confirmacao: true,
                gif_ban: '',
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

        function lerBlacklistTotal() {
            try {
                const raw = fs.readFileSync('./database/blacklist.json', 'utf-8');
                const p   = JSON.parse(raw);
                if (Array.isArray(p)) return { total: p.length, recente: null };
                const keys   = Object.keys(p);
                const total  = keys.length;
                if (total === 0) return { total: 0, recente: null };
                const sorted = Object.entries(p).sort((a, b) =>
                    new Date(b[1].addedAt || 0) - new Date(a[1].addedAt || 0)
                );
                return { total, recente: sorted[0][1].tag || sorted[0][0] };
            } catch { return { total: 0, recente: null }; }
        }

        // ─── Helpers de display ───────────────────────────────────

        const on  = (v) => v ? '🟢 `ATIVO`'  : '🔴 `INATIVO`';
        const onB = (v) => v ? '✅ `ATIVO`'   : '❌ `DESATIVADO`';
        const ch  = (id) => id ? `<#${id}>`    : '`Não definido`';
        const ro  = (id) => id ? `<@&${id}>`   : '`Não definido`';

        const botAvatar  = client.user.displayAvatarURL({ size: 256 });
        const guildIcon  = msg.guild.iconURL({ size: 256 }) || botAvatar;
        const execAvatar = msg.author.displayAvatarURL({ dynamic: true, size: 256 });

        // ─── EMBEDS ───────────────────────────────────────────────

        function embedHome() {
            return new EmbedBuilder()
                .setColor('#8B0000')
                .setAuthor({ name: `RETH MORGAN — CENTRAL DE CONTROLE`, iconURL: botAvatar })
                .setThumbnail(guildIcon)
                .setTitle(`🩸 PAINEL DO SERVIDOR — ${msg.guild.name.toUpperCase()}`)
                .setDescription(
                    '```\n' +
                    '   SHIELD SYSTEM V8 · DEXTER PROTOCOL\n' +
                    '   "Toda boa morte precisa de planejamento."\n' +
                    '```\n' +
                    '**Navegue pelas seções para configurar o sistema:**\n\n' +
                    '🛑 **Chat** — Filtros e moderação de mensagens\n' +
                    '☢️ **Segurança** — Proteções anti-raid e nuke\n' +
                    '📋 **Logs** — Canais de registro (ban, mute, castigo...)\n' +
                    '⚙️ **Automação** — Auto-role, boas-vindas, warns\n' +
                    '🎮 **Diversão** — Canal fun, XP e economy\n' +
                    '🤖 **I.A. Morgan** — IA e canal exclusivo\n' +
                    '🔫 **Punições** — GIF ban, confirmações, whitelist\n' +
                    '🩸 **Blacklist** — Lista negra global do bot'
                )
                .addFields(
                    { name: '👤 Operador', value: `<@${msg.author.id}>\n\`${msg.author.tag}\``, inline: true },
                    { name: '📅 Sessão',   value: `<t:${Math.floor(Date.now()/1000)}:R>`,        inline: true },
                    { name: '🤖 Bot',      value: `\`${client.user.tag}\``,                      inline: true }
                )
                .setImage(msg.guild.bannerURL({ size: 1024 }) || null)
                .setFooter({ text: `Shield System V8 · Aberto por ${msg.author.tag}`, iconURL: execAvatar })
                .setTimestamp();
        }

        function embedChat(sc) {
            return new EmbedBuilder()
                .setColor('#c0392b')
                .setAuthor({ name: 'RETH MORGAN — MÓDULO CHAT', iconURL: botAvatar })
                .setThumbnail(botAvatar)
                .setTitle('🛑 FILTROS DE MODERAÇÃO DE CHAT')
                .setDescription('```\n"Cada mensagem é uma pista. Cada spam, um crime."\n```')
                .addFields(
                    { name: '🌊 Anti-Flood',      value: `${on(sc.antiflood)}\nLimite: \`${sc.limiteFlood} msgs/4s\``, inline: true },
                    { name: '🔗 Anti-Links',       value: on(sc.antilink),                                               inline: true },
                    { name: '📩 Anti-Convites',    value: on(sc.antiinvite),                                             inline: true },
                    { name: '🔠 Anti-Caps Lock',   value: on(sc.anticaps),                                               inline: true },
                    { name: '🤬 Anti-Preconceito', value: on(sc.antipreconceito),                                        inline: true },
                    { name: '🙈 Anti-Spoiler',     value: on(sc.antiSpoiler),                                            inline: true },
                    { name: '😅 Filtro Emojis',    value: `${on(sc.filtroEmojis)}\nMáx: \`${sc.maxEmojis}\``,          inline: true },
                    { name: '📣 Limite Menções',   value: `${on(sc.limiteMencoes)}\nMáx: \`${sc.maxMencoes}\``,        inline: true },
                    { name: '🤖 Detector Selfbot', value: on(sc.detectorSelfbots),                                      inline: true },
                )
                .setFooter({ text: `Shield System V8 · ${msg.guild.name}`, iconURL: guildIcon })
                .setTimestamp();
        }

        function embedSeguranca(sc) {
            const listaCargos = sc.cargos_protegidos.length > 0
                ? sc.cargos_protegidos.map(id => `<@&${id}>`).join(', ')
                : '`Nenhum cargo protegido`';
            return new EmbedBuilder()
                .setColor('#8B0000')
                .setAuthor({ name: 'RETH MORGAN — MÓDULO SEGURANÇA', iconURL: botAvatar })
                .setThumbnail(botAvatar)
                .setTitle('☢️ PROTOCOLOS ANTI-RAID & INVASÃO')
                .setDescription('```\n"Prepare a sala de instrumentos. Invasores serão tratados."\n```')
                .addFields(
                    { name: '🤖 Anti-Bot Invasor', value: on(sc.antibot),            inline: true },
                    { name: '💣 Anti-Nuke',         value: on(sc.antinuke),           inline: true },
                    { name: '🎭 Anti-Fake',         value: `${on(sc.antifake)}\nMínimo: \`${sc.diasFake}d\``, inline: true },
                    { name: '🔰 Anti-Cargos',       value: on(sc.anticargos),         inline: true },
                    { name: '🔨 Anti-Mass Ban',     value: `${on(sc.antiMassBan)}\nLimite: \`${sc.maxBans}\``, inline: true },
                    { name: '👢 Anti-Mass Kick',    value: `${on(sc.antiMassKick)}\nLimite: \`${sc.maxKicks}\``, inline: true },
                    { name: '📝 Auto-Mod Nomes',    value: on(sc.autoModNomes),       inline: true },
                    { name: '\u200b',               value: '\u200b',                  inline: true },
                    { name: '\u200b',               value: '\u200b',                  inline: true },
                    { name: '🔒 Cargos Protegidos', value: listaCargos,               inline: false },
                )
                .setFooter({ text: `Shield System V8 · ${msg.guild.name}`, iconURL: guildIcon })
                .setTimestamp();
        }

        function embedLogs(sc) {
            return new EmbedBuilder()
                .setColor('#9b59b6')
                .setAuthor({ name: 'RETH MORGAN — MÓDULO LOGS', iconURL: botAvatar })
                .setThumbnail(botAvatar)
                .setTitle('📋 CANAIS DE LOGS & REGISTROS')
                .setDescription('```\n"Um bom assassino mantém registros. Morgan também."\n```')
                .addFields(
                    { name: '🛡️ Segurança',         value: ch(sc.logs_seguranca),  inline: true },
                    { name: '👮 Staff',              value: ch(sc.logs_staff),      inline: true },
                    { name: '📝 Mensagens',          value: ch(sc.logs_msg),        inline: true },
                    { name: '🚪 Entradas/Saídas',    value: ch(sc.logs_join),       inline: true },
                    { name: '🔰 Anti-Cargos',        value: ch(sc.logs_anticargos), inline: true },
                    { name: '🔨 Ban/Unban',          value: ch(sc.logs_ban),        inline: true },
                    { name: '⏱️ Castigo/Descastigo', value: ch(sc.logs_castigo),    inline: true },
                    { name: '🔇 Mute/Unmute',        value: ch(sc.logs_mute),       inline: true },
                    { name: '⚠️ Warns',              value: ch(sc.logs_warn),       inline: true },
                    { name: '🩸 Blacklist',          value: ch(sc.logs_blacklist),  inline: true },
                )
                .setFooter({ text: `Shield System V8 · ${msg.guild.name}`, iconURL: guildIcon })
                .setTimestamp();
        }

        function embedAutomacao(sc) {
            const bypass = sc.bypass_roles.length > 0 ? sc.bypass_roles.map(id => `<@&${id}>`).join(', ') : '`Nenhum`';
            return new EmbedBuilder()
                .setColor('#27ae60')
                .setAuthor({ name: 'RETH MORGAN — MÓDULO AUTOMAÇÃO', iconURL: botAvatar })
                .setThumbnail(botAvatar)
                .setTitle('⚙️ AUTOMAÇÃO & CONFIGURAÇÕES GERAIS')
                .setDescription('```\n"Cada protocolo deve ser executado com precisão."\n```')
                .addFields(
                    { name: '🎒 Auto-Role',          value: ro(sc.autorole),              inline: true },
                    { name: '👋 Canal Boas-Vindas',  value: ch(sc.msg_join),              inline: true },
                    { name: '⚠️ Auto-Ban por Warns', value: `\`${sc.autoPunicaoWarns} warns\``, inline: true },
                    { name: '🧹 Limpeza Agendada',   value: `${on(sc.limpezaAgendada)}\nIntervalo: \`${sc.horasLimpeza}h\``, inline: true },
                    { name: '👑 Whitelist (IDs)',     value: sc.whitelistIds ? `\`${sc.whitelistIds.slice(0,60)}...\`` : '`Não configurada`', inline: false },
                    { name: '🛡️ Cargos Imunes',      value: bypass, inline: false },
                )
                .setFooter({ text: `Shield System V8 · ${msg.guild.name}`, iconURL: guildIcon })
                .setTimestamp();
        }

        function embedDiversao(sc) {
            return new EmbedBuilder()
                .setColor('#e91e8c')
                .setAuthor({ name: 'RETH MORGAN — MÓDULO DIVERSÃO', iconURL: botAvatar })
                .setThumbnail(botAvatar)
                .setTitle('🎮 SISTEMA DE DIVERSÃO')
                .setDescription('```\n"Até Morgan precisa de um intervalo."\n```')
                .addFields(
                    { name: '🎯 Canal de Fun',  value: `${ch(sc.canal_fun)}\n↳ Comandos fun restritos aqui`, inline: false },
                    { name: '⭐ Sistema de XP', value: on(sc.xp_ativo),    inline: true },
                    { name: '💰 Economy',       value: on(sc.coins_ativo), inline: true },
                )
                .setFooter({ text: `Shield System V8 · ${msg.guild.name}`, iconURL: guildIcon })
                .setTimestamp();
        }

        function embedMorgan(sc) {
            return new EmbedBuilder()
                .setColor('#5865f2')
                .setAuthor({ name: 'RETH MORGAN — MÓDULO I.A.', iconURL: botAvatar })
                .setThumbnail(botAvatar)
                .setTitle('🤖 I.A. MORGAN — INTELIGÊNCIA ARTIFICIAL')
                .setDescription('```\n"Processo, analiso, respondo. Sou Morgan."\n```')
                .addFields(
                    { name: '⚡ Status da I.A.',
                      value: `${on(sc.morgan_ativo)}\n↳ Responde no canal e quando chamado por nome`, inline: false },
                    { name: '📢 Canal Exclusivo',
                      value: `${ch(sc.morgan_canal)}\n↳ I.A. responde todas as msgs aqui`, inline: false },
                )
                .setFooter({ text: `Chamar "Morgan" em qualquer canal também ativa · Shield V8`, iconURL: guildIcon })
                .setTimestamp();
        }

        function embedPunicoes(sc) {
            return new EmbedBuilder()
                .setColor('#8B0000')
                .setAuthor({ name: 'RETH MORGAN — MÓDULO PUNIÇÕES', iconURL: botAvatar })
                .setThumbnail(botAvatar)
                .setTitle('🔫 CONFIGURAÇÕES DE PUNIÇÕES')
                .setDescription('```\n"Cada punição é uma obra de arte. Planejada. Calculada."\n```')
                .addFields(
                    { name: '✅ Confirmação de Ban',     value: onB(sc.ban_confirmacao),     inline: true },
                    { name: '✅ Confirmação de Castigo', value: onB(sc.castigo_confirmacao), inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '🎬 GIF de Ban', value: sc.gif_ban
                        ? `[Link configurado](${sc.gif_ban})\n\`${sc.gif_ban.slice(0, 60)}...\``
                        : '`Não configurado`\n↳ Sem GIF no ban', inline: false },
                )
                .setFooter({ text: `Shield System V8 · ${msg.guild.name}`, iconURL: guildIcon })
                .setTimestamp();
        }

        function embedBlacklist(sc) {
            const { total, recente } = lerBlacklistTotal();
            const ehDono = OWNER_IDS.includes(msg.author.id);
            return new EmbedBuilder()
                .setColor('#8B0000')
                .setAuthor({ name: 'RETH MORGAN — BLACKLIST GLOBAL', iconURL: botAvatar })
                .setThumbnail(botAvatar)
                .setTitle('🩸 LISTA NEGRA — CONTROLE GLOBAL DE ACESSO')
                .setDescription(
                    '```\n"Uma lista de alvos. Cada nome aqui é uma sentença."\n```\n' +
                    'Usuários na blacklist são **bloqueados de usar qualquer comando** do bot em qualquer servidor.\n\n' +
                    (ehDono ? '👑 **Você tem acesso completo ao sistema.**' : '⚠️ **Visualização apenas. Gerenciamento exclusivo dos donos do bot.**')
                )
                .addFields(
                    { name: '📊 Total banidos',   value: `\`${total}\` usuário${total !== 1 ? 's' : ''}`, inline: true },
                    { name: '🕐 Último inscrito', value: recente ? `\`${recente}\`` : '`Nenhum`',          inline: true },
                    { name: '📋 Canal de Logs',   value: ch(sc.logs_blacklist),                            inline: true },
                    { name: '⚙️ Comandos (donos do bot apenas)',
                      value:
                        '`r!bl add @user [motivo]` — Inscrever\n' +
                        '`r!bl remove @user` — Liberar\n' +
                        '`r!bl list` — Listar todos\n' +
                        '`r!bl info @user` — Ver ficha completa\n' +
                        '`r!bl wipe` — Apagar tudo',
                      inline: false },
                )
                .setFooter({ text: `Shield System V8 · Acesso restrito — Donos do Bot`, iconURL: guildIcon })
                .setTimestamp();
        }

        // ─── BOTÕES ───────────────────────────────────────────────

        function navRow1() {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('nav_home').setLabel('🏠 Início').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('nav_chat').setLabel('🛑 Chat').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('nav_seg').setLabel('☢️ Segurança').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('nav_logs').setLabel('📋 Logs').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('nav_pg2').setLabel('Mais ▶').setStyle(ButtonStyle.Secondary),
            );
        }
        function navRow2() {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('nav_home').setLabel('🏠 Início').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('nav_auto').setLabel('⚙️ Automação').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('nav_fun').setLabel('🎮 Diversão').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('nav_ia').setLabel('🤖 I.A.').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('nav_pg3').setLabel('Mais ▶').setStyle(ButtonStyle.Secondary),
            );
        }
        function navRow3() {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('nav_home').setLabel('🏠 Início').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('nav_pun').setLabel('🔫 Punições').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('nav_bl').setLabel('🩸 Blacklist').setStyle(ButtonStyle.Danger),
            );
        }

        function rowChat(sc) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('t_flood').setLabel('Flood').setEmoji(sc.antiflood ? '🟢' : '🔴').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_flood_lim').setLabel('Lim.Flood').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('t_link').setLabel('Links').setEmoji(sc.antilink ? '🟢' : '🔴').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('t_invite').setLabel('Convites').setEmoji(sc.antiinvite ? '🟢' : '🔴').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('t_precon').setLabel('Anti-Ódio').setEmoji(sc.antipreconceito ? '🟢' : '🔴').setStyle(ButtonStyle.Secondary),
            );
        }
        function rowChat2(sc) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('t_caps').setLabel('Caps').setEmoji(sc.anticaps ? '🟢' : '🔴').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('t_spoiler').setLabel('Spoiler').setEmoji(sc.antiSpoiler ? '🟢' : '🔴').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('t_emojis').setLabel('Emojis').setEmoji(sc.filtroEmojis ? '🟢' : '🔴').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('t_mencoes').setLabel('Menções').setEmoji(sc.limiteMencoes ? '🟢' : '🔴').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('t_selfbot').setLabel('Selfbot').setEmoji(sc.detectorSelfbots ? '🟢' : '🔴').setStyle(ButtonStyle.Secondary),
            );
        }

        function rowSeg(sc) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('t_bot').setLabel('Anti-Bot').setEmoji(sc.antibot ? '🟢' : '🔴').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('t_nuke').setLabel('Anti-Nuke').setEmoji(sc.antinuke ? '🟢' : '🔴').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('t_fake').setLabel('Anti-Fake').setEmoji(sc.antifake ? '🟢' : '🔴').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('t_cargos').setLabel('Anti-Cargos').setEmoji(sc.anticargos ? '🟢' : '🔴').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('t_nomes').setLabel('Auto-Nomes').setEmoji(sc.autoModNomes ? '🟢' : '🔴').setStyle(ButtonStyle.Secondary),
            );
        }
        function rowSeg2(sc) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('t_mban').setLabel('Anti-MassBan').setEmoji(sc.antiMassBan ? '🟢' : '🔴').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('t_mkick').setLabel('Anti-MassKick').setEmoji(sc.antiMassKick ? '🟢' : '🔴').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_prot_cargo').setLabel('Proteger Cargo').setEmoji('🔒').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('set_dias_fake').setLabel('Dias Fake').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
            );
        }

        function rowLogs() {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('set_log_seg').setLabel('Segurança').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_log_staff').setLabel('Staff').setEmoji('👮').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_log_msg').setLabel('Mensagens').setEmoji('📝').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_log_join').setLabel('Join/Leave').setEmoji('🚪').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_log_anticargos').setLabel('Anti-Cargos').setEmoji('🔰').setStyle(ButtonStyle.Secondary),
            );
        }
        function rowLogs2() {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('set_log_ban').setLabel('Ban/Unban').setEmoji('🔨').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('set_log_castigo').setLabel('Castigo').setEmoji('⏱️').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('set_log_mute').setLabel('Mute/Unmute').setEmoji('🔇').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('set_log_warn').setLabel('Warns').setEmoji('⚠️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_log_blacklist').setLabel('Blacklist').setEmoji('🩸').setStyle(ButtonStyle.Danger),
            );
        }

        function rowAuto() {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('set_autorole').setLabel('Auto-Role').setEmoji('🎒').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_bvindas').setLabel('Boas-Vindas').setEmoji('👋').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_bypass').setLabel('Imunes').setEmoji('👑').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_warns_limit').setLabel('Warns p/ Ban').setEmoji('⚠️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_whitelist').setLabel('Whitelist').setEmoji('📋').setStyle(ButtonStyle.Primary),
            );
        }
        function rowAuto2(sc) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('t_limpeza').setLabel('Limpeza Auto').setEmoji(sc.limpezaAgendada ? '🟢' : '🔴').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_horas_limpeza').setLabel('Horas Limpeza').setEmoji('⏰').setStyle(ButtonStyle.Secondary),
            );
        }

        function rowFun(sc) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('set_canal_fun').setLabel('Canal Fun').setEmoji('🎯').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('clear_canal_fun').setLabel('Limpar Canal').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('t_xp').setLabel('XP').setEmoji(sc.xp_ativo ? '🟢' : '🔴').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('t_coins').setLabel('Economy').setEmoji(sc.coins_ativo ? '🟢' : '🔴').setStyle(ButtonStyle.Secondary),
            );
        }

        function rowIA(sc) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('t_morgan')
                    .setLabel(sc.morgan_ativo ? '🟢 Desativar I.A.' : '🔴 Ativar I.A.')
                    .setStyle(sc.morgan_ativo ? ButtonStyle.Success : ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('set_canal_morgan').setLabel('Definir Canal').setEmoji('📢').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('clear_canal_morgan').setLabel('Limpar Canal').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
            );
        }

        function rowPun(sc) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('t_ban_confirm')
                    .setLabel('Confirm. Ban')
                    .setEmoji(sc.ban_confirmacao ? '✅' : '❌')
                    .setStyle(sc.ban_confirmacao ? ButtonStyle.Success : ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('t_castigo_confirm')
                    .setLabel('Confirm. Castigo')
                    .setEmoji(sc.castigo_confirmacao ? '✅' : '❌')
                    .setStyle(sc.castigo_confirmacao ? ButtonStyle.Success : ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('set_gif_ban').setLabel('GIF de Ban').setEmoji('🎬').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('clear_gif_ban').setLabel('Limpar GIF').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
            );
        }

        function rowBlacklist(sc) {
            const ehDono = OWNER_IDS.includes(msg.author.id);
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('set_log_blacklist')
                    .setLabel('Definir Canal Log BL')
                    .setEmoji('📋')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(!ehDono),
                new ButtonBuilder()
                    .setCustomId('clear_log_blacklist')
                    .setLabel('Limpar Log BL')
                    .setEmoji('🗑️')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(!ehDono),
            );
        }

        // ─── ENVIO INICIAL ────────────────────────────────────────

        const painelMsg = await msg.channel.send({
            embeds: [embedHome()],
            components: [navRow1()],
        });

        // ─── MAPA DE NAVEGAÇÃO ────────────────────────────────────

        function navItems(sc) {
            return {
                'nav_home': { e: embedHome(),         c: [navRow1()] },
                'nav_chat': { e: embedChat(sc),       c: [navRow1(), rowChat(sc), rowChat2(sc)] },
                'nav_seg':  { e: embedSeguranca(sc),  c: [navRow1(), rowSeg(sc), rowSeg2(sc)] },
                'nav_logs': { e: embedLogs(sc),       c: [navRow1(), rowLogs(), rowLogs2()] },
                'nav_pg2':  { e: embedHome(),         c: [navRow2()] },
                'nav_auto': { e: embedAutomacao(sc),  c: [navRow2(), rowAuto(), rowAuto2(sc)] },
                'nav_fun':  { e: embedDiversao(sc),   c: [navRow2(), rowFun(sc)] },
                'nav_ia':   { e: embedMorgan(sc),     c: [navRow2(), rowIA(sc)] },
                'nav_pg3':  { e: embedHome(),         c: [navRow3()] },
                'nav_pun':  { e: embedPunicoes(sc),   c: [navRow3(), rowPun(sc)] },
                'nav_bl':   { e: embedBlacklist(sc),  c: [navRow3(), rowBlacklist(sc)] },
            };
        }

        const toggleMap = {
            't_flood':           'antiflood',
            't_link':            'antilink',
            't_invite':          'antiinvite',
            't_caps':            'anticaps',
            't_precon':          'antipreconceito',
            't_spoiler':         'antiSpoiler',
            't_emojis':          'filtroEmojis',
            't_mencoes':         'limiteMencoes',
            't_selfbot':         'detectorSelfbots',
            't_bot':             'antibot',
            't_nuke':            'antinuke',
            't_fake':            'antifake',
            't_cargos':          'anticargos',
            't_nomes':           'autoModNomes',
            't_mban':            'antiMassBan',
            't_mkick':           'antiMassKick',
            't_xp':              'xp_ativo',
            't_coins':           'coins_ativo',
            't_morgan':          'morgan_ativo',
            't_ban_confirm':     'ban_confirmacao',
            't_castigo_confirm': 'castigo_confirmacao',
            't_limpeza':         'limpezaAgendada',
        };

        const inputMap = {
            'set_flood_lim':      { txt: '🌊 Novo limite de flood (2-20 mensagens):', chave: 'limiteFlood',    tipo: 'num' },
            'set_dias_fake':      { txt: '🎭 Idade mínima da conta em dias (1-60):', chave: 'diasFake',        tipo: 'num' },
            'set_log_seg':        { txt: '🛡️ Mencione o canal de **Logs de Segurança**:', chave: 'logs_seguranca',    tipo: 'canal' },
            'set_log_staff':      { txt: '👮 Mencione o canal de **Logs de Staff**:', chave: 'logs_staff',            tipo: 'canal' },
            'set_log_msg':        { txt: '📝 Mencione o canal de **Logs de Mensagens**:', chave: 'logs_msg',          tipo: 'canal' },
            'set_log_join':       { txt: '🚪 Mencione o canal de **Join/Leave**:', chave: 'logs_join',                tipo: 'canal' },
            'set_log_anticargos': { txt: '🔰 Mencione o canal de **Anti-Cargos**:', chave: 'logs_anticargos',        tipo: 'canal' },
            'set_log_ban':        { txt: '🔨 Mencione o canal de **Ban/Unban**:', chave: 'logs_ban',                  tipo: 'canal' },
            'set_log_castigo':    { txt: '⏱️ Mencione o canal de **Castigo/Descastigo**:', chave: 'logs_castigo',    tipo: 'canal' },
            'set_log_mute':       { txt: '🔇 Mencione o canal de **Mute/Unmute**:', chave: 'logs_mute',              tipo: 'canal' },
            'set_log_warn':       { txt: '⚠️ Mencione o canal de **Warns**:', chave: 'logs_warn',                    tipo: 'canal' },
            'set_log_blacklist':  { txt: '🩸 Mencione o canal de **Logs da Blacklist**:', chave: 'logs_blacklist',    tipo: 'canal' },
            'set_autorole':       { txt: '🎒 Mencione o **Auto-Role** (cargo automático):', chave: 'autorole',        tipo: 'cargo' },
            'set_bvindas':        { txt: '👋 Mencione o canal de **Boas-Vindas**:', chave: 'msg_join',                tipo: 'canal' },
            'set_bypass':         { txt: '👑 Mencione o cargo para **Adicionar/Remover** da imunidade:', chave: 'bypass_roles',      tipo: 'bypass' },
            'set_prot_cargo':     { txt: '🔒 Mencione o cargo para **Proteger/Desproteger**:', chave: 'cargos_protegidos',           tipo: 'protecao' },
            'set_canal_fun':      { txt: '🎮 Mencione o **Canal de Fun**:', chave: 'canal_fun',                       tipo: 'canal' },
            'set_canal_morgan':   { txt: '🤖 Mencione o canal para a **I.A. Morgan**:', chave: 'morgan_canal',        tipo: 'canal' },
            'set_gif_ban':        { txt: '🎬 Digite a **URL do GIF** de ban (ex: https://tenor.com/...):', chave: 'gif_ban',         tipo: 'texto' },
            'set_warns_limit':    { txt: '⚠️ Quantos warns antes do auto-ban? (1-10):', chave: 'autoPunicaoWarns',   tipo: 'num' },
            'set_horas_limpeza':  { txt: '🧹 A cada quantas horas fazer a limpeza? (1-72):', chave: 'horasLimpeza',  tipo: 'num' },
            'set_whitelist':      { txt: '📋 Digite os IDs separados por vírgula para a whitelist:', chave: 'whitelistIds', tipo: 'texto' },
        };

        const clearMap = {
            'clear_canal_fun':    { chave: 'canal_fun',      nav: 'nav_fun' },
            'clear_canal_morgan': { chave: 'morgan_canal',   nav: 'nav_ia'  },
            'clear_gif_ban':      { chave: 'gif_ban',        nav: 'nav_pun' },
            'clear_log_blacklist':{ chave: 'logs_blacklist', nav: 'nav_bl'  },
        };

        function voltarEmbedAposInput(customId, sc) {
            const logIds = ['set_log_seg','set_log_staff','set_log_msg','set_log_join','set_log_anticargos','set_log_ban','set_log_castigo','set_log_mute','set_log_warn'];
            if (customId === 'set_log_blacklist')                                               return { e: embedBlacklist(sc),  c: [navRow3(), rowBlacklist(sc)] };
            if (logIds.includes(customId))                                                      return { e: embedLogs(sc),       c: [navRow1(), rowLogs(), rowLogs2()] };
            if (['set_prot_cargo','set_dias_fake'].includes(customId))                          return { e: embedSeguranca(sc),  c: [navRow1(), rowSeg(sc), rowSeg2(sc)] };
            if (['set_autorole','set_bvindas','set_bypass','set_warns_limit','set_whitelist','set_horas_limpeza'].includes(customId))
                                                                                                return { e: embedAutomacao(sc),  c: [navRow2(), rowAuto(), rowAuto2(sc)] };
            if (customId === 'set_canal_fun')                                                   return { e: embedDiversao(sc),   c: [navRow2(), rowFun(sc)] };
            if (customId === 'set_canal_morgan')                                                return { e: embedMorgan(sc),     c: [navRow2(), rowIA(sc)] };
            if (['set_gif_ban','t_ban_confirm','t_castigo_confirm'].includes(customId))         return { e: embedPunicoes(sc),   c: [navRow3(), rowPun(sc)] };
            if (customId === 'set_flood_lim')                                                   return { e: embedChat(sc),       c: [navRow1(), rowChat(sc), rowChat2(sc)] };
            return { e: embedHome(), c: [navRow1()] };
        }

        // ─── COLLECTOR ────────────────────────────────────────────

        const collector = painelMsg.createMessageComponentCollector({
            filter: (i) => i.user.id === msg.author.id,
            time: 10 * 60 * 1000,
        });

        collector.on('collect', async (i) => {
            const { configs, sc } = obterConfigs();
            const id = i.customId;

            const nav = navItems(sc);
            if (nav[id]) {
                await i.update({ embeds: [nav[id].e], components: nav[id].c });
                return;
            }

            if (clearMap[id]) {
                configs[msg.guild.id][clearMap[id].chave] = clearMap[id].chave === 'gif_ban' ? '' : null;
                salvarConfigs(configs);
                const { sc: upd } = obterConfigs();
                const navUpd = navItems(upd);
                await i.update({ embeds: [navUpd[clearMap[id].nav].e], components: navUpd[clearMap[id].nav].c });
                return;
            }

            if (toggleMap[id]) {
                configs[msg.guild.id][toggleMap[id]] = !sc[toggleMap[id]];
                salvarConfigs(configs);
                const { sc: upd } = obterConfigs();

                const chatToggles = ['t_flood','t_link','t_invite','t_caps','t_precon','t_spoiler','t_emojis','t_mencoes','t_selfbot'];
                const segToggles  = ['t_bot','t_nuke','t_fake','t_cargos','t_nomes','t_mban','t_mkick'];
                const funToggles  = ['t_xp','t_coins'];

                if (chatToggles.includes(id))     await i.update({ embeds: [embedChat(upd)],      components: [navRow1(), rowChat(upd), rowChat2(upd)] });
                else if (segToggles.includes(id)) await i.update({ embeds: [embedSeguranca(upd)], components: [navRow1(), rowSeg(upd), rowSeg2(upd)] });
                else if (funToggles.includes(id)) await i.update({ embeds: [embedDiversao(upd)],  components: [navRow2(), rowFun(upd)] });
                else if (id === 't_morgan')       await i.update({ embeds: [embedMorgan(upd)],    components: [navRow2(), rowIA(upd)] });
                else if (id === 't_ban_confirm' || id === 't_castigo_confirm')
                    await i.update({ embeds: [embedPunicoes(upd)], components: [navRow3(), rowPun(upd)] });
                else if (id === 't_limpeza')      await i.update({ embeds: [embedAutomacao(upd)], components: [navRow2(), rowAuto(), rowAuto2(upd)] });
                return;
            }

            const inputAlvo = inputMap[id];
            if (!inputAlvo) return;

            // Trava: set_log_blacklist só para donos do bot
            if (id === 'set_log_blacklist' && !OWNER_IDS.includes(msg.author.id)) {
                await i.reply({ content: '🩸 Apenas donos do bot podem configurar o canal de logs da Blacklist.', ephemeral: true });
                return;
            }

            await i.deferUpdate();
            const avisoMsg = await msg.channel.send(
                `⌨️ <@${msg.author.id}>, ${inputAlvo.txt}\n*Digite \`cancelar\` para abortar. (30s)*`
            );

            const coletorTxt = msg.channel.createMessageCollector({
                filter: (m) => m.author.id === msg.author.id,
                max: 1, time: 30_000,
            });

            coletorTxt.on('collect', async (m) => {
                await m.delete().catch(() => {});
                await avisoMsg.delete().catch(() => {});
                if (m.content.toLowerCase() === 'cancelar') return;

                const { configs: dadosUpd } = obterConfigs();
                const scAlvo = dadosUpd[msg.guild.id];

                if (inputAlvo.tipo === 'num') {
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
                    const r = m.mentions.roles.first() || msg.guild.roles.cache.get(m.content.trim());
                    if (r) {
                        const idx = scAlvo.cargos_protegidos.indexOf(r.id);
                        idx > -1 ? scAlvo.cargos_protegidos.splice(idx, 1) : scAlvo.cargos_protegidos.push(r.id);
                    }
                } else if (inputAlvo.tipo === 'texto') {
                    scAlvo[inputAlvo.chave] = m.content.trim();
                }

                salvarConfigs(dadosUpd);
                const { sc: freshSc } = obterConfigs();
                const vol = voltarEmbedAposInput(id, freshSc);
                await painelMsg.edit({ embeds: [vol.e], components: vol.c });
            });

            coletorTxt.on('end', async (col) => {
                if (col.size === 0) await avisoMsg.delete().catch(() => {});
            });
        });

        collector.on('end', async () => {
            const nav = navRow1();
            nav.components.forEach(b => b.setDisabled(true));
            await painelMsg.edit({ components: [nav] }).catch(() => {});
        });
    }
};
