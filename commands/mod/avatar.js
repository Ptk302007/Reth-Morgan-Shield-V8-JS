// commands/utilitarios/avatar.js
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'avatar',
    aliases: ['av', 'foto', 'pfp'],
    execute: async (msg, args) => {
        const alvo = msg.mentions.members.first()?.user || msg.author;

        const avatarServidor = msg.mentions.members.first()?.displayAvatarURL({ size: 4096, dynamic: true });
        const avatarGlobal   = alvo.displayAvatarURL({ size: 4096, dynamic: true });

        const embed = new EmbedBuilder()
            .setColor('#5865f2')
            .setTitle(`🖼️ Avatar de ${alvo.username}`)
            .setImage(avatarServidor || avatarGlobal)
            .setTimestamp();

        const botoes = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('🌐 Global (PNG)')
                .setStyle(ButtonStyle.Link)
                .setURL(alvo.displayAvatarURL({ size: 4096, extension: 'png' })),
            new ButtonBuilder()
                .setLabel('✨ Global (WebP)')
                .setStyle(ButtonStyle.Link)
                .setURL(alvo.displayAvatarURL({ size: 4096, extension: 'webp' })),
        );

        // Adiciona botão de avatar do servidor se for diferente do global
        if (avatarServidor && avatarServidor !== avatarGlobal) {
            botoes.addComponents(
                new ButtonBuilder()
                    .setLabel('🏠 Servidor')
                    .setStyle(ButtonStyle.Link)
                    .setURL(avatarServidor),
            );
            embed.setDescription(`📌 Mostrando avatar do servidor\n[Ver avatar global](${avatarGlobal})`);
        }

        return msg.reply({ embeds: [embed], components: [botoes] });
    }
};