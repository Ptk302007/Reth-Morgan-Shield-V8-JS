const { EmbedBuilder } = require('discord.js');
module.exports = {
    name: '8ball',
    aliases: ['bola8', 'magica'],
    execute: async (msg, args) => {
        if (!args.length) return msg.reply('❓ Faça uma pergunta! Ex: `d!8ball Vou passar na prova?`');
        const respostas = [
            '✅ Com certeza!', '✅ É definitivamente assim.', '✅ Sem dúvida.',
            '✅ Sim, definitivamente.', '✅ Pode contar com isso.',
            '🤔 Pergunte novamente mais tarde.', '🤔 Não consigo prever agora.',
            '🤔 Melhor não te dizer agora.', '🤔 Concentre-se e pergunte novamente.',
            '❌ Não conte com isso.', '❌ Minha resposta é não.', '❌ Minhas fontes dizem não.',
            '❌ As perspectivas não são boas.', '❌ Muito duvidoso.'
        ];
        const resposta = respostas[Math.floor(Math.random() * respostas.length)];
        const embed = new EmbedBuilder()
            .setColor('#7289da')
            .setTitle('🎱 Bola Mágica 8')
            .addFields(
                { name: '❓ Pergunta', value: args.join(' ') },
                { name: '🔮 Resposta', value: resposta }
            );
        msg.reply({ embeds: [embed] });
    }
};