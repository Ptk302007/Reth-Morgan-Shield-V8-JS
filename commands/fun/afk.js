const { EmbedBuilder } = require('discord.js');
const fs = require('fs');

module.exports = {
    name: 'afk',
    aliases: ['ausente', 'sair'],
    execute: async (msg, args, client, OWNER_ID) => {
        // Carrega ou inicializa a base de dados de punições/utilidades
        let dados = {};
        try {
            const conteudo = fs.readFileSync('./database/punicoes.json', 'utf-8');
            if (conteudo.trim()) dados = JSON.parse(conteudo);
        } catch (e) {
            dados = {};
        }

        if (!dados[msg.guild.id]) dados[msg.guild.id] = {};

        const motivo = args.join(' ') || 'Motivo não informado.';

        // Define o status AFK do usuário na Database
        dados[msg.guild.id][msg.author.id] = {
            ...dados[msg.guild.id][msg.author.id],
            afk: {
                ativo: true,
                motivo: motivo,
                timestamp: Date.now()
            }
        };

        fs.writeFileSync('./database/punicoes.json', JSON.stringify(dados, null, 2));

        const afkEmbed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('💤 MODO AUSENTE ATIVADO')
            .setDescription(`<@${msg.author.id}> entrou em modo AFK.`)
            .addFields({ name: '📝 Motivo da Ausência', value: `\`${motivo}\`` })
            .setFooter({ text: 'O sistema irá notificar quem te marcar. Digite algo para voltar.' })
            .setTimestamp();

        // Altera o apelido (nickname) do usuário para incluir [AFK] se o bot tiver permissão
        if (msg.member.manageable) {
            msg.member.setNickname(`[AFK] ${msg.member.displayName}`).catch(() => {});
        }

        return msg.reply({ embeds: [afkEmbed] });
    }
};