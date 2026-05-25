const { EmbedBuilder } = require('discord.js');
module.exports = {
    name: 'dado',
    aliases: ['dice', 'rolar'],
    execute: async (msg, args) => {
        const lados = parseInt(args[0]) || 6;
        if (lados < 2 || lados > 1000) return msg.reply('⚠️ Use entre 2 e 1000 lados!');
        const resultado = Math.floor(Math.random() * lados) + 1;
        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle(`🎲 Dado de ${lados} lados`)
            .setDescription(`Você rolou um **${resultado}**!`);
        msg.reply({ embeds: [embed] });
    }
};