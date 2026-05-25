const { EmbedBuilder } = require('discord.js');
module.exports = {
    name: 'forca',
    aliases: ['hangman', 'enforca'],
    execute: async (msg) => {
        const palavras = ['discord', 'seguranca', 'servidor', 'moderacao', 'comando', 'musica', 'diversao', 'protecao', 'sistema', 'painel'];
        const palavra = palavras[Math.floor(Math.random() * palavras.length)];
        let erros = 0;
        const maxErros = 6;
        const letrasUsadas = new Set();
        let acertadas = new Set();
        const desenhos = ['😐','😟','😨','😰','😱','💀☠️'];
        const gerarDisplay = () => palavra.split('').map(l => acertadas.has(l) ? `**${l.toUpperCase()}**` : '\\_').join(' ');
        const gerarEmbed = () => new EmbedBuilder()
            .setColor(erros >= 5 ? '#e74c3c' : '#3498db')
            .setTitle(`🎯 Jogo da Forca ${desenhos[erros]}`)
            .setDescription(`Palavra: ${gerarDisplay()}\n\nErros: \`${erros}/${maxErros}\`\nLetras usadas: \`${[...letrasUsadas].join(', ') || 'nenhuma'}\`\n\nDigite uma letra no chat!`);
        const m = await msg.reply({ embeds: [gerarEmbed()] });
        const collector = msg.channel.createMessageCollector({ filter: r => r.author.id === msg.author.id, time: 120000 });
        collector.on('collect', async r => {
            const letra = r.content.toLowerCase().trim();
            await r.delete().catch(() => {});
            if (letra.length !== 1 || !/[a-z]/.test(letra)) return;
            if (letrasUsadas.has(letra)) return;
            letrasUsadas.add(letra);
            if (palavra.includes(letra)) {
                palavra.split('').forEach(l => { if (l === letra) acertadas.add(l); });
            } else { erros++; }
            if ([...palavra].every(l => acertadas.has(l))) {
                collector.stop('ganhou');
                return m.edit({ embeds: [new EmbedBuilder().setColor('#2ecc71').setTitle('🎉 Você ganhou!').setDescription(`A palavra era **${palavra.toUpperCase()}**!`)] });
            }
            if (erros >= maxErros) {
                collector.stop('perdeu');
                return m.edit({ embeds: [new EmbedBuilder().setColor('#e74c3c').setTitle('💀 Game Over!').setDescription(`A palavra era **${palavra.toUpperCase()}**. Tente novamente!`)] });
            }
            await m.edit({ embeds: [gerarEmbed()] });
        });
        collector.on('end', (_, reason) => { if (!['ganhou','perdeu'].includes(reason)) m.edit({ content: `⏰ Tempo esgotado! A palavra era **${palavra.toUpperCase()}**.`, embeds: [] }).catch(() => {}); });
    }
};