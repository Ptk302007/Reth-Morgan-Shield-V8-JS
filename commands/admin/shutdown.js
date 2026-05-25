const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'shutdown',
    aliases: ['desligar', 'reiniciar', 'reboot'],
    ownerOnly: true, // Garante que só você (PT) possa rodar
    execute: async (msg, args, client, OWNER_ID) => {
        // Trava de segurança máxima no código
        if (msg.author.id !== OWNER_ID) {
            return msg.reply('👑 **Acesso Restrito.** Apenas o Desenvolvedor Supremo do Reth Morgan pode alterar o status vital do sistema.');
        }

        // --- DEFINIÇÃO DOS EMOJIS ---
        const emoji_desligar = '🔴'; // Vermelho para Desligar
        const emoji_reiniciar = '🔄'; // Setas para Reiniciar
        const emoji_cancelar = '❌'; // X para Cancelar

        // --- EMBED DE SELEÇÃO INICIAL ---
        const selecaoEmbed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('🚨 PROTOCOLO DE GERENCIAMENTO DE SISTEMA')
            .setDescription(
                `Status: **Ativo e Protegendo.**\n\n` +
                `Por favor, PT, selecione a ação de gerenciamento que deseja executar:\n\n` +
                `${emoji_desligar} **Desligar Completamente:** Encerra todos os serviços.\n\n` +
                `${emoji_reiniciar} **Reiniciar Módulos (Reboot):** Faz o reload de comandos e login.\n\n` +
                `${emoji_cancelar} **Cancelar Protocolo**`
            )
            .setFooter({ text: 'Sistema Reth Morgan Shield | Desenvolvido por PT 👑' })
            .setTimestamp();

        // Envia a embed e adiciona as reações
        const painel = await msg.reply({ embeds: [selecaoEmbed], fetchReply: true });
        
        try {
            await painel.react(emoji_desligar);
            await painel.react(emoji_reiniciar);
            await painel.react(emoji_cancelar);
        } catch (e) {
            console.error("Erro ao adicionar reações:", e);
        }

        // --- COLETOR DE REAÇÕES (Filtro) ---
        const filter = (reaction, user) => {
            // Só aceita os emojis específicos e só reações do dono
            return [emoji_desligar, emoji_reiniciar, emoji_cancelar].includes(reaction.emoji.name) && user.id === OWNER_ID;
        };

        // Coletor para esperar a resposta por 30 segundos
        const collector = painel.createReactionCollector({ filter, time: 30000, max: 1 });

        collector.on('end', async (collected, reason) => {
            // Remove todas as reações para limpar a embed
            await painel.reactions.removeAll().catch(e => console.error(e));

            // Se o tempo esgotar
            if (reason === 'time') {
                const tempoEmbed = new EmbedBuilder()
                    .setColor('#f53b57')
                    .setTitle('⏱️ TEMPO ESGOTADO')
                    .setDescription('A operação de gerenciamento de sistema foi cancelada por inatividade. Tudo permanece em execução.');
                return painel.edit({ embeds: [tempoEmbed] });
            }

            const reacaoLog = collected.first();
            if (!reacaoLog) return; // Se não houver reações

            const nomeEmoji = reacaoLog.emoji.name;

            // --- LÓGICA DE AÇÃO ---

            // 1. AÇÃO: CANCELAR
            if (nomeEmoji === emoji_cancelar) {
                const cancelarEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('✅ PROTOCOLO CANCELADO')
                    .setDescription('Ação de gerenciamento cancelada com sucesso. O sistema permanece **ONLINE**.');
                return painel.edit({ embeds: [cancelarEmbed] });
            }

            // 2. AÇÃO: DESLIGAR COMPLEMENTE
            if (nomeEmoji === emoji_desligar) {
                const desligarEmbed = new EmbedBuilder()
                    .setColor('#313338')
                    .setTitle('⚠️ DESLIGANDO SISTEMA')
                    .setDescription('O sistema Reth Morgan está encerrando suas atividades por ordem direta do PT.\nObrigado por utilizar nossos serviços.\n\nStatus: **ENCERRANDO**');
                await painel.edit({ embeds: [desligarEmbed] });
                
                console.log(`[Reth Morgan Shield] Comando de desligamento executado por PT.`);
                // Pequeno delay para garantir a edição da embed
                setTimeout(() => {
                    process.exit(0); // Fecha o processo Node.js
                }, 1000); 
                return;
            }

            // 3. AÇÃO: REINICIAR (Reboot)
            if (nomeEmoji === emoji_reiniciar) {
                const reiniciarEmbed = new EmbedBuilder()
                    .setColor('#2b2d31')
                    .setTitle('🔄 REINICIANDO MÓDULOS')
                    .setDescription('O sistema Reth Morgan está realizando um reload de comandos e fazendo relogin.\nAguarde alguns segundos...\n\nStatus: **REINICIANDO**');
                await painel.edit({ embeds: [reiniciarEmbed] });

                console.log(`[Reth Morgan Shield] Comando de reiniciar executado por PT. Reiniciando...`);
                
                // Reiniciar exige um relogin e reload de comandos. É um pouco complexo de fazer de forma limpa.
                // Esta implementação simples reloca o token e recarrega os módulos.
                
                setTimeout(() => {
                    // Desloga o cliente
                    client.destroy();
                    // Limpa o cache de comandos (para reload de arquivos js)
                    client.commands.clear();
                    
                    // Importa o index e reinicia a execução (precisa da variável de ambiente TOKEN)
                    // Este método reinicia a partir do ponto de execução atual.
                    delete require.cache[require.resolve('../../index.js')];
                    // Recarrega o index.js
                    require('../../index.js');
                    
                    // Nota: Para um reinício completo e limpo, geralmente usa-se o process.exit(1)
                    // e o bot roda dentro de um script de shell ou um container (ex: Docker) que o reinicia automaticamente.
                    // Este método aqui recarrega o login, mas não encerra de fato o processo Node.js.
                    
                    setTimeout(() => {
                        msg.channel.send(`⚙️ **[Compilador]** Módulos recarregados e login efetuado com sucesso.`).then(m => setTimeout(() => m.delete(), 5000));
                    }, 5000);
                }, 1000);
            }
        });
    }
};