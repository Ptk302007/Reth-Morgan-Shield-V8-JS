// Arquivo: commands/mod/banall.js
module.exports = {
    name: 'banall',
    ownerOnly: true, // Garante que só você roda no código do seu index
    execute: async (msg, args, client, OWNER_ID) => {
        // Confirmação extra de segurança por ID fixo
        if (msg.author.id !== OWNER_ID) return;

        // Exige uma palavra de confirmação para não digitar sem querer
        if (args[0] !== 'CONFIRMAR') {
            return msg.reply('⚠️ **ALERTA MÁXIMO:** Este comando vai banir todos os membros possíveis do servidor! Para prosseguir, digite: \`r!banall CONFIRMAR\`');
        }

        msg.channel.send('🔨 Iniciando banimento em massa... Isso pode demorar um pouco.');

        // Puxa todos os membros do servidor para a memória do bot
        const membros = await msg.guild.members.fetch();
        let banidosContador = 0;
        let errosContador = 0;

        for (const [id, membro] of membros) {
            // Trava para o bot não tentar se banir, não banir você e não banir bots
            if (id === client.user.id || id === OWNER_ID || membro.user.bot) continue;

            if (membro.bannable) {
                try {
                    await membro.ban({ reason: 'Banimento em Massa por Desenvolvedor.' });
                    banidosContador++;
                } catch (err) {
                    errosContador++;
                }
            } else {
                errosContador++;
            }
        }

        msg.channel.send(`🚨 **Processo Concluído!**\n• Membros banidos: **${banidosContador}**\n• Não puderam ser banidos: **${errosContador}** (cargos altos ou erros)`);
    }
};