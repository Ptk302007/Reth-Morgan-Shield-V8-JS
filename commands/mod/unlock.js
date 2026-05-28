const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'unlock',
  execute: async (message, args, client) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels))
      return message.reply('❌ Sem permissão.');

    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels))
      return message.reply('❌ Eu não tenho permissão para isso.');

    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('Chat Desbloqueado')
      .setDescription('O chat foi desbloqueado por ' + message.author.tag);

    message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: true
    });

    message.channel.send({ embeds: [embed] });
  }
};