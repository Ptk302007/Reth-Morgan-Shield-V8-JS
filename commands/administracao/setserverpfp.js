const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'setserverpfp',
    description: 'Define a foto de perfil do servidor.',
    async execute(message, args, client) {
        if (!message.member.permissions.has('MANAGE_GUILD')) {
            const embed = new EmbedBuilder()
                .setColor('RED')
                .setDescription('PT, você não tem permissão pra fazer isso.');
            return message.reply({ embeds: [embed] });
        }

        let imageUrl;

        if (message.attachments.size > 0) {
            imageUrl = message.attachments.first().url;
        } else if (args[0]) {
            const urlRegex = /(http(s?):)([/|.|\w|\s|-])*\.(?:jpg|gif|png|webp)/g;
            if (urlRegex.test(args[0])) {
                imageUrl = args[0];
            }
        }

        if (!imageUrl) {
            const embed = new EmbedBuilder()
                .setColor('ORANGE')
                .setDescription('PT, me dá uma imagem. Anexa ou manda o link.');
            return message.reply({ embeds: [embed] });
        }

        try {
            await message.guild.setIcon(imageUrl);

            const embed = new EmbedBuilder()
                .setColor('GREEN')
                .setDescription('PT, foto do servidor atualizada!')
                .setImage(imageUrl)
                .setTimestamp();

            message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Erro ao mudar o ícone do servidor:', error);
            const embed = new EmbedBuilder()
                .setColor('RED')
                .setDescription('PT, não consegui mudar a foto do servidor. Tenta de novo.');
            message.reply({ embeds: [embed] });
        }
    }
};