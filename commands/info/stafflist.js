// Arquivo: commands/moderation/stafflist.js
const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'stafflist',
    execute: async (msg) => {
        const membros = await msg.guild.members.fetch();
        const adms = membros.filter(m => m.permissions.has(PermissionsBitField.Flags.Administrator) && !m.user.bot);

        const listEmbed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle(`👮 QUADRO DE ADMINISTRAÇÃO — ${msg.guild.name}`)
            .setDescription(adms.map(m => `• <@${m.id}> - \`ID: ${m.id}\``).join('\n') || 'Nenhum administrador encontrado.');

        return msg.reply({ embeds: [listEmbed] });
    }
};