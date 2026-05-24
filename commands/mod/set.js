const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'set',
    aliases: ['configbot', 'mudarbot'],
    ownerOnly: true, // Garante que só quem tem o ID cadastrado no index pode rodar
    execute: async (msg, args, client, OWNER_ID) => {
        // Trava de segurança máxima no código
        if (msg.author.id !== OWNER_ID) {
            return msg.reply('👑 **Acesso Restrito.** Apenas o Desenvolvedor Supremo do Reth Morgan pode alterar seus dados vitais.');
        }

        const tipo = args[0]?.toLowerCase();
        const parametro = args.slice(1).join(' ');

        if (!tipo || !parametro) {
            const erroEmbed = new EmbedBuilder()
                .setColor('#f53b57')
                .setTitle('❌ PARÂMETROS AUSENTES')
                .setDescription(
                    `Você precisa especificar o que deseja alterar e o novo valor.\n\n` +
                    `📝 **Mudar Nome:**\n\`r!set nome [Novo Nome]\`\n\n` +
                    `🖼️ **Mudar Foto (Avatar):**\n\`r!set foto [Link da Imagem .png ou .jpg]\``
                );
            return msg.reply({ embeds: [erroEmbed] });
        }

        try {
            // 1. ALTERAÇÃO DE NOME
            if (tipo === 'nome') {
                if (parametro.length < 2 || parametro.length > 32) {
                    return msg.reply('❌ O nome do bot precisa ter entre 2 e 32 caracteres.');
                }

                const nomeAntigo = client.user.username;
                await client.user.setUsername(parametro);

                const sucessoNome = new EmbedBuilder()
                    .setColor('#2b2d31')
                    .setTitle('📝 IDENTIDADE VISUAL ALTERADA')
                    .setDescription(`O nome global do sistema foi atualizado com sucesso.`)
                    .addFields(
                        { name: '❌ Nome Antigo', value: `\`${nomeAntigo}\``, inline: true },
                        { name: '🟩 Nome Novo', value: `\`${parametro}\``, inline: true }
                    )
                    .setTimestamp();

                return msg.reply({ embeds: [sucessoEmbed = sucessoNome] });
            }

            // 2. ALTERAÇÃO DE FOTO (AVATAR)
            else if (tipo === 'foto') {
                // Validação simples para ver se é um link
                if (!parametro.startsWith('http://') && !parametro.startsWith('https://')) {
                    return msg.reply('❌ Forneça um link de imagem válido (ex: que comece com https:// e termine em .png ou .jpg).');
                }

                await client.user.setAvatar(parametro);

                const sucessoFoto = new EmbedBuilder()
                    .setColor('#2b2d31')
                    .setTitle('🖼️ AVATAR DO SISTEMA ATUALIZADO')
                    .setDescription(`A nova foto de perfil do Reth Morgan foi injetada com sucesso.`)
                    .setImage(parametro) // Mostra a foto nova na embed pra confirmar
                    .setTimestamp();

                return msg.reply({ embeds: [sucessoEmbed = sucessoFoto] });
            } 
            
            else {
                return msg.reply('❌ Opção inválida. Use `r!set nome` ou `r!set foto`.');
            }

        } catch (error) {
            console.error(error);
            return msg.reply(
                `❌ **Erro de Limite (Rate Limit):** O Discord só permite mudar o nome ou foto do bot **2 vezes por hora** para evitar spam nos servidores deles. Se deu erro, aguarde alguns minutos e tente de novo!`
            );
        }
    }
};