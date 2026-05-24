module.exports = {
    name: 'userinfo',
    aliases: ['ui', 'usuario'],
    execute: async (msg, args) => {
        // Busca o membro por menção, ID ou pega o próprio autor
        const membro = msg.mentions.members.first() || msg.guild.members.cache.get(args[0]) || msg.member;
        const { user } = membro;

        // Formata as datas para o padrão brasileiro (Dia/Mês/Ano)
        const contaCriada = user.createdAt.toLocaleDateString('pt-BR');
        const entrouNoServer = membro.joinedAt.toLocaleDateString('pt-BR');
        
        // Mapeia os cargos do usuário (removendo o @everyone que vem por padrão)
        const cargos = membro.roles.cache
            .filter(r => r.id !== msg.guild.id)
            .map(r => r.name)
            .join(', ') || 'Nenhum cargo';

        msg.reply(
            `👤 **INFORMAÇÕES DE DO USUÁRIO**\n\n` +
            `• **Nome de Usuário:** ${user.tag}\n` +
            `• **ID do Discord:** \`${user.id}\`\n` +
            `• **Conta Criada em:** ${contaCriada}\n` +
            `• **Entrou no Servidor em:** ${entrouNoServer}\n` +
            `• **É Bot?** ${user.bot ? 'Sim 🤖' : 'Não 👤'}\n` +
            `• **Cargos:** \`${cargos}\``
        );
    }
};