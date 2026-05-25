'use strict';
// commands/fun/saldo.js
const { EmbedBuilder } = require('discord.js');
const bonus = require('../../lib/bonus');

module.exports = {
    name: 'saldo',
    aliases: ['coins', 'carteira', 'bal'],
    execute: async (msg) => {
        const alvo = msg.mentions.users.first() || msg.author;
        const gid  = msg.guild.id;

        const dados = bonus.ler();
        bonus.garantir(dados, gid, alvo.id);
        const u = dados[gid][alvo.id];

        const coins  = u.coins  ?? 0;
        const banco  = u.banco  ?? 0;
        const total  = coins + banco;

        // Verifica cofre ativo
        const limiteCofre = bonus.getLimiteCofre(gid, alvo.id);

        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle(`💰 Carteira de ${alvo.username}`)
            .setThumbnail(alvo.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '👛 Carteira',  value: `\`${coins} 🪙\``,  inline: true },
                { name: '🏦 Banco',     value: `\`${banco} 🪙\``,  inline: true },
                { name: '📊 Total',     value: `\`${total} 🪙\``,  inline: true },
            );

        if (limiteCofre !== null) {
            embed.addFields({
                name: '🔐 Cofre Ativo',
                value: `Até \`${limiteCofre} 🪙\` protegidos de roubos`,
                inline: false,
            });
        }

        embed.setFooter({ text: 'Use d!loja para ganhar mais coins · d!perfil para ver bônus ativos' });

        return msg.reply({ embeds: [embed] });
    },
};