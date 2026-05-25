// commands/fun/transferir.js
'use strict';
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');

module.exports = {
    name: 'transferir',
    aliases: ['pagar', 'enviar'],
    execute: async (msg, args) => {
        const alvo = msg.mentions.members.first();
        const quantidade = parseInt(args[1]);

        if (!alvo || isNaN(quantidade) || quantidade <= 0)
            return msg.reply('❌ Use: `d!transferir @usuário <quantidade>`');
        if (alvo.id === msg.author.id)
            return msg.reply('❌ Você não pode transferir coins para si mesmo!');
        if (alvo.user.bot)
            return msg.reply('❌ Não é possível transferir para bots!');

        let dados = {};
        try { dados = JSON.parse(fs.readFileSync('./database/xp.json', 'utf-8')); } catch { dados = {}; }

        const gid = msg.guild.id;
        if (!dados[gid]) dados[gid] = {};
        if (!dados[gid][msg.author.id]) dados[gid][msg.author.id] = { coins: 0, banco: 0 };
        if (!dados[gid][alvo.id]) dados[gid][alvo.id] = { coins: 0, banco: 0 };

        if (dados[gid][msg.author.id].coins < quantidade)
            return msg.reply(`❌ Você não tem coins suficientes! Saldo: \`${dados[gid][msg.author.id].coins} 🪙\``);

        dados[gid][msg.author.id].coins -= quantidade;
        dados[gid][alvo.id].coins += quantidade;
        fs.writeFileSync('./database/xp.json', JSON.stringify(dados, null, 2));

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('💸 TRANSFERÊNCIA REALIZADA')
            .addFields(
                { name: '📤 Remetente', value: `<@${msg.author.id}>`, inline: true },
                { name: '📥 Destinatário', value: `<@${alvo.id}>`, inline: true },
                { name: '💰 Valor', value: `\`${quantidade} 🪙\``, inline: true },
                { name: '👛 Seu novo saldo', value: `\`${dados[gid][msg.author.id].coins} 🪙\``, inline: true },
            )
            .setTimestamp();

        return msg.reply({ embeds: [embed] });
    }
};