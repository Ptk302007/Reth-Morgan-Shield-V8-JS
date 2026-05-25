const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
module.exports = {
    name: 'divorcio',
    aliases: ['divorce', 'separar'],
    execute: async (msg) => {
        let dados = {};
        try { dados = JSON.parse(fs.readFileSync('./database/casamentos.json', 'utf-8')); } catch { dados = {}; }
        if (!dados[msg.guild.id]?.[msg.author.id]) return msg.reply('💍 Você não está casado(a)!');
        const parceiro = dados[msg.guild.id][msg.author.id].casadoCom;
        delete dados[msg.guild.id][msg.author.id];
        if (dados[msg.guild.id]?.[parceiro]) delete dados[msg.guild.id][parceiro];
        fs.writeFileSync('./database/casamentos.json', JSON.stringify(dados, null, 2));
        const embed = new EmbedBuilder().setColor('#e74c3c').setTitle('💔 Divórcio Concluído').setDescription(`Você se divorciou. <@${parceiro}> foi notificado(a).`);
        msg.reply({ embeds: [embed] });
        const exParceiro = await msg.client.users.fetch(parceiro).catch(() => null);
        if (exParceiro) exParceiro.send(`💔 **${msg.author.username}** pediu divórcio no servidor **${msg.guild.name}**.`).catch(() => {});
    }
};