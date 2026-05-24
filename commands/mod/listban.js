module.exports = {
    name: 'banlist',
    aliases: ['banidos'],
    execute: async (msg) => {
        if (!msg.member.permissions.has('BanMembers')) {
            return msg.reply('❌ Você não tem permissão para ver os banidos.');
        }

        try {
            const listaBans = await msg.guild.bans.fetch();
            if (listaBans.size === 0) return msg.reply('🕊️ Este servidor não tem nenhum usuário banido.');

            // Pega os primeiros 20 banidos para não estourar o limite de caracteres do Discord
            const banidos = listaBans.first(20).map(b => `• **${b.user.tag}** (\`${b.user.id}\`)`).join('\n');
            const total = listaBans.size;

            msg.reply(`🚫 **Lista de Banidos (Mostrando até 20 de ${total}):**\n\n${banidos}`);
        } catch (error) {
            console.error(error);
            msg.reply('❌ Não foi possível carregar a lista de banidos.');
        }
    }
};