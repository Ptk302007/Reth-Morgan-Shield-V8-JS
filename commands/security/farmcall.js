const { joinVoiceChannel } = require('@discordjs/voice');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'farmcall',
    aliases: ['joinvoice', 'farm', 'conectar'],
    execute: async (msg, args, client, OWNER_ID) => {
        const eDonoSupremo = msg.author.id === OWNER_ID;
        const eDonoServer = msg.author.id === msg.guild.ownerId;

        // Apenas o dono do bot ou a coroa do servidor gerencia o farm
        if (!eDonoSupremo && !eDonoServer) {
            return msg.reply('👑 **Acesso Negado.** Comando restrito à administração.');
        }

        const idCanal = args[0];
        if (!idCanal) {
            const erroEmbed = new EmbedBuilder()
                .setColor('#f53b57')
                .setTitle('❌ ERRO DE PARÂMETRO')
                .setDescription('Você precisa fornecer o ID do canal de voz.\n\n*Uso correto: `r!farmcall [ID_DA_CALL]`*');
            return msg.reply({ embeds: [erroEmbed] });
        }

        // Busca se o canal de voz realmente existe no servidor
        const canal = msg.guild.channels.cache.get(idCanal);
        if (!canal || (canal.type !== 2 && canal.type !== 13)) { // 2 = Voz, 13 = Palco/Stage
            return msg.reply('❌ **Canal Inválido.** Certifique-se de colar o ID de um canal de voz real deste servidor.');
        }

        try {
            // Executa a conexão mecânica com a call
            joinVoiceChannel({
                channelId: canal.id,
                guildId: msg.guild.id,
                adapterCreator: msg.guild.voiceAdapterCreator,
                selfMute: true, // Liga mutado para não gastar sua internet/hardware à toa
                selfDeaf: true  // Liga surdo para poupar processamento
            });

            const sucessoEmbed = new EmbedBuilder()
                .setColor('#2b2d31') // Mantendo a identidade premium do Reth
                .setTitle('🎙️ RETH MORGAN — INFILTRAÇÃO DE VOZ')
                .setDescription(`O bot se conectou com sucesso e iniciou o farm de tempo de forma silenciosa.`)
                .addFields(
                    { name: '🔊 Canal Conectado', value: `\`${canal.name}\``, inline: true },
                    { name: '🆔 ID da Call', value: `\`${canal.id}\``, inline: true },
                    { name: '🛡️ Estado', value: `🟢 \`SISTEMA MUTADO / SURDO\``, inline: false }
                )
                .setTimestamp();

            return msg.reply({ embeds: [sucessoEmbed] });

        } catch (error) {
            console.error(error);
            msg.reply('❌ Ocorreu um erro crítico ao tentar injetar o bot no canal de voz.');
        }
    }
};