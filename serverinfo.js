module.exports = {
    name: 'serverinfo',
    aliases: ['si', 'server'],
    execute: async (msg) => {
        const { guild } = msg;

        // Puxa todos os membros para a memória para fazer a contagem precisa de bots vs humanos
        const membrosFetch = await guild.members.fetch();
        const totalMembros = guild.memberCount;
        const bots = membrosFetch.filter(m => m.user.bot).size;
        const humanos = totalMembros - bots;

        // Contagem de canais
        const canaisTexto = guild.channels.cache.filter(c => c.type === 0).size; // 0 = Texto
        const canaisVoz = guild.channels.cache.filter(c => c.type === 2).size;  // 2 = Voz

        const dataCriacao = guild.createdAt.toLocaleDateString('pt-BR');

        msg.reply(
            `🏰 **INFORMAÇÕES DO SERVIDOR**\n\n` +
            `• **Nome:** ${guild.name}\n` +
            `• **ID do Servidor:** \`${guild.id}\`\n` +
            `• **Dono do Server:** <@${guild.ownerId}>\n` +
            `• **Criado em:** ${dataCriacao}\n\n` +
            `📊 **Estatísticas de Membros:**\n` +
            `• Total de Usuários: **${totalMembros}**\n` +
            `• Humanos: \`${humanos}\` | Bots: \`${bots}\`\n\n` +
            `💬 **Canais:**\n` +
            `• Texto: \`${canaisTexto}\` | Voz: \`${canaisVoz}\``
        );
    }
};