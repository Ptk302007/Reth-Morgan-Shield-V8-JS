const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'setcargo',
    aliases: ['setrole', 'dar-cargo'],
    ownerOnly: true,
    execute: async (msg, args, client, OWNER_ID) => {
        // Trava de segurança
        if (msg.author.id !== OWNER_ID) {
            return msg.reply('👑 **Acesso Restrito.** Apenas o Desenvolvedor Supremo do Reth Morgan pode gerenciar cargos.');
        }

        const membro = msg.mentions.members.first();
        const cargo = msg.mentions.roles.first() || msg.guild.roles.cache.get(args[1]);

        if (!membro || !cargo) {
            return msg.reply('❌ **Uso incorreto.** Tente: `r!setcargo @membro @cargo`');
        }

        try {
            // Verifica se o bot tem permissão de gerenciar cargos
            if (!msg.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                return msg.reply('❌ O bot não tem permissão para gerenciar cargos.');
            }

            // Tenta adicionar o cargo
            await membro.roles.add(cargo);

            const embedSucesso = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('✅ CARGO ATRIBUÍDO')
                .setDescription(`O cargo **${cargo.name}** foi atribuído com sucesso para **${membro.user.username}**.`)
                .setTimestamp();

            return msg.reply({ embeds: [embedSucesso] });

        } catch (error) {
            console.error(error);
            return msg.reply('❌ Erro ao atribuir cargo. Verifique se o meu cargo está acima do cargo que desejo atribuir na hierarquia.');
        }
    }
};