// Arquivo: commands/info/vcclear.js
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'vcclear',
    aliases: ['limparvc', 'vckickall'],
    category: 'info',
    execute: async (msg, args, client, OWNER_ID) => {
        // Verifica se o usuário tem permissão de mover membros
        if (!msg.member.permissions.has(PermissionFlagsBits.MoveMembers) && msg.author.id !== OWNER_ID) {
            return msg.reply('❌ Você não tem permissão de `Mover Membros` para usar este comando.');
        }

        // Pega o canal de voz em que o autor do comando está
        const canalVoz = msg.member.voice.channel;
        if (!canalVoz) {
            return msg.reply('❌ Você precisa estar conectado em um canal de voz para limpar a call.');
        }

        // 🟩 CORRIGIDO: Nome da variável junto para não dar SyntaxError
        const membrosNaCall = canalVoz.members;
        if (membrosNaCall.size === 0) {
            return msg.reply('❌ Este canal de voz já está vazio.');
        }

        let contador = 0;

        // Loop mecânico para desconectar geral de forma segura
        for (const [membroId, membro] of membrosNaCall) {
            try {
                // Desconecta o membro usando a função nativa da v14
                await membro.voice.disconnect('Reth Morgan: Limpeza de canal de voz acionada.');
                contador++;
            } catch (err) {
                // Ignora erros caso alguém saia da call no mesmo milissegundo
            }
        }

        const embedSucesso = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🔊 LIMPEZA DE CALL EXECUTADA')
            .setDescription(`O canal de voz **${canalVoz.name}** foi limpo com sucesso.`)
            .addFields(
                { name: '👥 Usuários Desconectados', value: `\`${contador} membros\``, inline: true },
                { name: '👮 Operador', value: `<@${msg.author.id}>`, inline: true }
            )
            .setTimestamp();

        return msg.channel.send({ embeds: [embedSucesso] });
    }
};