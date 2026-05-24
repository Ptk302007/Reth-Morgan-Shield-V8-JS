const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'ping',
    execute(message, args, client) {
        const apiLatency = Date.now() - message.createdTimestamp;
        const websocketLatency = client.ws.ping;

        const embed = new EmbedBuilder()
            .setColor('#8B0000') // Vermelho escuro, como sangue
            .setTitle('Análise de Pulso do Sistema')
            .setDescription('O "Passageiro Sombrio" detectou as métricas vitais do alvo.')
            .addFields(
                { name: 'Frequência Cardíaca (API)', value: `${apiLatency}ms`, inline: true },
                { name: 'Pressão Arterial (WebSocket)', value: `${websocketLatency}ms`, inline: true }
            )
            .setFooter({ text: 'Sem vestígios. O Código de Harry foi seguido.' })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
};