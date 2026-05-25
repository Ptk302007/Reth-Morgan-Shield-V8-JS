// commands/fun/presente.js
'use strict';
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');

const PRESENTES = [
    { nome: '🌹 Rosa',         custo: 50,   msg: 'enviou uma rosa' },
    { nome: '🍫 Chocolate',    custo: 80,   msg: 'enviou um chocolate' },
    { nome: '💍 Anel',         custo: 500,  msg: 'enviou um anel' },
    { nome: '🎁 Caixa Surpresa',custo: 200, msg: 'enviou uma caixa surpresa' },
    { nome: '🌟 Estrela',      custo: 150,  msg: 'enviou uma estrela' },
    { nome: '🏆 Troféu',       custo: 1000, msg: 'enviou um troféu' },
    { nome: '🎮 Controle',     custo: 300,  msg: 'enviou um controle de videogame' },
    { nome: '🍕 Pizza',        custo: 100,  msg: 'enviou uma pizza' },
];

module.exports = {
    name: 'presente',
    aliases: ['gift', 'dar'],
    execute: async (msg, args) => {
        // d!presente listar
        if ((args[0] || '').toLowerCase() === 'listar') {
            const lista = PRESENTES.map(p => `${p.nome} — \`${p.custo} 🪙\``).join('\n');
            return msg.reply(`🎁 **Presentes disponíveis:**\n${lista}\n\nUse: \`d!presente @usuário <nome do presente>\``);
        }

        const alvo = msg.mentions.members.first();
        const nomePresente = args.slice(1).join(' ').toLowerCase();

        if (!alvo || !nomePresente)
            return msg.reply('❌ Use: `d!presente @usuário <nome>` ou `d!presente listar`');
        if (alvo.id === msg.author.id)
            return msg.reply('❌ Você não pode presentear a si mesmo!');
        if (alvo.user.bot)
            return msg.reply('❌ Bots não aceitam presentes!');

        const presente = PRESENTES.find(p => p.nome.toLowerCase().includes(nomePresente) || nomePresente.includes(p.nome.split(' ')[1]?.toLowerCase() || ''));
        if (!presente)
            return msg.reply(`❌ Presente não encontrado! Use \`d!presente listar\` para ver os disponíveis.`);

        let dados = {};
        try { dados = JSON.parse(fs.readFileSync('./database/xp.json', 'utf-8')); } catch { dados = {}; }

        const gid = msg.guild.id;
        if (!dados[gid]) dados[gid] = {};
        if (!dados[gid][msg.author.id]) dados[gid][msg.author.id] = { coins: 0, banco: 0 };
        if (!dados[gid][alvo.id]) dados[gid][alvo.id] = { coins: 0, banco: 0 };

        if (dados[gid][msg.author.id].coins < presente.custo)
            return msg.reply(`❌ Você precisa de \`${presente.custo} 🪙\` mas tem apenas \`${dados[gid][msg.author.id].coins} 🪙\``);

        dados[gid][msg.author.id].coins -= presente.custo;
        fs.writeFileSync('./database/xp.json', JSON.stringify(dados, null, 2));

        const embed = new EmbedBuilder()
            .setColor('#e91e8c')
            .setTitle('🎁 PRESENTE ENVIADO!')
            .setDescription(`<@${msg.author.id}> ${presente.msg} para <@${alvo.id}>! ${presente.nome}`)
            .addFields(
                { name: '💸 Custo',        value: `\`${presente.custo} 🪙\``,                       inline: true },
                { name: '👛 Seu Saldo',    value: `\`${dados[gid][msg.author.id].coins} 🪙\``,      inline: true },
            )
            .setTimestamp();

        return msg.channel.send({ content: `<@${alvo.id}>`, embeds: [embed] });
    }
};