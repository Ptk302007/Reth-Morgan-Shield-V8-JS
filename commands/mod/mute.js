const { EmbedBuilder } = require('discord.js');
const fs = require('fs');

module.exports = {
    name: 'tempmute',
    aliases: ['mutar', 'timeout'],
    execute: async (msg, args, client, OWNER_ID) => {
        if (!msg.member.permissions.has('ModerateMembers')) {
            return msg.reply('❌ Permissão insuficiente (`Moderar Membros`).');
        }

        const usuario = msg.mentions.members.first() || msg.guild.members.cache.get(args[0]);
        const tempoStr = args[1]; // Ex: 30m, 1h, 1d
        const motivo = args.slice(2).join(' ') || 'Motivo não especificado pela staff.';

        if (!usuario || !tempoStr) {
            return msg.reply('❌ **Uso Incorreto:** Use `r!tempmute @membro [tempo: 10m/2h/1d] [motivo]`');
        }

        let milissegundos = 0;
        const valor = parseInt(tempoStr);
        if (tempoStr.endsWith('m')) milissegundos = valor * 60 * 1000;
        else if (tempoStr.endsWith('h')) milissegundos = valor * 60 * 60 * 1000;
        else if (tempoStr.endsWith('d')) milissegundos = valor * 24 * 60 * 60 * 1000;
        else return msg.reply('❌ **Formato Inválido:** Use m (minutos), h (horas) ou d (dias). Ex: `15m`');

        try {
            await usuario.timeout(milissegundos, motivo);

            // Grava na Database para monitoramento e histórico criminal
            let dados = JSON.parse(fs.readFileSync('./database/punicoes.json', 'utf-8'));
            if (!dados[msg.guild.id]) dados[msg.guild.id] = {};
            if (!dados[msg.guild.id][usuario.id]) dados[msg.guild.id][usuario.id] = { warns: 0, mutes: 0, bans: 0, historico: [] };
            
            dados[msg.guild.id][usuario.id].mutes++;
            dados[msg.guild.id][usuario.id].muteAtivo = { expiresAt: Date.now() + milissegundos };
            dados[msg.guild.id][usuario.id].historico.push({
                tipo: 'MUTE', motivo: motivo, data: new Date().toLocaleDateString('pt-BR')
            });
            fs.writeFileSync('./database/punicoes.json', JSON.stringify(dados, null, 2));

            const embedMute = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('🤐 INFRAÇÃO CONCLUÍDA: MEMBRO SILENCIADO')
                .setDescription(`O infrator <@${usuario.id}> foi silenciado com sucesso pelo sistema.`)
                .addFields(
                    { name: '⏳ Período', value: `\`${tempoStr}\``, inline: true },
                    { name: '👮 Oficial Responsável', value: `<@${msg.author.id}>`, inline: true },
                    { name: '📝 Motivação', value: `\`${motivo}\``, inline: false }
                );
            return msg.reply({ embeds: [embedMute] });
        } catch (e) {
            return msg.reply('❌ Não foi possível mutar este membro (cargo dele pode ser maior que o meu).');
        }
    }
};