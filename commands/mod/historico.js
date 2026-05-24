// Arquivo: commands/security/historico.js
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');

module.exports = {
    name: 'historico',
    aliases: ['ficha', 'crimes'],
    execute: async (msg, args, client, OWNER_ID) => {
        if (!msg.member.permissions.has('ManageMessages')) {
            return msg.reply('❌ Acesso restrito a moderadores.');
        }

        const usuario = msg.mentions.users.first() || client.users.cache.get(args[0]) || msg.author;
        let dados = JSON.parse(fs.readFileSync('./database/punicoes.json', 'utf-8'));

        const ficha = dados[msg.guild.id]?.[usuario.id] || { warns: 0, mutes: 0, bans: 0, historico: [] };

        let crimesTexto = ficha.historico.map((c, i) => `\`[${c.data}]\` **${c.tipo}**: ${c.motivo}`).join('\n');
        if (!crimesTexto) crimesTexto = '🟩 *Ficha Limpa. Nenhuma infração registrada no banco de dados.*';

        const embedFicha = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle(`📂 PRONTUÁRIO CRIMINAL — ${usuario.username}`)
            .setDescription(`Abaixo está listada a ficha de comportamento mecânico do usuário no servidor.`)
            .addFields(
                { name: '⚠️ Advertências', value: `\`${ficha.warns}\``, inline: true },
                { name: '🤐 Mutes', value: `\`${ficha.mutes}\``, inline: true },
                { name: '🔨 Banimentos', value: `\`${ficha.bans}\``, inline: true }
            )
            .addFields({ name: '📝 Registro Cronológico de Ocorrências', value: crimesTexto, inline: false });

        return msg.reply({ embeds: [embedFicha] });
    }
};