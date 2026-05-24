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

        // Avisa que a limpeza profunda começou (evita travar o chat)
        await msg.delete().catch(() => {});
        const avisoIniciando = await msg.channel.send('🧹 *Iniciando varredura e limpeza profunda no canal...*');

        try {
            // Puxa as mensagens do canal baseado na quantidade desejada
            const mensagens = await msg.channel.messages.fetch({ limit: quantidade });
            
            // Separa o que tem menos de 14 dias do que é antigo
            const tempoLimite = Date.now() - 14 * 24 * 60 * 60 * 1000;
            const mensagensNovas = mensagens.filter(m => m.createdTimestamp > tempoLimite && !m.pinned);
            const mensagensAntigas = mensagens.filter(m => m.createdTimestamp <= tempoLimite && !m.pinned);

            let totalApagadas = 0;

            // 1. Apaga as mensagens novas de forma rápida (Bulk Delete)
            if (mensagensNovas.size > 0) {
                const apagadasBulk = await msg.channel.bulkDelete(mensagensNovas, true);
                totalApagadas += apagadasBulk.size;
            }

            // Apaga a mensagem de aviso inicial para não poluir
            await avisoIniciando.delete().catch(() => {});

            // 2. SISTEMA SEM LIMITES (Modo Mecânico): Apaga as mensagens antigas uma por uma
            if (mensagensAntigas.size > 0 && totalApagadas < quantidade) {
                for (const [, mensagem] of mensagensAntigas) {
                    if (totalApagadas >= quantidade) break;
                    await mensagem.delete().catch(() => {});
                    totalApagadas++;
                    // Pequena pausa mecânica de 200 milissegundos para não tomar bloqueio (Rate Limit) do Discord
                    await new Promise(resolve => setTimeout(resolve, 200)); 
                }
            }

            // EMBED PREMIUM DE CONCLUSÃO
            const sucessoClear = new EmbedBuilder()
                .setColor('#2b2d31') // Estética escura padrão do Reth
                .setTitle('🧹 RETH MORGAN — SANITIZAÇÃO CONCLUÍDA')
                .setDescription(`O canal de texto foi limpo e reestruturado com sucesso.`)
                .addFields(
                    { name: '🧹 Mensagens Solicitadas', value: `\`${quantidade}\``, inline: true },
                    { name: '🧼 Total Expurgado', value: `\`${totalApagadas}\``, inline: true },
                    { name: '⚡ Operador', value: `<@${msg.author.id}>`, inline: false }
                )
                .setFooter({ text: `Faxina Concluída com Sucesso` })
                .setTimestamp();

            // Envia o relatório e apaga ele sozinho depois de 5 segundos para o chat ficar 100% limpo
            return msg.channel.send({ embeds: [sucessoEmbed = sucessoClear] }).then(m => {
                setTimeout(() => m.delete().catch(() => {}), 5000);
            });

        } catch (error) {
            console.error('Erro no comando de clear:', error);
            return msg.channel.send('❌ Ocorreu um erro interno ao tentar limpar as mensagens deste canal.');
        }
    }
};