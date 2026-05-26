const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'clear',
    aliases: ['limpar', 'vassoura', 'purge'],
    execute: async (msg, args, client, OWNER_ID) => {
        const eDonoSupremo = msg.author.id === OWNER_ID;
        const eDonoServer = msg.author.id === msg.guild.ownerId;

        // Apenas quem manda no servidor ou você limpa o chat
        if (!eDonoSupremo && !eDonoServer && !msg.member.permissions.has('ManageMessages')) {
            return msg.reply('👑 **Acesso Negado.** Você não possui permissão de `Gerenciar Mensagens` para limpar o chat.');
        }

        // Quantidade de mensagens
        const quantidade = parseInt(args[0]);

        if (isNaN(quantidade) || quantidade < 1 || quantidade > 1000) {
            const erroEmbed = new EmbedBuilder()
                .setColor('#f53b57')
                .setTitle('❌ PARÂMETRO INVÁLIDO')
                .setDescription('Determine uma quantia real de mensagens para a varredura.\n\n*Uso correto: `r!clear [1 a 1000]`*');
            return msg.reply({ embeds: [erroEmbed] });
        }

        // Avisa que a limpeza profunda começou
        await msg.delete().catch(() => {});
        const avisoIniciando = await msg.channel.send('🧹 *Iniciando varredura e limpeza profunda no canal...*');

        try {
            const tempoLimite = Date.now() - 14 * 24 * 60 * 60 * 1000;
            let totalApagadas = 0;
            let restante = quantidade;
            let ultimoId = null;

            // Busca em lotes de até 100 (limite da API do Discord)
            while (restante > 0) {
                const lote = Math.min(restante, 100);

                const opcoesFetch = { limit: lote };
                if (ultimoId) opcoesFetch.before = ultimoId;

                const mensagens = await msg.channel.messages.fetch(opcoesFetch);

                if (mensagens.size === 0) break;

                // Atualiza o cursor para o próximo lote
                ultimoId = mensagens.last().id;

                // Separa novas (bulk) e antigas (uma por uma)
                const mensagensNovas = mensagens.filter(m => m.createdTimestamp > tempoLimite && !m.pinned);
                const mensagensAntigas = mensagens.filter(m => m.createdTimestamp <= tempoLimite && !m.pinned);

                // Bulk delete nas mensagens novas
                if (mensagensNovas.size > 0) {
                    const apagadasBulk = await msg.channel.bulkDelete(mensagensNovas, true);
                    totalApagadas += apagadasBulk.size;
                }

                // Delete individual nas mensagens antigas
                for (const [, mensagem] of mensagensAntigas) {
                    if (totalApagadas >= quantidade) break;
                    await mensagem.delete().catch(() => {});
                    totalApagadas++;
                    // Pausa de 200ms para evitar Rate Limit
                    await new Promise(resolve => setTimeout(resolve, 200));
                }

                restante -= mensagens.size;

                // Se já apagou o suficiente, para
                if (totalApagadas >= quantidade) break;
            }

            // Apaga o aviso inicial
            await avisoIniciando.delete().catch(() => {});

            // EMBED PREMIUM DE CONCLUSÃO
            const sucessoClear = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('🧹 RETH MORGAN — SANITIZAÇÃO CONCLUÍDA')
                .setDescription(`O canal de texto foi limpo e reestruturado com sucesso.`)
                .addFields(
                    { name: '🧹 Mensagens Solicitadas', value: `\`${quantidade}\``, inline: true },
                    { name: '🧼 Total Expurgado', value: `\`${totalApagadas}\``, inline: true },
                    { name: '⚡ Operador', value: `<@${msg.author.id}>`, inline: false }
                )
                .setFooter({ text: `Faxina Concluída com Sucesso` })
                .setTimestamp();

            // Envia o relatório e apaga depois de 5 segundos
            return msg.channel.send({ embeds: [sucessoClear] }).then(m => {
                setTimeout(() => m.delete().catch(() => {}), 5000);
            });

        } catch (error) {
            console.error('Erro no comando de clear:', error);
            await avisoIniciando.delete().catch(() => {});
            return msg.channel.send('❌ Ocorreu um erro interno ao tentar limpar as mensagens deste canal.');
        }
    }
};
