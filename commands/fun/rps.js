const { EmbedBuilder } = require('discord.js');
module.exports = {
    name: 'rps',
    aliases: ['jokempo', 'pedrapapeltesoura'],
    execute: async (msg, args) => {
        const opcoes = ['pedra', 'papel', 'tesoura'];
        const emojis = { pedra: '🪨', papel: '📄', tesoura: '✂️' };
        const escolha = args[0]?.toLowerCase();
        if (!opcoes.includes(escolha)) return msg.reply(`Escolha uma opção: \`pedra\`, \`papel\` ou \`tesoura\`!`);
        const bot = opcoes[Math.floor(Math.random() * 3)];
        let resultado;
        if (escolha === bot) resultado = '🤝 Empate!';
        else if ((escolha === 'pedra' && bot === 'tesoura') || (escolha === 'papel' && bot === 'pedra') || (escolha === 'tesoura' && bot === 'papel')) resultado = '🏆 Você ganhou!';
        else resultado = '💀 Você perdeu!';
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('✂️ Pedra, Papel e Tesoura')
            .addFields(
                { name: 'Você', value: `${emojis[escolha]} ${escolha}`, inline: true },
                { name: 'Bot', value: `${emojis[bot]} ${bot}`, inline: true },
                { name: 'Resultado', value: resultado }
            );
        msg.reply({ embeds: [embed] });
    }
};