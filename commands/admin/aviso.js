const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'aviso',
    execute(message, args, client) {
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            return message.reply('❌ ᴠᴏᴄê ɴãᴏ ᴛᴇᴍ ᴘᴇʀᴍɪssãᴏ ᴘᴀʀᴀ ɪssᴏ.');
        }

        // Pega todo o texto da mensagem
        const textoCompleto = args.join(' ');
        
        // Verifica se existe o separador "|"
        if (!textoCompleto.includes('|')) {
            return message.reply('⚠️ **Formato incorreto!** Use: `r!aviso Título | Mensagem`');
        }

        const partes = textoCompleto.split('|');
        const titulo = partes[0].trim().substring(0, 250); // Garante que nunca passa de 256
        const descricao = partes.slice(1).join('|').trim(); // Pega o resto como descrição

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`📢 ${titulo}`)
            .setDescription(descricao)
            .setTimestamp()
            .setFooter({ text: 'sɪsᴛᴇᴍᴀ ᴅᴇ ᴀᴠɪsᴏs ʀᴇᴛʜ' });

        message.channel.send({ embeds: [embed] }).catch(err => {
            message.reply('❌ Erro ao enviar embed: ' + err.message);
        });
        
        message.delete().catch(() => {});
    }
};