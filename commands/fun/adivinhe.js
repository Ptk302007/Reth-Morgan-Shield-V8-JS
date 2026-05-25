const { EmbedBuilder } = require('discord.js');
module.exports = {
    name: 'adivinhe',
    aliases: ['guess', 'numero'],
    execute: async (msg, args) => {
        const max = parseInt(args[0]) || 100;
        const numero = Math.floor(Math.random() * max) + 1;
        let tentativas = 0;
        const maxTentativas = 7;
        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('🔢 Adivinhe o Número!')
            .setDescription(`Estou pensando em um número de **1 a ${max}**.\nVocê tem **${maxTentativas}** tentativas. Digite no chat!`);
        const m = await msg.reply({ embeds: [embed] });
        const collector = msg.channel.createMessageCollector({ filter: r => r.author.id === msg.author.id, time: 60000 });
        collector.on('collect', async r => {
            await r.delete().catch(() => {});
            const chute = parseInt(r.content);
            if (isNaN(chute)) return;
            tentativas++;
            if (chute === numero) {
                collector.stop();
                return m.edit({ embeds: [new EmbedBuilder().setColor('#2ecc71').setTitle('🎉 Acertou!').setDescription(`Era **${numero}**! Você acertou em ${tentativas} tentativa(s)!`)] });
            }
            if (tentativas >= maxTentativas) {
                collector.stop();
                return m.edit({ embeds: [new EmbedBuilder().setColor('#e74c3c').setTitle('💀 Acabaram as tentativas!').setDescription(`O número era **${numero}**. Tente novamente!`)] });
            }
            const dica = chute < numero ? '📈 Maior!' : '📉 Menor!';
            await m.edit({ embeds: [new EmbedBuilder().setColor('#f39c12').setTitle(`🔢 Tentativa ${tentativas}/${maxTentativas}`).setDescription(`Seu chute: **${chute}**\n${dica}\nTente de novo!`)] });
        });
        collector.on('end', (_, r) => { if (r === 'time') m.edit({ content: `⏰ Tempo esgotado! Era **${numero}**.`, embeds: [] }).catch(() => {}); });
    }
};