// commands/fun/banco.js
'use strict';
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');

module.exports = {
    name: 'banco',
    aliases: ['bank'],
    execute: async (msg, args) => {
        let dados = {};
        try { dados = JSON.parse(fs.readFileSync('./database/xp.json', 'utf-8')); } catch { dados = {}; }

        const gid = msg.guild.id;
        const uid = msg.author.id;
        if (!dados[gid]) dados[gid] = {};
        if (!dados[gid][uid]) dados[gid][uid] = { coins: 0, banco: 0 };

        const sub = (args[0] || '').toLowerCase();
        const valor = parseInt(args[1]);

        // Sem subcomando: mostra saldo
        if (!sub || sub === 'saldo') {
            const u = dados[gid][uid];
            const embed = new EmbedBuilder()
                .setColor('#f1c40f')
                .setTitle('🏦 BANCO MORGAN')
                .setDescription(`Saldo de <@${uid}>`)
                .addFields(
                    { name: '👛 Carteira',  value: `\`${u.coins} 🪙\``,  inline: true },
                    { name: '🏦 Banco',     value: `\`${u.banco} 🪙\``,  inline: true },
                    { name: '💎 Total',     value: `\`${u.coins + u.banco} 🪙\``, inline: true },
                )
                .setFooter({ text: 'Use: d!banco depositar <valor> | d!banco sacar <valor>' })
                .setTimestamp();
            return msg.reply({ embeds: [embed] });
        }

        if (isNaN(valor) || valor <= 0)
            return msg.reply('❌ Informe um valor válido! Ex: `d!banco depositar 500`');

        if (sub === 'depositar' || sub === 'dep') {
            if (dados[gid][uid].coins < valor)
                return msg.reply(`❌ Você não tem \`${valor} 🪙\` na carteira!`);
            dados[gid][uid].coins -= valor;
            dados[gid][uid].banco += valor;
            fs.writeFileSync('./database/xp.json', JSON.stringify(dados, null, 2));
            return msg.reply(`🏦 Depositado \`${valor} 🪙\` no banco! Banco: \`${dados[gid][uid].banco} 🪙\``);
        }

        if (sub === 'sacar') {
            if (dados[gid][uid].banco < valor)
                return msg.reply(`❌ Você não tem \`${valor} 🪙\` no banco!`);
            dados[gid][uid].banco -= valor;
            dados[gid][uid].coins += valor;
            fs.writeFileSync('./database/xp.json', JSON.stringify(dados, null, 2));
            return msg.reply(`💸 Sacado \`${valor} 🪙\` do banco! Carteira: \`${dados[gid][uid].coins} 🪙\``);
        }

        return msg.reply('❌ Subcomandos: `saldo`, `depositar <valor>`, `sacar <valor>`');
    }
};