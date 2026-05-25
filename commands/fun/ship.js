const { EmbedBuilder } = require('discord.js');
module.exports = {
    name: 'ship',
    aliases: ['amor', 'compatibilidade'],
    execute: async (msg, args) => {
        const mencoes = msg.mentions.users;
        if (mencoes.size < 1) return msg.reply('💘 Mencione alguém! Ex: `d!ship @usuario`');
        const user1 = msg.author;
        const user2 = mencoes.first();
        if (user1.id === user2.id) return msg.reply('💀 Você não pode se shippar com você mesmo...');
        const seed = (parseInt(user1.id.slice(-4)) + parseInt(user2.id.slice(-4))) % 100 + 1;
        const pct = Math.min(seed, 100);
        const barras = Math.floor(pct / 10);
        const barra = '█'.repeat(barras) + '░'.repeat(10 - barras);
        const cor = pct >= 70 ? '#e91e8c' : pct >= 40 ? '#f39c12' : '#e74c3c';
        const embed = new EmbedBuilder()
            .setColor(cor)
            .setTitle('💘 Medidor de Amor')
            .setDescription(`**${user1.username}** ❤️ **${user2.username}**\n\n\`[${barra}]\` **${pct}%**\n\n${pct >= 80 ? '💍 Almas gêmeas!' : pct >= 60 ? '💕 Tem futuro!' : pct >= 40 ? '🤔 Talvez...' : '💔 Sem chances...'}`);
        msg.reply({ embeds: [embed] });
    }
};