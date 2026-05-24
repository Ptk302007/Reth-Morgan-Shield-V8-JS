// Arquivo: commands/moderation/massdm.js
const { PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'massdm',
    execute: async (msg, args, client, OWNER_ID) => {
        if (!msg.member.permissions.has(PermissionsBitField.Flags.Administrator) && msg.author.id !== OWNER_ID) {
            return msg.reply('❌ Apenas administradores legítimos podem disparar o MassDM.');
        }

        const cargo = msg.mentions.roles.first() || msg.guild.roles.cache.get(args[0]);
        const texto = args.slice(1).join(' ');

        if (!cargo || !texto) return msg.reply('❌ **Uso Correto:** \`r!massdm @cargo [mensagem]\`');

        const aviso = await msg.reply(`📡 Enviando DM para todos com o cargo ${cargo.name}...`);
        let contagem = 0;

        for (const [, membro] of cargo.members) {
            if (membro.user.bot) continue;
            await membro.send(`📢 **AVISO GERAL DO SERVIDOR [${msg.guild.name}]:**\n\n${texto}`).then(() => {
                contagem++;
            }).catch(() => {});
        }

        return aviso.edit(`🟩 **Envio concluído!** \`${contagem}\` membros receberam o aviso em suas caixas privadas.`);
    }
};