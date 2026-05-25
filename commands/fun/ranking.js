const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
module.exports = {
    name: 'ranking',
    aliases: ['top', 'leaderboard', 'placar'],
    execute: async (msg) => {
        let dados = {};
        try { dados = JSON.parse(fs.readFileSync('./database/xp.json', 'utf-8')); } catch { dados = {}; }
        const guildData = dados[msg.guild.id] || {};
        const sorted = Object.entries(guildData).sort((a, b) => (b[1].xp || 0) - (a[1].xp || 0)).slice(0, 10);
        if (!sorted.length) return msg.reply('❌ Ainda não há ninguém no ranking!');
        const medals = ['🥇', '🥈', '🥉'];
        const linhas = await Promise.all(sorted.map(async ([id, u], i) => {
            const user = await msg.client.users.fetch(id).catch(() => ({ username: 'Usuário Desconhecido' }));
            return `${medals[i] || `\`${i + 1}.\``} **${user.username}** — Nível \`${u.nivel || 1}\` | XP: \`${u.xp || 0}\``;
        }));
        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle(`🏆 Ranking de ${msg.guild.name}`)
            .setDescription(linhas.join('\n'))
            .setThumbnail(msg.guild.iconURL());
        msg.reply({ embeds: [embed] });
    }
};