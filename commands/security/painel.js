// commands/security/painel.js
// Requer: discord.js v14+, Node 18+
'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs   = require('fs');
const path = require('path');

module.exports = {
    name: 'painel',
    aliases: ['config', 'dashboard', 'setup'],

    execute: async (msg, args, client, OWNER_ID) => {
        const eDonoSupremo = msg.author.id === OWNER_ID;
        const eDonoServer  = msg.author.id === msg.guild.ownerId;

        if (!eDonoSupremo && !eDonoServer) {
            return msg.reply('👑 **Acesso Negado.** Apenas o Proprietário ou o Desenvolvedor Supremo possuem acesso.');
        }

        // ─── I/O de configurações ────────────────────────────────────────────

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
                // Segurança
                antibot: false, antinuke: false,
                anticargos: false, cargos_protegidos: [],
                antifake: false, diasFake: 7,
                // Logs
                logs_seguranca: null, logs_staff: null,
                logs_msg: null, logs_join: null,
                logs_anticargos: null,
                // Automação
                autorole: null, msg_join: null,
                bypass_roles: [],
                // Diversão
                canal_fun: null, xp_ativo: true, coins_ativo: true,
                // I.A. Morgan
                morgan_ativo: false,
                morgan_canal: null,
            };

            for (const [k, v] of Object.entries(defaults)) {
                if (sc[k] === undefined) sc[k] = v;
            }
            if (!Array.isArray(sc.bypass_roles))       sc.bypass_roles = [];
            if (!Array.isArray(sc.cargos_protegidos))  sc.cargos_protegidos = [];

            return { configs, sc };
        }

        function salvarConfigs(dados) {
            fs.writeFileSync('./database/config.json', JSON.stringify(dados, null, 2));
        }

        // ─── Helpers de display ──────────────────────────────────────────────

        const statusIcon = (v) => v ? '🟩 `LIGADO`' : '🟥 `DESLIGADO`';
        const nomeCanal  = (id) => id ? `<#${id}>` : '`Não definido`';
        const nomeCargo  = (id) => id ? `<@&${id}>` : '`Não definido`';

        // ─── Embeds ──────────────────────────────────────────────────────────

        function gerarEmbedHome() {
            return new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('🛡️ RETH MORGAN — PAINEL DE CONTROLE')
                .setDescription(
                    'Central operacional do servidor. Navegue pelas categorias:\n\n' +
                    '🛑 **Chat** — Filtros de moderação de mensagens\n' +
                    '☢️ **Segurança** — Proteções anti-raid e invasão\n' +
                    '📋 **Logs** — Canais de registro e cargos protegidos\n' +
                    '⚙️ **Automação** — Auto-role, boas-vindas e bypass\n' +
                    '🎮 **Diversão** — Canal de fun, XP e economy\n' +
                    '🤖 **I.A. Morgan** — Canal e configurações da inteligência artificial'
                );
        }

        function gerarEmbedChat(sc) {
            return new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('🛑 FILTROS DE MODERAÇÃO DE CHAT')
                .setDescription('Monitore e altere as diretrizes de conteúdo do chat em tempo real.')
                .addFields(
                    { name: '🌊 Anti-Flood',      value: `${statusIcon(sc.antiflood)}\n↳ Limite: \`${sc.limiteFlood} msgs / 4s\``, inline: true },
                    { name: '🔗 Anti-Links',       value: statusIcon(sc.antilink),       inline: true },
                    { name: '📩 Anti-Convites',    value: statusIcon(sc.antiinvite),     inline: true },
                    { name: '🔠 Anti-Caps Lock',   value: statusIcon(sc.anticaps),       inline: true },
                    { name: '🤬 Anti-Preconceito', value: statusIcon(sc.antipreconceito),inline: true },
                );
        }

        function gerarEmbedSeguranca(sc) {
            const listaCargos = sc.cargos_protegidos.length > 0
                ? sc.cargos_protegidos.map(id => `<@&${id}>`).join(', ')
                : '`Nenhum cargo protegido`';

            return new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('☢️ PROTOCOLOS ANTI-RAID & INVASÃO')
                .setDescription('Trave as defesas contra traições internas ou ataques externos.')
                .addFields(
                    { name: '🤖 Anti-Bot Invasor', value: statusIcon(sc.antibot),   inline: true },
                    { name: '💣 Anti-Nuke',         value: statusIcon(sc.antinuke),  inline: true },
                    { name: '🎭 Anti-Fake',         value: `${statusIcon(sc.antifake)}\n↳ Mínimo: \`${sc.diasFake} dias\``, inline: true },
                    { name: '🔰 Anti-Cargos',       value: statusIcon(sc.anticargos),inline: true },
                    { name: '🔒 Cargos Protegidos', value: listaCargos,              inline: false },
                );
        }

        function gerarEmbedLogs(sc) {
            return new EmbedBuilder()
                .setColor('#9b59b6')
                .setTitle('📋 CANAIS DE LOGS & REGISTROS')
                .setDescription('Configure onde cada tipo de evento será registrado.')
                .addFields(
                    { name: '🛡️ Logs de Segurança',       value: nomeCanal(sc.logs_seguranca),  inline: true },
                    { name: '👮 Logs de Staff',             value: nomeCanal(sc.logs_staff),      inline: true },
                    { name: '📝 Logs de Mensagens',        value: nomeCanal(sc.logs_msg),        inline: true },
                    { name: '🚪 Logs de Entradas/Saídas',  value: nomeCanal(sc.logs_join),       inline: true },
                    { name: '🔰 Logs Anti-Cargos',         value: nomeCanal(sc.logs_anticargos), inline: true },
                );
        }

        function gerarEmbedAutomacao(sc) {
            const listaBypass = sc.bypass_roles.length > 0
                ? sc.bypass_roles.map(id => `<@&${id}>`).join(', ')
                : '`Nenhum cargo imune`';
            return new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('⚙️ AUTOMAÇÃO & CONFIGURAÇÕES GERAIS')
                .setDescription('Configure funções automáticas do servidor.')
                .addFields(
                    { name: '🎒 Auto-Role',             value: nomeCargo(sc.autorole),  inline: true },
                    { name: '👋 Canal de Boas-Vindas',  value: nomeCanal(sc.msg_join),  inline: true },
                    { name: '👑 Cargos Imunes (Bypass)', value: listaBypass,            inline: false },
                );
        }

        function gerarEmbedDiversao(sc) {
            return new EmbedBuilder()
                .setColor('#e91e8c')
                .setTitle('🎮 SISTEMA DE DIVERSÃO')
                .setDescription('Configure o canal de fun e os sistemas de progressão.')
                .addFields(
                    { name: '🎯 Canal de Diversão', value: `${nomeCanal(sc.canal_fun)}\n↳ Se definido, comandos fun só funcionam aqui`, inline: false },
                    { name: '⭐ Sistema de XP',      value: statusIcon(sc.xp_ativo),    inline: true },
                    { name: '💰 Sistema de Economy', value: statusIcon(sc.coins_ativo), inline: true },
                )
                .setFooter({ text: 'Use os botões abaixo para configurar' });
        }

        function gerarEmbedMorgan(sc) {
            return new EmbedBuilder()
                .setColor('#5865f2')
                .setTitle('🤖 I.A. MORGAN — INTELIGÊNCIA ARTIFICIAL')
                .setDescription(
                    'Configure o comportamento da I.A. Morgan no servidor.\n' +
                    'Quando ativada, Morgan responde mensagens no canal definido\n' +
                    'e também quando alguém a chama pelo nome.'
                )
                .addFields(
                    {
                        name: '⚡ Status da I.A.',
                        value: `${statusIcon(sc.morgan_ativo)}\n↳ Quando ligada, Morgan responde no canal e ao ser chamada por nome`,
                        inline: false,
                    },
                    {
                        name: '📢 Canal da Morgan',
                        value: `${nomeCanal(sc.morgan_canal)}\n↳ Canal exclusivo onde a I.A. responde todas as mensagens`,
                        inline: false,
                    },
                )
                .setFooter({ text: 'Chamar "Morgan" em qualquer canal também ativa a resposta se a I.A. estiver ligada' });
        }

        // ─── Botões ──────────────────────────────────────────────────────────

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
                new ButtonBuilder().setCustomId('toggle_flood').setLabel('Flood').setEmoji(sc.antiflood ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_limite_flood').setLabel('Config Limite').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_link').setLabel('Links').setEmoji(sc.antilink ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_invite').setLabel('Convites').setEmoji(sc.antiinvite ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_precon').setLabel('Anti-Ódio').setEmoji(sc.antipreconceito ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
            );
        }

        function gerarBotoesSeguranca(sc) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('toggle_bot').setLabel('Anti-Bot').setEmoji(sc.antibot ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_nuke').setLabel('Anti-Nuke').setEmoji(sc.antinuke ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_cargos').setLabel('Anti-Cargos').setEmoji(sc.anticargos ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_fake').setLabel('Anti-Fake').setEmoji(sc.antifake ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_dias_fake').setLabel('Config Dias').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
            );
        }

        function gerarBotoesSeguranca2(sc) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('set_prot_cargo').setLabel('Cargos Protegidos').setEmoji('🔒').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('nav_seg_back').setLabel('◀ Voltar').setEmoji('🔙').setStyle(ButtonStyle.Secondary),
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
                new ButtonBuilder().setCustomId('set_bypass').setLabel('Bypass (Imunes)').setEmoji('👑').setStyle(ButtonStyle.Secondary),
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

        // ─── Envio inicial ───────────────────────────────────────────────────

        const botoesNavegacao = gerarBotoesNavegacao();
        const painelMensagem  = await msg.channel.send({
            embeds: [gerarEmbedHome()],
            components: [botoesNavegacao],
        });

        // ─── Collector principal ─────────────────────────────────────────────

        const collector = painelMensagem.createMessageComponentCollector({
            filter: (i) => i.user.id === msg.author.id,
            time: 5 * 60 * 1000,
        });

        collector.on('collect', async (i) => {
            const { configs, sc: currentSc } = obterConfigs();

            // ── Navegação ────────────────────────────────────────────────────
            const navMap = {
                'nav_home':      [gerarEmbedHome(),                  [botoesNavegacao]],
                'nav_chat':      [gerarEmbedChat(currentSc),         [botoesNavegacao, gerarBotoesChat(currentSc)]],
                'nav_seguranca': [gerarEmbedSeguranca(currentSc),    [botoesNavegacao, gerarBotoesSeguranca(currentSc), gerarBotoesSeguranca2(currentSc)]],
                'nav_seg_back':  [gerarEmbedSeguranca(currentSc),    [botoesNavegacao, gerarBotoesSeguranca(currentSc), gerarBotoesSeguranca2(currentSc)]],
                'nav_logs':      [gerarEmbedLogs(currentSc),         [botoesNavegacao, gerarBotoesLogs()]],
                'nav_mais':      [gerarEmbedHome(),                  [gerarBotoesNavegacao2()]],
                'nav_voltar':    [gerarEmbedHome(),                  [botoesNavegacao]],
                'nav_automacao': [gerarEmbedAutomacao(currentSc),    [gerarBotoesNavegacao2(), gerarBotoesAutomacao()]],
                'nav_diversao':  [gerarEmbedDiversao(currentSc),     [gerarBotoesNavegacao2(), gerarBotoesDiversao(currentSc)]],
                'nav_morgan':    [gerarEmbedMorgan(currentSc),       [gerarBotoesNavegacao2(), gerarBotoesMorgan(currentSc)]],
            };

            if (navMap[i.customId]) {
                const [embed, components] = navMap[i.customId];
                await i.update({ embeds: [embed], components });
                return;
            }

            // ── Toggle I.A. Morgan ───────────────────────────────────────────
            if (i.customId === 'toggle_morgan') {
                configs[msg.guild.id].morgan_ativo = !currentSc.morgan_ativo;
                salvarConfigs(configs);
                const { sc: upd } = obterConfigs();
                await i.update({ embeds: [gerarEmbedMorgan(upd)], components: [gerarBotoesNavegacao2(), gerarBotoesMorgan(upd)] });
                return;
            }

            // ── Limpar canal Morgan ──────────────────────────────────────────
            if (i.customId === 'clear_canal_morgan') {
                configs[msg.guild.id].morgan_canal = null;
                salvarConfigs(configs);
                const { sc: upd } = obterConfigs();
                await i.update({ embeds: [gerarEmbedMorgan(upd)], components: [gerarBotoesNavegacao2(), gerarBotoesMorgan(upd)] });
                return;
            }

            // ── Toggles gerais ───────────────────────────────────────────────
            const mapeamentoToggle = {
                'toggle_flood':  'antiflood',
                'toggle_link':   'antilink',
                'toggle_invite': 'antiinvite',
                'toggle_caps':   'anticaps',
                'toggle_precon': 'antipreconceito',
                'toggle_bot':    'antibot',
                'toggle_nuke':   'antinuke',
                'toggle_cargos': 'anticargos',
                'toggle_fake':   'antifake',
                'toggle_xp':     'xp_ativo',
                'toggle_coins':  'coins_ativo',
            };

            const chaveToggle = mapeamentoToggle[i.customId];
            if (chaveToggle) {
                configs[msg.guild.id][chaveToggle] = !currentSc[chaveToggle];
                salvarConfigs(configs);
                const { sc: upd } = obterConfigs();
                const chatKeys = ['antiflood', 'antilink', 'antiinvite', 'anticaps', 'antipreconceito'];
                const segKeys  = ['antibot', 'antinuke', 'anticargos', 'antifake'];
                const funKeys  = ['xp_ativo', 'coins_ativo'];
                if (chatKeys.includes(chaveToggle)) {
                    await i.update({ embeds: [gerarEmbedChat(upd)], components: [botoesNavegacao, gerarBotoesChat(upd)] });
                } else if (segKeys.includes(chaveToggle)) {
                    await i.update({ embeds: [gerarEmbedSeguranca(upd)], components: [botoesNavegacao, gerarBotoesSeguranca(upd), gerarBotoesSeguranca2(upd)] });
                } else if (funKeys.includes(chaveToggle)) {
                    await i.update({ embeds: [gerarEmbedDiversao(upd)], components: [gerarBotoesNavegacao2(), gerarBotoesDiversao(upd)] });
                }
                return;
            }

            // ── Limpar canal fun ─────────────────────────────────────────────
            if (i.customId === 'clear_canal_fun') {
                configs[msg.guild.id].canal_fun = null;
                salvarConfigs(configs);
                const { sc: upd } = obterConfigs();
                await i.update({ embeds: [gerarEmbedDiversao(upd)], components: [gerarBotoesNavegacao2(), gerarBotoesDiversao(upd)] });
                return;
            }

            // ── Inputs de texto ──────────────────────────────────────────────
            const inputsDisponiveis = {
                'set_limite_flood':   { texto: '🌊 Digite o novo limite de flood (número de **2 a 20**):', chave: 'limiteFlood',       tipo: 'numero'   },
                'set_dias_fake':      { texto: '🎭 Digite a idade mínima da conta em dias (número de **1 a 60**):', chave: 'diasFake', tipo: 'numero'   },
                'set_log_seg':        { texto: '🛡️ Mencione o canal para **Logs de Segurança**:', chave: 'logs_seguranca',            tipo: 'canal'    },
                'set_log_staff':      { texto: '👮 Mencione o canal para **Logs de Staff**:', chave: 'logs_staff',                    tipo: 'canal'    },
                'set_log_msg':        { texto: '📝 Mencione o canal para **Logs de Mensagens**:', chave: 'logs_msg',                  tipo: 'canal'    },
                'set_log_join':       { texto: '🚪 Mencione o canal para **Logs de Entradas/Saídas**:', chave: 'logs_join',           tipo: 'canal'    },
                'set_log_anticargos': { texto: '🔰 Mencione o canal para **Logs de Tentativas de Cargo**:', chave: 'logs_anticargos', tipo: 'canal'    },
                'set_auto_role':      { texto: '🎒 Mencione o cargo para o **Auto-Role**:', chave: 'autorole',                       tipo: 'cargo'    },
                'set_boas_vindas':    { texto: '👋 Mencione o canal para **Boas-Vindas**:', chave: 'msg_join',                       tipo: 'canal'    },
                'set_bypass':         { texto: '👑 Mencione o cargo para **Adicionar/Remover da Imunidade**:', chave: 'bypass_roles', tipo: 'bypass'   },
                'set_prot_cargo':     { texto: '🔒 Mencione o cargo para **Adicionar/Remover da Proteção**:', chave: 'cargos_protegidos', tipo: 'protecao' },
                'set_canal_fun':      { texto: '🎮 Mencione o canal para o **Canal de Diversão**:', chave: 'canal_fun',              tipo: 'canal'    },
                'set_canal_morgan':   { texto: '🤖 Mencione o canal para a **I.A. Morgan** responder:', chave: 'morgan_canal',        tipo: 'canal'    },
            };

            const inputAlvo = inputsDisponiveis[i.customId];
            if (!inputAlvo) return;

            await i.deferUpdate();
            const avisoChat = await msg.channel.send(
                `⌨️ <@${msg.author.id}>, ${inputAlvo.texto}\n*Digite \`cancelar\` para abortar. (30s)*`
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

                if (['set_log_seg','set_log_staff','set_log_msg','set_log_join','set_log_anticargos'].includes(i.customId)) {
                    await painelMensagem.edit({ embeds: [gerarEmbedLogs(freshSc)], components: [botoesNavegacao, gerarBotoesLogs()] });
                } else if (i.customId === 'set_prot_cargo') {
                    await painelMensagem.edit({ embeds: [gerarEmbedSeguranca(freshSc)], components: [botoesNavegacao, gerarBotoesSeguranca(freshSc), gerarBotoesSeguranca2(freshSc)] });
                } else if (['set_auto_role','set_boas_vindas','set_bypass'].includes(i.customId)) {
                    await painelMensagem.edit({ embeds: [gerarEmbedAutomacao(freshSc)], components: [gerarBotoesNavegacao2(), gerarBotoesAutomacao()] });
                } else if (i.customId === 'set_canal_fun') {
                    await painelMensagem.edit({ embeds: [gerarEmbedDiversao(freshSc)], components: [gerarBotoesNavegacao2(), gerarBotoesDiversao(freshSc)] });
                } else if (i.customId === 'set_canal_morgan') {
                    await painelMensagem.edit({ embeds: [gerarEmbedMorgan(freshSc)], components: [gerarBotoesNavegacao2(), gerarBotoesMorgan(freshSc)] });
                } else if (i.customId === 'set_limite_flood') {
                    await painelMensagem.edit({ embeds: [gerarEmbedChat(freshSc)], components: [botoesNavegacao, gerarBotoesChat(freshSc)] });
                } else if (i.customId === 'set_dias_fake') {
                    await painelMensagem.edit({ embeds: [gerarEmbedSeguranca(freshSc)], components: [botoesNavegacao, gerarBotoesSeguranca(freshSc), gerarBotoesSeguranca2(freshSc)] });
                }
            });

            coletorResposta.on('end', async (collected) => {
                if (collected.size === 0) await avisoChat.delete().catch(() => {});
            });
        });

        collector.on('end', async () => {
            const nav = gerarBotoesNavegacao();
            nav.components.forEach(btn => btn.setDisabled(true));
            await painelMensagem.edit({ components: [nav] }).catch(() => {});
        });
    },
};