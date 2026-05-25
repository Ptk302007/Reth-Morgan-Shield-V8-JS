const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
module.exports = {
    name: 'casar',
    aliases: ['marry', 'proposta'],
    execute: async (msg) => {
        const alvo = msg.mentions.users.first();
        if (!alvo) return msg.reply('💍 Mencione com quem quer casar! Ex: `d!casar @usuario`');
        if (alvo.id === msg.author.id) return msg.reply('😂 Você não pode casar consigo mesmo!');
        if (alvo.bot) return msg.reply('🤖 Não é possível casar com bots!');
        let dados = {};
        try { dados = JSON.parse(fs.readFileSync('./database/casamentos.json', 'utf-8')); } catch { dados = {}; }
        if (!dados[msg.guild.id]) dados[msg.guild.id] = {};
        if (dados[msg.guild.id][msg.author.id]) return msg.reply(`💍 Você já está casado(a)! Use \`d!divorcio\` primeiro.`);
        if (dados[msg.guild.id][alvo.id]) return msg.reply(`💔 **${alvo.username}** já está casado(a) com outra pessoa!`);
        const embed = new EmbedBuilder()
            .setColor('#ff69b4')
            .setTitle('💍 Pedido de Casamento!')
            .setDescription(`<@${alvo.id}>, **${msg.author.username}** está pedindo sua mão em casamento! 💒\n\nDigite **sim** ou **não** em 30 segundos!`);
        await msg.reply({ embeds: [embed] });
        const collector = msg.channel.createMessageCollector({ filter: m => m.author.id === alvo.id && ['sim','não','nao'].includes(m.content.toLowerCase()), time: 30000, max: 1 });
        collector.on('collect', async r => {
            if (r.content.toLowerCase() === 'sim') {
                dados[msg.guild.id][msg.author.id] = { casadoCom: alvo.id, data: new Date().toLocaleDateString('pt-BR') };
                dados[msg.guild.id][alvo.id] = { casadoCom: msg.author.id, data: new Date().toLocaleDateString('pt-BR') };
                fs.writeFileSync('./database/casamentos.json', JSON.stringify(dados, null, 2));
                const sucesso = new EmbedBuilder().setColor('#ff69b4').setTitle('💒 Casamento Realizado!').setDescription(`🎊 **${msg.author.username}** e **${alvo.username}** agora são casados! Parabéns! 🎊`);
                msg.channel.send({ embeds: [sucesso] });
            } else {
                msg.channel.send(`💔 **${alvo.username}** recusou o pedido. Que pena...`);
            }
        });
        collector.on('end', (c) => { if (!c.size) msg.channel.send(`⏰ **${alvo.username}** não respondeu. O pedido expirou.`); });
    }
};