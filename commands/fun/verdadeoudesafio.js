const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
module.exports = {
    name: 'verdadeoudesafio',
    aliases: ['vod', 'tod'],
    execute: async (msg) => {
        const verdades = [
            'Qual foi a coisa mais estranha que você já fez?',
            'Você já mentiu para um amigo? Sobre o quê?',
            'Qual é o seu maior medo?',
            'Você já teve crush em alguém desse servidor?',
            'Qual é a coisa mais idiota que você já fez?',
            'Você já chorou assistindo um filme ou série? Qual?',
            'Qual é o seu maior segredo?',
            'Você já copiou em uma prova?'
        ];
        const desafios = [
            'Manda uma foto do seu rosto agora!',
            'Escreva um poema sobre a pessoa acima de você no chat.',
            'Fique 10 minutos sem usar o celular.',
            'Manda uma mensagem constrangedora para o último contato do WhatsApp.',
            'Faz 20 flexões agora.',
            'Manda uma mensagem de voz cantando uma música.',
            'Muda seu nome no servidor para "Pato Feio" por 5 minutos.',
            'Tag alguém aleatório e diz "eu te amo".'
        ];
        const embed = new EmbedBuilder()
            .setColor('#e91e8c')
            .setTitle('🎭 Verdade ou Desafio')
            .setDescription(`<@${msg.author.id}>, escolha:`);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('vod_verdade').setLabel('Verdade').setEmoji('💬').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('vod_desafio').setLabel('Desafio').setEmoji('🔥').setStyle(ButtonStyle.Danger)
        );
        const m = await msg.reply({ embeds: [embed], components: [row] });
        const collector = m.createMessageComponentCollector({ filter: i => i.user.id === msg.author.id, time: 30000, max: 1 });
        collector.on('collect', async i => {
            const lista = i.customId === 'vod_verdade' ? verdades : desafios;
            const item = lista[Math.floor(Math.random() * lista.length)];
            const tipo = i.customId === 'vod_verdade' ? '💬 Verdade' : '🔥 Desafio';
            const cor = i.customId === 'vod_verdade' ? '#3498db' : '#e74c3c';
            const resultado = new EmbedBuilder().setColor(cor).setTitle(tipo).setDescription(item);
            await i.update({ embeds: [resultado], components: [] });
        });
        collector.on('end', (c) => { if (!c.size) m.edit({ components: [] }).catch(() => {}); });
    }
};