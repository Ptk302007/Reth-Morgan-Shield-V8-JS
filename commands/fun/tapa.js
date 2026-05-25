const { EmbedBuilder } = require('discord.js');
module.exports = {
    name: 'tapa',
    aliases: ['slap', 'bater'],
    execute: async (msg) => {
        const gifs = [
            'https://media.giphy.com/media/Zau0yrl17uhdK/giphy.gif',
            'https://media.giphy.com/media/jLeyZWgtwgr2U/giphy.gif',
            'https://media.giphy.com/media/uqSU9IEYEKAbS/giphy.gif'
        ];
        const alvo = msg.mentions.users.first();
        if (!alvo) return msg.reply('Mencione alguém para tapar! Ex: `d!tapa @usuario`');
        if (alvo.id === msg.author.id) return msg.reply('😐 Você não pode se tapar...');
        const gif = gifs[Math.floor(Math.random() * gifs.length)];
        const embed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setDescription(`👋 **${msg.author.username}** deu um tapa em **${alvo.username}**! EITA!`)
            .setImage(gif);
        msg.reply({ embeds: [embed] });
    }
};