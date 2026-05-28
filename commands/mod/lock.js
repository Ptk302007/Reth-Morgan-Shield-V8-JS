const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'lock',
  execute: async (message, args, client) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels))
      return message.reply('❌ Sem permissão.');

    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels))
      return message.reply('❌ Eu não tenho permissão para isso.');

    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('Chat Trancado')
      .setDescription('O chat foi trancado por ' + message.author.tag);

    message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: false
    });

    message.channel.send({ embeds: [embed] });
  }
};