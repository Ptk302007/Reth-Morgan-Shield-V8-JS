const { EmbedBuilder } = require('discord.js');
module.exports = {
    name: 'abraco',
    aliases: ['hug', 'abracar'],
    execute: async (msg) => {
        const gifs = [
            'https://media.giphy.com/media/od5H3PmEG5EVq/giphy.gif',
            'https://media.giphy.com/media/l2QDM9Jnim1YVILXa/giphy.gif',
            'https://media.giphy.com/media/3bqtLDeiDtwhq/giphy.gif'
        ];
        const alvo = msg.mentions.users.first();
        if (!alvo) return msg.reply('Mencione alguém para abraçar! Ex: `d!abraco @usuario`');
        const gif = gifs[Math.floor(Math.random() * gifs.length)];
        const embed = new EmbedBuilder()
            .setColor('#ff69b4')
            .setDescription(`🤗 **${msg.author.username}** deu um abraço em **${alvo.username}**!`)
            .setImage(gif);
        msg.reply({ embeds: [embed] });
    }
};