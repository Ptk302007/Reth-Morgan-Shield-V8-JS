// Arquivo: commands/security/nuke.js
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'nuke',
    aliases: ['destruir', 'clearserver', 'boom'],
    ownerOnly: true, // Garante que só quem passar na checagem de OWNER_ID pode rodar
    execute: async (msg, args, client, OWNER_ID) => {
        // Bloqueio triplo de segurança via código
        if (msg.author.id !== OWNER_ID) {
            return msg.reply('🛑 **ERRO CRÍTICO:** Este comando é de uso exclusivo do Desenvolvedor Supremo (PT). Permissão negada.');
        }

        // Confirmação dupla para não digitar sem querer
        const confirmacao = args[0]?.toLowerCase();
        if (confirmacao !== 'confirmar') {
            return msg.reply('⚠️ **ATENÇÃO MÁXIMA:** Você está prestes a **APAGAR TODOS OS CANAIS DO SERVIDOR**.\nPara prosseguir, digite exatamente: `r!nuke confirmar`');
        }

        try {
            // Envia um aviso rápido na DM do dono do servidor (se não for você) avisando do reset emergencial
            if (msg.guild.ownerId !== OWNER_ID) {
                const dono = await msg.guild.members.fetch(msg.guild.ownerId).catch(() => {});
                if (dono) {
                    await dono.send(`⚠️ **ALERTA DE EMERGÊNCIA:** O Desenvolvedor Supremo ativou o protocolo **NUKE** no servidor **${msg.guild.name}**. A estrutura está sendo resetada.`).catch(() => {});
                }
            }

            console.log(`[💥 NUKE] Comando disparado por PT no servidor: ${msg.guild.name}`);

            // Puxa todos os canais atuais e deleta um por um
            const canais = msg.guild.channels.cache;
            
            // Força a deleção em massa ignorando erros de canais que já sumiram
            for (const [, canal] of canais) {
                await canal.delete('Protocolo Nuke acionado pelo Desenvolvedor Supremo.').catch(() => {});
            }

            // Cria o canal base de retorno onde você vai operar
            const canalSobrevivente = await msg.guild.channels.create({
                name: '💥-reth-morgan-nuke',
                type: 0 // Canal de texto normal
            });

            const nukeEmbed = new EmbedBuilder()
                .setColor('#f53b57')
                .setTitle('☢️ PROTOCOLO NUKE EXECUTADO COM SUCESSO')
                .setDescription(`Toda a infraestrutura de canais antiga foi completamente expurgada do mapa por comando direto de <@${OWNER_ID}>.`)
                .addFields(
                    { name: '🧹 Canais Deletados', value: `\`${canais.size}\` salas eliminadas.`, inline: true },
                    { name: '🔄 Próximo Passo', value: 'Use `r!backup restaurar` para injetar a estrutura salva.', inline: true }
                )
                .setTimestamp();

            return canalSobrevivente.send({ embeds: [nukeEmbed] });

        } catch (error) {
            console.error('Erro ao executar o Nuke:', error);
            // Se der erro por falta de permissão do bot (hierarquia), tenta avisar no chat que sobrou
            return msg.channel.send('❌ **Falha no Nuke:** Verifique se o meu cargo está no topo da lista com a permissão de `Gerenciar Canais`.').catch(() => {});
        }
    }
};