const { EmbedBuilder } = require('discord.js');
module.exports = {
    name: 'piada',
    aliases: ['joke', 'humor'],
    execute: async (msg) => {
        const piadas = [
            { setup: 'Por que o livro de matemática foi ao psicólogo?', punchline: 'Porque tinha muitos problemas!' },
            { setup: 'O que o zero disse para o oito?', punchline: 'Bonito cinto!' },
            { setup: 'Por que o espantalho ganhou um prêmio?', punchline: 'Porque era excelente no seu campo!' },
            { setup: 'Como se chama um cachorro sem patas?', punchline: 'Do jeito que você quiser, ele não vai correr atrás!' },
            { setup: 'O que a impressora disse para o papel?', punchline: 'Pode contar comigo!' },
            { setup: 'Por que o computador foi ao médico?', punchline: 'Porque estava com vírus!' },
            { setup: 'Como os oceanos se cumprimentam?', punchline: 'Eles dão uma acenada!' },
            { setup: 'Por que o esqueleto não brigou?', punchline: 'Porque não tinha estômago pra isso!' }
        ];
        const piada = piadas[Math.floor(Math.random() * piadas.length)];
        const embed = new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle('😂 Piada do Dia')
            .addFields(
                { name: '🎤 Setup', value: piada.setup },
                { name: '💥 Punchline', value: `||${piada.punchline}||` }
            )
            .setFooter({ text: 'Clique no spoiler para ver a resposta!' });
        msg.reply({ embeds: [embed] });
    }
};