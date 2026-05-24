// Arquivo: commands/utility/help.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'help',
    aliases: ['ajuda', 'comandos', 'h'],
    execute: async (msg, args, client, OWNER_ID) => {
        const todosComandos = client.commands;

        // 📁 Sincronizado direto com as suas pastas reais do computador!
        const categoriasInfo = {
            security: { nome: '🛡️ PROTOCOLOS DE SEGURANÇA', cor: '#e74c3c' },
            mod: { nome: '👮 INFRAESTRUTURA & MODERAÇÃO', cor: '#2ecc71' },
            admin: { nome: '👑 ADMINISTRAÇÃO AVANÇADA', cor: '#e67e22' },
            info: { nome: '⚙️ UTILITÁRIOS & INFORMAÇÕES', cor: '#3498db' },
            fun: { nome: '🎮 ENTRETENIMENTO & DIVERSÃO', cor: '#9b59b6' }
        };

        function gerarEmbedHome() {
            return new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('🧠 CENTRAL INTERATIVA DE DIRETRIZES — RETH MORGAN')
                .setDescription(
                    `Olá, <@${msg.author.id}>! Navegue linearmente pelas abas mecânicas de dados utilizando as interações abaixo.\n\n` +
                    `• **Prefixo Operacional:** \`r!\` \n` +
                    `• **Sistemas Ativos na Memória:** \`${todosComandos.size}\`\n\n` +
                    `*Selecione um botão abaixo com o emoji do módulo para abrir os comandos.*`
                )
                .setFooter({ text: 'Reth Morgan Intelligence System • PT' })
                .setTimestamp();
        }

        function gerarEmbedCategoria(categoriaAlvo) {
            const info = categoriasInfo[categoriaAlvo];
            
            // Filtra os comandos batendo certinho com a pasta física
            const filtrados = todosComandos.filter(cmd => (cmd.category || 'outros') === categoriaAlvo);

            const embed = new EmbedBuilder()
                .setColor(info.cor)
                .setTitle(info.nome)
                .setTimestamp();

            if (filtrados.size === 0) {
                embed.setDescription('*Nenhuma diretriz ativa cadastrada nesta subpasta.*');
            } else {
                const listaComandos = filtrados.map(cmd => {
                    const aliasesStr = cmd.aliases && cmd.aliases.length > 0 ? ` | [\`${cmd.aliases.join(', ')}\`]` : '';
                    return `• \`r!${cmd.name}\`${aliasesStr}`;
                }).join('\n');

                embed.setDescription(`Listagem mecânica automatizada da pasta \`${categoriaAlvo}\`:\n\n${listaComandos}`);
            }

            return embed;
        }

        // Criando os botões na ordem exata das suas pastas do Windows
        const botoesMenu = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('help_home').setEmoji('🏠').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('help_sec').setLabel('Segurança').setEmoji('🛡️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('help_mod').setLabel('Moderação').setEmoji('👮').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('help_admin').setLabel('Admin').setEmoji('👑').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('help_info').setLabel('Info/Utils').setEmoji('⚙️').setStyle(ButtonStyle.Primary)
            // Nota: O Discord limita a 5 botões por linha, então a Home + 4 categorias principais entram na primeira fileira.
        );

        // Segunda linha de interações dedicada para Diversão (pasta fun)
        const botoesLinha2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('help_fun').setLabel('Diversão').setEmoji('🎮').setStyle(ButtonStyle.Secondary)
        );

        const menuMensagem = await msg.reply({ 
            embeds: [gerarEmbedHome()], 
            components: [botoesMenu, botoesLinha2] 
        });
        
        const coletor = menuMensagem.createMessageComponentCollector({ time: 180000 });

        coletor.on('collect', async (i) => {
            if (i.user.id !== msg.author.id) {
                return i.reply({ content: '❌ Você não abriu este terminal de comandos.', ephemeral: true });
            }

            await i.deferUpdate();

            if (i.customId === 'help_home') return menuMensagem.edit({ embeds: [gerarEmbedHome()] });
            if (i.customId === 'help_sec') return menuMensagem.edit({ embeds: [gerarEmbedCategoria('security')] });
            if (i.customId === 'help_mod') return menuMensagem.edit({ embeds: [gerarEmbedCategoria('mod')] });
            if (i.customId === 'help_admin') return menuMensagem.edit({ embeds: [gerarEmbedCategoria('admin')] });
            if (i.customId === 'help_info') return menuMensagem.edit({ embeds: [gerarEmbedCategoria('info')] });
            if (i.customId === 'help_fun') return menuMensagem.edit({ embeds: [gerarEmbedCategoria('fun')] });
        });

        coletor.on('end', () => {
            menuMensagem.edit({ components: [] }).catch(() => {});
        });
    }
};