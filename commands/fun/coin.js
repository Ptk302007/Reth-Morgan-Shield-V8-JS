const { EmbedBuilder } = require('discord.js');
module.exports = {
    name: 'coinflip',
    aliases: ['moeda', 'caraoucoroa'],
    execute: async (msg) => {
        const resultado = Math.random() < 0.5 ? 'Cara 🪙' : 'Coroa 👑';
        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle('🪙 Cara ou Coroa')
            .setDescription(`A moeda girou e caiu em... **${resultado}**!`);
        msg.reply({ embeds: [embed] });
    }
};