const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');

module.exports = {
    name: 'setchat',
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply("❌ Sem permissão.");

        const tipo = args[0]; // 'comando' ou 'ia'
        const acao = args[1]; // 'add' ou 'remove'
        const canal = message.mentions.channels.first() || message.channel;

        let data = JSON.parse(fs.readFileSync('./database/canais.json', 'utf8'));

        if (tipo === 'comando') {
            if (acao === 'add') data.canaisComandos.push(canal.id);
            if (acao === 'remove') data.canaisComandos = data.canaisComandos.filter(id => id !== canal.id);
        } else if (tipo === 'ia') {
            if (acao === 'add') data.canaisIA.push(canal.id);
            if (acao === 'remove') data.canaisIA = data.canaisIA.filter(id => id !== canal.id);
        } else {
            return message.reply("Uso: `r!setchat <comando/ia> <add/remove> #canal`");
        }

        fs.writeFileSync('./database/canais.json', JSON.stringify(data, null, 2));

        const embed = new EmbedBuilder()
            .setTitle('⚙️ Configuração de Canais')
            .setColor('#00ff00')
            .setDescription(`Canal <#${canal.id}> configurado com sucesso!`)
            .addFields(
                { name: 'Tipo', value: tipo.toUpperCase(), inline: true },
                { name: 'Ação', value: acao, inline: true }
            );
        message.reply({ embeds: [embed] });
    }
};