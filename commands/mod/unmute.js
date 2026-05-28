'use strict';
// ============================================================
//  RETH MORGAN — UNMUTE COMMAND
//  Remove mute/timeout com embed rico e log completo.
// ============================================================
const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');

function getConfig(guildId) {
    try { return JSON.parse(fs.readFileSync('./database/config.json','utf-8'))[guildId] || {}; }
    catch { return {}; }
}
async function enviarLog(guild, tipoLog, embed) {
    try {
        const sc = getConfig(guild.id);
        const canalId = sc[tipoLog] || sc['logs_staff'] || sc['logs_seguranca'];
        if (!canalId) return;
        const canal = guild.channels.cache.get(canalId);
        if (canal) canal.send({ embeds: [embed] }).catch(() => {});
    } catch {}
}

module.exports = {
    name: 'unmute',
    aliases: ['desmutar', 'dessilenciar'],

    execute: async (message, args, client, OWNER_ID) => {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#8B0000').setTitle('🔒 ACESSO NEGADO')
                    .setDescription('Você não possui permissão para remover mutes.').setTimestamp()
                ]
            });
        }

        const alvo = message.mentions.members.first()
            || (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);

        if (!alvo) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#1a0000').setTitle('🩸 RETH MORGAN — UNMUTE')
                    .setDescription('**Uso:** `r!unmute @usuário [motivo]`\n**Exemplo:** `r!unmute @fulano Tempo de punição cumprido`')
                    .setTimestamp()
                ]
            });
        }

        if (!alvo.communicationDisabledUntil || alvo.communicationDisabledUntil <= Date.now()) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#2c2c2c').setTitle('ℹ️ SEM MUTE ATIVO')
                    .setThumbnail(alvo.user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setDescription(`**${alvo.user.tag}** não está mutado no momento.`)
                    .setTimestamp()
                ]
            });
        }

        const motivo = args.slice(1).join(' ') || 'Remoção de mute por moderação.';

        const msgLoad = await message.channel.send({
            embeds: [new EmbedBuilder()
                .setColor('#1a3a1a').setTitle('⚙️ REMOVENDO MUTE...')
                .setDescription('`Verificando mute ativo...`\n`Restaurando permissões...`')
                .setTimestamp()
            ]
        });

        try {
            await alvo.timeout(null, `[${message.author.tag}] ${motivo}`);
        } catch (e) {
            return msgLoad.edit({
                embeds: [new EmbedBuilder().setColor('#8B0000').setTitle('❌ FALHA')
                    .setDescription(`Erro ao desmutar: \`${e.message}\``).setTimestamp()]
            });
        }

        // Atualiza registro
        try {
            let dados = JSON.parse(fs.readFileSync('./database/punicoes.json','utf-8'));
            if (dados[message.guild.id]?.[alvo.id]) {
                delete dados[message.guild.id][alvo.id].muteAtivo;
                fs.writeFileSync('./database/punicoes.json', JSON.stringify(dados, null, 2));
            }
        } catch {}

        // DM
        try {
            await alvo.send({
                embeds: [new EmbedBuilder()
                    .setColor('#1a4a1a')
                    .setAuthor({ name: 'RETH MORGAN SHIELD SYSTEM', iconURL: client.user.displayAvatarURL() })
                    .setTitle(`🔊 SEU MUTE FOI REMOVIDO EM ${message.guild.name.toUpperCase()}`)
                    .addFields(
                        { name: '📋 MOTIVO', value: motivo, inline: false },
                        { name: '🔫 MODERADOR', value: message.author.tag, inline: true }
                    )
                    .setFooter({ text: 'Continue seguindo as regras.' })
                    .setTimestamp()
                ]
            });
        } catch {}

        const embedResult = new EmbedBuilder()
            .setColor('#1a4a1a')
            .setAuthor({ name: 'RETH MORGAN — MUTE REMOVIDO', iconURL: client.user.displayAvatarURL() })
            .setThumbnail(alvo.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTitle('🔊 UNMUTE EXECUTADO COM SUCESSO')
            .setDescription('> *"A voz é restaurada. A vigilância, mantida."*\n> — Reth Morgan')
            .addFields(
                { name: '👤 DESMUTADO', value: `<@${alvo.id}>\n\`${alvo.user.tag}\``, inline: true },
                { name: '🔫 EXECUTOR',  value: `<@${message.author.id}>\n\`${message.author.tag}\``, inline: true },
                { name: '📋 MOTIVO',    value: `\`\`\`${motivo}\`\`\``, inline: false },
                { name: '📅 DATA & HORA', value: `<t:${Math.floor(Date.now()/1000)}:F>`, inline: false }
            )
            .setFooter({ text: `${message.guild.name} · Shield System V8`, iconURL: message.guild.iconURL() || undefined })
            .setTimestamp();

        await msgLoad.edit({ embeds: [embedResult] });

        const logEmbed = new EmbedBuilder()
            .setColor('#1a4a1a')
            .setAuthor({ name: 'UNMUTE EXECUTADO', iconURL: message.author.displayAvatarURL() })
            .setThumbnail(alvo.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTitle('🔊 LOG — UNMUTE')
            .addFields(
                { name: '👤 DESMUTADO', value: `<@${alvo.id}> · \`${alvo.user.tag}\` · \`${alvo.id}\``, inline: false },
                { name: '🔫 EXECUTOR',  value: `<@${message.author.id}> · \`${message.author.tag}\``, inline: true },
                { name: '📋 MOTIVO',    value: motivo, inline: true },
                { name: '📅 DATA',      value: `<t:${Math.floor(Date.now()/1000)}:F>`, inline: false }
            )
            .setFooter({ text: `Guild ID: ${message.guild.id}` })
            .setTimestamp();

        await enviarLog(message.guild, 'logs_mute', logEmbed);
    }
};