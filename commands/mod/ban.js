module.exports = {
    name: 'ban',
    aliases: ['banir'],
    execute: async (msg, args) => {
        if (!msg.member.permissions.has('BanMembers')) {
            return msg.reply('❌ Você não tem permissão para banir membros.');
        }

        // Pega por menção ou busca pelo ID digitado
        const target = msg.mentions.members.first() || msg.guild.members.cache.get(args[0]);
        if (!target) return msg.reply('❌ Uso correto: \`!ban [@usuario ou ID] [motivo]\`');

        if (!target.bannable) {
            return msg.reply('❌ Eu não posso banir este usuário. O cargo dele pode ser maior que o meu.');
        }

        const motivo = args.slice(1).join(' ') || 'Nenhum motivo informado.';

        try {
            await target.ban({ reason: motivo });
            msg.reply(`🔨 **${target.user.tag}** foi banido com sucesso!\n📝 Motivo: *${motivo}*`);
        } catch (error) {
            console.error(error);
            msg.reply('❌ Erro interno ao tentar banir o usuário.');
        }
    }
};