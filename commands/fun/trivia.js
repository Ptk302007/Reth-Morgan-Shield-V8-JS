const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
module.exports = {
    name: 'trivia',
    aliases: ['quiz', 'pergunta'],
    execute: async (msg) => {
        const perguntas = [
            { p: 'Qual é o maior planeta do sistema solar?', r: 'Júpiter', op: ['Saturno', 'Júpiter', 'Urano', 'Netuno'] },
            { p: 'Quantos lados tem um hexágono?', r: '6', op: ['5', '6', '7', '8'] },
            { p: 'Qual é a capital do Brasil?', r: 'Brasília', op: ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador'] },
            { p: 'Quem pintou a Mona Lisa?', r: 'Leonardo da Vinci', op: ['Michelangelo', 'Rafael', 'Leonardo da Vinci', 'Picasso'] },
            { p: 'Qual é o elemento químico do ouro?', r: 'Au', op: ['Go', 'Gd', 'Au', 'Or'] },
            { p: 'Em que ano o homem pisou na lua pela primeira vez?', r: '1969', op: ['1965', '1967', '1969', '1971'] },
            { p: 'Qual é o maior oceano do mundo?', r: 'Pacífico', op: ['Atlântico', 'Índico', 'Ártico', 'Pacífico'] },
            { p: 'Quantos ossos tem o corpo humano adulto?', r: '206', op: ['196', '200', '206', '212'] }
        ];
        const q = perguntas[Math.floor(Math.random() * perguntas.length)];
        const ops = [...q.op].sort(() => Math.random() - 0.5);
        const letras = ['A', 'B', 'C', 'D'];
        const correta = letras[ops.indexOf(q.r)];
        const row = new ActionRowBuilder().addComponents(
            ops.map((op, i) => new ButtonBuilder()
                .setCustomId(`trivia_${letras[i]}`)
                .setLabel(`${letras[i]}) ${op}`)
                .setStyle(ButtonStyle.Secondary))
        );
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('🧠 Trivia!')
            .setDescription(`**${q.p}**`)
            .setFooter({ text: 'Você tem 20 segundos!' });
        const m = await msg.reply({ embeds: [embed], components: [row] });
        const collector = m.createMessageComponentCollector({ filter: i => i.user.id === msg.author.id, time: 20000, max: 1 });
        collector.on('collect', async i => {
            const acertou = i.customId === `trivia_${correta}`;
            const res = new EmbedBuilder()
                .setColor(acertou ? '#2ecc71' : '#e74c3c')
                .setTitle(acertou ? '✅ Correto!' : '❌ Errou!')
                .setDescription(acertou ? `Parabéns! A resposta era **${q.r}**!` : `A resposta correta era **${q.r}** (${correta}).`);
            await i.update({ embeds: [res], components: [] });
        });
        collector.on('end', (c) => { if (!c.size) m.edit({ content: `⏰ Tempo esgotado! A resposta era **${q.r}**.`, components: [] }).catch(() => {}); });
    }
};