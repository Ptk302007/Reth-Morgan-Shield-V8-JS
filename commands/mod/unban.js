module.exports = {
    name: 'unban',
    aliases: ['desbanir'],
    execute: async (msg, args) => {
        if (!msg.member.permissions.has('BanMembers')) {
            return msg.reply('❌ Você não tem permissão para desbanir membros.');
        }

        const idUsuario = args[0];
        if (!idUsuario) return msg.reply('❌ Você precisa digitar o ID do usuário para desbanir. Exemplo: \`!unban 1507543140800921610\`');

        try {
            // Busca nos banimentos do servidor se esse ID existe
            const banimento = await msg.guild.bans.fetch(idUsuario);
            
            if (!banimento) {
                return msg.reply('❌ Esse ID não está banido neste servidor.');
            }

            await msg.guild.bans.remove(idUsuario);
            msg.reply(`✅ Usuário **${banimento.user.tag}** (\`${idUsuario}\`) foi desbanido com sucesso!`);
            
        } catch (error) {
            msg.reply('❌ Não encontrei nenhum banimento com esse ID ou o usuário já foi desbanido.');
        }
    }
};