// Arquivo: commands/security/painel.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');

module.exports = {
    name: 'painel',
    aliases: ['config', 'dashboard', 'setup'],
    execute: async (msg, args, client, OWNER_ID) => {
        const eDonoSupremo = msg.author.id === OWNER_ID;
        const eDonoServer = msg.author.id === msg.guild.ownerId;

        if (!eDonoSupremo && !eDonoServer) {
            return msg.reply('👑 **Acesso Negado.** Apenas o Proprietário ou o Desenvolvedor Supremo possuem acesso.');
        }

        // --- FUNÇÃO AUXILIAR: CARREGAR CONFIGS DO JSON ---
        function obterConfigs() {
            let configs = {};
            try {
                const conteudo = fs.readFileSync('./database/config.json', 'utf-8');
                if (conteudo.trim()) configs = JSON.parse(conteudo);
            } catch (e) { configs = {}; }

            if (!configs[msg.guild.id]) configs[msg.guild.id] = {};
            const sc = configs[msg.guild.id];

            // Injeção de Segurança contra undefined
            if (sc.antiflood === undefined) sc.antiflood = false;
            if (sc.antilink === undefined) sc.antilink = false;
            if (sc.antiinvite === undefined) sc.antiinvite = false;
            if (sc.anticaps === undefined) sc.anticaps = false;
            if (sc.antipreconceito === undefined) sc.antipreconceito = false;
            if (sc.antibot === undefined) sc.antibot = false;
            if (sc.antinuke === undefined) sc.antinuke = false;
            if (sc.anticargos === undefined) sc.anticargos = false;
            if (sc.antifake === undefined) sc.antifake = false;
            if (sc.logs_seguranca === undefined) sc.logs_seguranca = null;
            if (sc.logs_staff === undefined) sc.logs_staff = null;
            if (sc.logs_msg === undefined) sc.logs_msg = null;
            if (sc.logs_join === undefined) sc.logs_join = null;
            if (sc.msg_join === undefined) sc.msg_join = null;
            if (sc.autorole === undefined) sc.autorole = null;
            if (sc.limiteFlood === undefined) sc.limiteFlood = 5;
            if (sc.diasFake === undefined) sc.diasFake = 7;
            if (!sc.bypass_roles || !Array.isArray(sc.bypass_roles)) sc.bypass_roles = [];

            return { configs, sc };
        }

        // --- FUNÇÃO AUXILIAR: SALVAR CONFIGS NO JSON ---
        function salvarConfigs(dados) {
            fs.writeFileSync('./database/config.json', JSON.stringify(dados, null, 2));
        }

        // --- RENDERIZADORES DE EMBEDS (PÁGINAS) ---
        const statusIcon = (val) => val ? '🟩 `LIGADO`' : '🟥 `DESLIGADO`';

        function gerarEmbedHome() {
            return new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('🛡️ RETH MORGAN — PAINEL DE CONTROLE')
                .setDescription('Seja bem-vindo à central operacional. Utilize os botões abaixo para navegar entre as categorias de segurança e configuração de forma linear.');
        }

        function gerarEmbedChat(sc) {
            return new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('🛑 FILTROS DE MODERAÇÃO DE CHAT')
                .setDescription('Monitore e altere as diretrizes de conteúdo do chat em tempo real.')
                .addFields(
                    { name: '🌊 Anti-Flood', value: `${statusIcon(sc.antiflood)}\n↳ Limite: \`${sc.limiteFlood} msgs / 4s\``, inline: true },
                    { name: '🔗 Anti-Links', value: `${statusIcon(sc.antilink)}`, inline: true },
                    { name: '📩 Anti-Convites', value: `${statusIcon(sc.antiinvite)}`, inline: true },
                    { name: '🔠 Anti-Caps Lock', value: `${statusIcon(sc.anticaps)}`, inline: true },
                    { name: '🤬 Anti-Preconceito', value: `${statusIcon(sc.antipreconceito)}`, inline: true }
                );
        }

        function gerarEmbedSeguranca(sc) {
            return new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('☢️ PROTOCOLOS ANTI-RAID & INVASÃO')
                .setDescription('Trave as defesas brutas contra traições internos ou ataques externos.')
                .addFields(
                    { name: '🤖 Anti-Bot Invasor', value: `${statusIcon(sc.antibot)}`, inline: true },
                    { name: '🏢 Anti-Nuke (Canais)', value: `${statusIcon(sc.antinuke)}`, inline: true },
                    { name: '🛡️ Anti-Alteração de Cargos', value: `${statusIcon(sc.anticargos)}`, inline: true },
                    { name: '🎭 Anti-Contas Fakes', value: `${statusIcon(sc.antifake)}\n↳ Mínimo: \`${sc.diasFake} dias de criada\``, inline: false }
                );
        }

        function gerarEmbedLogs(sc) {
            const ch = (id) => id ? `<#${id}>` : '`Não Definido`';
            return new EmbedBuilder()
                .setColor('#f1c40f')
                .setTitle('📊 MALHA DE LOGS INDEPENDENTES')
                .setDescription('Monitore canais dedicados para capturar ações do servidor.')
                .addFields(
                    { name: '🚨 Logs de Segurança', value: ch(sc.logs_seguranca), inline: true },
                    { name: '👮 Logs de Staff/Mod', value: ch(sc.logs_staff), inline: true },
                    { name: '📝 Logs de Mensagens', value: ch(sc.logs_msg), inline: true },
                    { name: '🚪 Logs de Entradas/Saídas', value: ch(sc.logs_join), inline: true }
                );
        }

        function gerarEmbedAutomacao(sc) {
            const r = (id) => id ? `<@&${id}>` : '`Não Definido`';
            const ch = (id) => id ? `<#${id}>` : '`Não Definido`';
            return new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🤖 SISTEMAS DE AUTOMAÇÃO E ENTRADA')
                .setDescription('Configurações automáticas aplicadas a novos membros.')
                .addFields(
                    { name: '🎒 Auto-Role', value: r(sc.autorole), inline: true },
                    { name: '👋 Canal de Boas-Vindas', value: ch(sc.msg_join), inline: true },
                    { name: '👑 Cargos Imunes (Bypass)', value: sc.bypass_roles.length > 0 ? sc.bypass_roles.map(id => `<@&${id}>`).join(', ') : '`Nenhum cargo imune`', inline: false }
                );
        }

        // --- BOTÕES DE NAVEGAÇÃO PRINCIPAL ---
        const botoesNavegacao = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('nav_home').setEmoji('🏠').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('nav_chat').setLabel('Chat').setEmoji('💬').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('nav_seg').setLabel('Segurança').setEmoji('☢️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('nav_logs').setLabel('Logs').setEmoji('📊').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('nav_auto').setLabel('Automação').setEmoji('🤖').setStyle(ButtonStyle.Primary)
        );

        // --- ENVIAR INTERFACE INICIAL ---
        const { sc } = obterConfigs();
        const painelMensagem = await msg.reply({ embeds: [gerarEmbedHome()], components: [botoesNavegacao] });
        const coletor = painelMensagem.createMessageComponentCollector({ time: 300000 }); // 5 minutos ativo

        coletor.on('collect', async (i) => {
            if (i.user.id !== msg.author.id) {
                return i.reply({ content: '❌ Você não abriu esta sessão de configurações.', ephemeral: true });
            }

            const { configs, sc: currentSc } = obterConfigs();

            // NAVEGAÇÃO ENTRE PÁGINAS
            if (i.customId === 'nav_home') return i.update({ embeds: [gerarEmbedHome()], components: [botoesNavegacao] });
            if (i.customId === 'nav_chat') return i.update({ embeds: [gerarEmbedChat(currentSc)], components: [botoesNavegacao, gerarBotoesChat(currentSc)] });
            if (i.customId === 'nav_seg') return i.update({ embeds: [gerarEmbedSeguranca(currentSc)], components: [botoesNavegacao, gerarBotoesSeguranca(currentSc)] });
            if (i.customId === 'nav_logs') return i.update({ embeds: [gerarEmbedLogs(currentSc)], components: [botoesNavegacao, gerarBotoesLogs()] });
            if (i.customId === 'nav_auto') return i.update({ embeds: [gerarEmbedAutomacao(currentSc)], components: [botoesNavegacao, gerarBotoesAutomacao()] });

            // --- PROCESSAMENTO DOS INTERRUPTORES (LIGA/DESLIGA) VIA BOTÃO ---
            let alterarChave = null;
            if (i.customId === 'toggle_flood') alterarChave = 'antiflood';
            if (i.customId === 'toggle_link') alterarChave = 'antilink';
            if (i.customId === 'toggle_invite') alterarChave = 'antiinvite';
            if (i.customId === 'toggle_caps') alterarChave = 'anticaps';
            if (i.customId === 'toggle_precon') alterarChave = 'antipreconceito';
            if (i.customId === 'toggle_bot') alterarChave = 'antibot';
            if (i.customId === 'toggle_nuke') alterarChave = 'antinuke';
            if (i.customId === 'toggle_cargos') alterarChave = 'anticargos';
            if (i.customId === 'toggle_fake') alterarChave = 'antifake';

            if (alterarChave) {
                await i.deferUpdate();
                configs[msg.guild.id][alterarChave] = !currentSc[alterarChave];
                salvarConfigs(configs);
                
                const updated = obterConfigs().sc;
                if (['antiflood', 'antilink', 'antiinvite', 'anticaps', 'antipreconceito'].includes(alterarChave)) {
                    return painelMensagem.edit({ embeds: [gerarEmbedChat(updated)], components: [botoesNavegacao, gerarBotoesChat(updated)] });
                } else {
                    return painelMensagem.edit({ embeds: [gerarEmbedSeguranca(updated)], components: [botoesNavegacao, gerarBotoesSeguranca(updated)] });
                }
            }

            // --- SISTEMA INTELECTUAL DE COLETORES DE TEXTO NO CHAT ---
            const inputsDisponiveis = {
                'set_limite_flood': { texto: '🌊 Digite o novo limite de flood (Número de **2 a 20**):', chave: 'limiteFlood', tipo: 'numero' },
                'set_dias_fake': { texto: '🎭 Digite a idade mínima da conta em dias (Número de **1 a 60**):', chave: 'diasFake', tipo: 'numero' },
                'set_log_seg': { texto: '🛡️ Mencione o canal ou digite o ID para **Logs de Segurança**:', chave: 'logs_seguranca', tipo: 'canal' },
                'set_log_staff': { texto: '👮 Mencione o canal ou digite o ID para **Logs de Staff**:', chave: 'logs_staff', tipo: 'canal' },
                'set_log_msg': { texto: '📝 Mencione o canal ou digite o ID para **Logs de Mensagens**:', chave: 'logs_msg', tipo: 'canal' },
                'set_log_join': { texto: '🚪 Mencione o canal ou digite o ID para **Logs de Entradas/Saídas**:', chave: 'logs_join', tipo: 'canal' },
                'set_auto_role': { texto: '🎒 Mencione o cargo ou digite o ID para o **Auto-Role**:', chave: 'autorole', tipo: 'cargo' },
                'set_boas_vindas': { texto: '👋 Mencione o canal para as **Mensagens de Boas-Vindas Públicas**:', chave: 'msg_join', tipo: 'canal' },
                'set_bypass': { texto: '👑 Mencione ou digite o ID do cargo para **Adicionar/Remover da Imunidade (Bypass)**:', chave: 'bypass_roles', tipo: 'bypass' }
            };

            const inputAlvo = inputsDisponiveis[i.customId];
            if (inputAlvo) {
                await i.deferUpdate();
                const avisoChat = await msg.channel.send(`⌨️ <@${msg.author.id}>, ${inputAlvo.texto}`);

                const filtroMensagem = m => m.author.id === msg.author.id;
                const coletorResposta = msg.channel.createMessageCollector({ filter: filtroMensagem, max: 1, time: 30000 });

                coletorResposta.on('collect', async (m) => {
                    const dadosAtualizados = obterConfigs().configs;
                    const scAlvo = dadosAtualizados[msg.guild.id];

                    // Tratamento Numérico
                    if (inputAlvo.tipo === 'numero') {
                        const valorNum = parseInt(m.content);
                        if (!isNaN(valorNum) && valorNum > 0) {
                            scAlvo[inputAlvo.chave] = valorNum;
                        }
                    } 
                    // Tratamento de Canais
                    else if (inputAlvo.tipo === 'canal') {
                        const canalAlvo = m.mentions.channels.first() || msg.guild.channels.cache.get(m.content);
                        if (canalAlvo && canalAlvo.type === 0) scAlvo[inputAlvo.chave] = canalAlvo.id;
                    } 
                    // Tratamento de Cargos
                    else if (inputAlvo.tipo === 'cargo') {
                        const cargoAlvo = m.mentions.roles.first() || msg.guild.roles.cache.get(m.content);
                        if (cargoAlvo) scAlvo[inputAlvo.chave] = cargoAlvo.id;
                    }
                    // Tratamento Especial de Lista de Bypass
                    else if (inputAlvo.tipo === 'bypass') {
                        const cargoAlvo = m.mentions.roles.first() || msg.guild.roles.cache.get(m.content);
                        if (cargoAlvo) {
                            const idx = scAlvo.bypass_roles.indexOf(cargoAlvo.id);
                            if (idx > -1) scAlvo.bypass_roles.splice(idx, 1);
                            else scAlvo.bypass_roles.push(cargoAlvo.id);
                        }
                    }

                    salvarConfigs(dadosAtualizados);
                    
                    // Limpeza mecânica do chat
                    await m.delete().catch(() => {});
                    await avisoChat.delete().catch(() => {});

                    // Atualiza a visualização atual do painel na hora
                    const freshSc = obterConfigs().sc;
                    if (i.customId.startsWith('set_log_')) {
                        await painelMensagem.edit({ embeds: [gerarEmbedLogs(freshSc)] });
                    } else if (['set_auto_role', 'set_boas_vindas', 'set_bypass'].includes(i.customId)) {
                        await painelMensagem.edit({ embeds: [gerarEmbedAutomacao(freshSc)] });
                    } else if (i.customId === 'set_limite_flood') {
                        await painelMensagem.edit({ embeds: [gerarEmbedChat(freshSc)], components: [botoesNavegacao, gerarBotoesChat(freshSc)] });
                    } else if (i.customId === 'set_dias_fake') {
                        await painelMensagem.edit({ embeds: [gerarEmbedSeguranca(freshSc)], components: [botoesNavegacao, gerarBotoesSeguranca(freshSc)] });
                    }
                });

                coletorResposta.on('end', (collected, reason) => {
                    if (reason === 'time') avisoChat.delete().catch(() => {});
                });
            }
        });

        coletor.on('end', () => {
            painelMensagem.edit({ components: [] }).catch(() => {});
        });

        // --- COMPONENTES DINÂMICOS DE INTERAÇÃO (ON/OFF POR PÁGINA) ---
        function gerarBotoesChat(sc) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('toggle_flood').setLabel('Flood').setEmoji(sc.antiflood ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_limite_flood').setLabel('Config Limit').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_link').setLabel('Links').setEmoji(sc.antilink ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_invite').setLabel('Invites').setEmoji(sc.antiinvite ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_precon').setLabel('Anti-Ódio').setEmoji(sc.antipreconceito ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary)
            );
        }

        function gerarBotoesSeguranca(sc) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('toggle_bot').setLabel('Anti-Bot').setEmoji(sc.antibot ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_nuke').setLabel('Anti-Nuke').setEmoji(sc.antinuke ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_cargos').setLabel('Anti-Cargos').setEmoji(sc.anticargos ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('toggle_fake').setLabel('Anti-Fake').setEmoji(sc.antifake ? '🟩' : '🟥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_dias_fake').setLabel('Config Dias').setEmoji('⚙️').setStyle(ButtonStyle.Secondary)
            );
        }

        function gerarBotoesLogs() {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('set_log_seg').setLabel('Segurança').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_log_staff').setLabel('Staff').setEmoji('👮').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_log_msg').setLabel('Mensagens').setEmoji('📝').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_log_join').setLabel('Entradas').setEmoji('🚪').setStyle(ButtonStyle.Secondary)
            );
        }

        function gerarBotoesAutomacao() {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('set_auto_role').setLabel('Auto-Role').setEmoji('🎒').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_boas_vindas').setLabel('Boas-Vindas').setEmoji('👋').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('set_bypass').setLabel('Bypass (Imunes)').setEmoji('👑').setStyle(ButtonStyle.Secondary)
            );
        }
    }
};