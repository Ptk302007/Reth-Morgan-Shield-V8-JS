'use strict';
const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');

function getConfig(guildId) {
    try { return JSON.parse(fs.readFileSync('./database/config.json', 'utf-8'))[guildId] || {}; }
    catch { return {}; }
}

function registrarRemocao(guildId, userId, motivo) {
    try {
        let dados = {};
        try { dados = JSON.parse(fs.readFileSync('./database/punicoes.json', 'utf-8')); } catch {}
        if (!dados[guildId]?.[userId]) return;
        delete dados[guildId][userId].muteAtivo;
        dados[guildId][userId].historico.push({
            tipo: 'DESCASTIGO', motivo, data: new Date().toLocaleDateString('pt-BR')
        });
        fs.writeFileSync('./database/punicoes.json', JSON.stringify(dados, null, 2));
    } catch {}
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

function getUserTag(user) {
    if (!user) return 'Desconhecido';
    if (user.discriminator && user.discriminator !== '0') return `${user.username}#${user.discriminator}`;
    return user.username;
}

module.exports = {
    name: 'descastigar',
    aliases: ['soltar', 'untimeout', 'dessilenciar'],

    execute: async (message, args, client, OWNER_ID) => {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply({ embeds: [new EmbedBuilder().setColor('#8B0000').setTitle('🔒 ACESSO NEGADO').setDescription('Você não possui permissão para remover castigos.').setTimestamp()] });
        }
        if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply({ embeds: [new EmbedBuilder().setColor('#8B0000').setTitle('⚠️ SEM PERMISSÃO').setDescription('Não possuo permissão para remover timeouts.').setTimestamp()] });
        }

        const alvo = message.mentions.members.first()
            || (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);

        if (!alvo) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#1a0000').setTitle('🩸 RETH MORGAN — DESCASTIGAR')
                    .setDescription('**Uso:** `r!descastigar @usuário [motivo]`\n**Exemplos:**\n`r!descastigar @fulano Revisão de moderação`\n`r!descastigar @fulano Punição indevida`')
                    .setTimestamp()
                ]
            });
        }

        if (alvo.roles.highest.position >= message.member.roles.highest.position && message.author.id !== message.guild.ownerId) {
            return message.reply({ embeds: [new EmbedBuilder().setColor('#8B0000').setTitle('⛔ HIERARQUIA INSUFICIENTE').setDescription('Você não pode gerenciar punições de alguém com cargo igual ou superior ao seu.').setTimestamp()] });
        }

        // Verifica se está em castigo
        if (!alvo.communicationDisabledUntil || alvo.communicationDisabledUntil < new Date()) {
            return message.reply({
                embeds: [new EmbedBuilder().setColor('#8B0000').setTitle('⚠️ SEM CASTIGO ATIVO')
                    .setThumbnail(alvo.user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setDescription(`**${getUserTag(alvo.user)}** não está em castigo no momento.`)
                    .setTimestamp()]
            });
        }

        // Verifica se quem está removendo é quem aplicou
        let dados = {};
        try { dados = JSON.parse(fs.readFileSync('./database/punicoes.json', 'utf-8')); } catch {}
        const muteAtivo = dados[message.guild.id]?.[alvo.id]?.muteAtivo;
        const OWNER_IDS = [OWNER_ID, '1507543140800921610'];
        const ehDono    = OWNER_IDS.includes(message.author.id) || message.author.id === message.guild.ownerId;

        if (muteAtivo?.executorId && muteAtivo.executorId !== message.author.id && !ehDono) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#8B0000').setTitle('🔒 REMOÇÃO NÃO AUTORIZADA')
                    .setThumbnail(alvo.user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setDescription(`Apenas quem aplicou o castigo (<@${muteAtivo.executorId}>) pode removê-lo.`)
                    .addFields({ name: '💡 EXCEÇÃO', value: 'Donos do bot podem remover qualquer castigo.', inline: false })
                    .setTimestamp()
                ]
            });
        }

        const motivo   = args.slice(1).join(' ') || 'Revisão de moderação.';
        const sc       = getConfig(message.guild.id);
        const alvoTag  = getUserTag(alvo.user);
        const autorTag = getUserTag(message.author);
        const expiravaEm = Math.floor(alvo.communicationDisabledUntil.getTime() / 1000);

        const embedConfirm = new EmbedBuilder()
            .setColor('#1a4a1a')
            .setAuthor({ name: 'RETH MORGAN — REMOÇÃO DE CASTIGO', iconURL: client.user.displayAvatarURL() })
            .setThumbnail(alvo.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTitle('🔓 CONFIRMAÇÃO DE DESCASTIGO')
            .addFields(
                { name: '👤 ALVO',        value: `<@${alvo.id}>\n\`${alvoTag}\``, inline: true },
                { name: '⏰ EXPIRARIA',   value: `<t:${expiravaEm}:R>`, inline: true },
                { name: '📋 MOTIVO',      value: `\`\`\`${motivo}\`\`\``, inline: false },
                { name: '⚠️ AÇÃO',        value: 'Reaja ✅ para **confirmar** · ❌ para **cancelar**\n*Aguardando 30 segundos...*', inline: false }
            )
            .setFooter({ text: `Servidor: ${message.guild.name}`, iconURL: message.guild.iconURL() || undefined })
            .setTimestamp();

        const usarConfirmacao = sc.castigo_confirmacao !== false;
        const msgConfirm = await message.channel.send({ embeds: [embedConfirm] });

        if (usarConfirmacao) {
            await msgConfirm.react('✅').catch(() => {});
            await msgConfirm.react('❌').catch(() => {});

            const filter = (r, u) => ['✅', '❌'].includes(r.emoji.name) && u.id === message.author.id;
            const collector = msgConfirm.createReactionCollector({ filter, time: 30_000, max: 1 });
            let respondeu = false;

            collector.on('collect', async (reaction) => {
                respondeu = true;
                if (reaction.emoji.name === '❌') {
                    await msgConfirm.edit({ embeds: [new EmbedBuilder().setColor('#2c2c2c').setTitle('🚫 DESCASTIGO CANCELADO').setDescription(`A remoção de castigo de **${alvoTag}** foi abortada.`).setTimestamp()] });
                    await msgConfirm.reactions.removeAll().catch(() => {});
                    return;
                }
                await executarDescastigo();
            });

            collector.on('end', async () => {
                if (!respondeu) {
                    await msgConfirm.edit({ embeds: [new EmbedBuilder().setColor('#2c2c2c').setTitle('⏰ TEMPO ESGOTADO').setDescription('Operação de descastigo expirou por inatividade.').setTimestamp()] });
                    await msgConfirm.reactions.removeAll().catch(() => {});
                }
            });
        } else {
            await executarDescastigo();
        }

        async function executarDescastigo() {
            try {
                await alvo.timeout(null, `[${autorTag}] ${motivo}`);
            } catch (err) {
                await msgConfirm.edit({
                    embeds: [new EmbedBuilder().setColor('#8B0000').setTitle('❌ ERRO AO REMOVER CASTIGO')
                        .setDescription(`Não foi possível remover o timeout de **${alvoTag}**.\n\`\`\`${err.message}\`\`\``).setTimestamp()]
                });
                await msgConfirm.reactions.removeAll().catch(() => {});
                return;
            }

            // Remove do JSON marcando como remoção autorizada
            registrarRemocao(message.guild.id, alvo.id, motivo);

            try {
                await alvo.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#1a4a1a')
                        .setAuthor({ name: 'RETH MORGAN SHIELD SYSTEM', iconURL: client.user.displayAvatarURL() })
                        .setTitle(`🔓 SEU CASTIGO FOI REMOVIDO EM ${message.guild.name.toUpperCase()}`)
                        .addFields(
                            { name: '📋 MOTIVO',    value: motivo, inline: false },
                            { name: '🔫 MODERADOR', value: autorTag, inline: true }
                        )
                        .setFooter({ text: 'Lembre-se de respeitar as regras do servidor.' })
                        .setTimestamp()
                    ]
                });
            } catch {}

            const embedResult = new EmbedBuilder()
                .setColor('#1a4a1a')
                .setAuthor({ name: 'RETH MORGAN — CASTIGO REMOVIDO', iconURL: client.user.displayAvatarURL() })
                .setThumbnail(alvo.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setTitle('🔓 DESCASTIGO EXECUTADO COM SUCESSO')
                .setDescription('> *"A pena foi cumprida. A ordem foi restaurada."*\n> — Reth Morgan')
                .addFields(
                    { name: '👤 SOLTO',    value: `<@${alvo.id}>\n\`${alvoTag}\``, inline: true },
                    { name: '🔫 EXECUTOR', value: `<@${message.author.id}>\n\`${autorTag}\``, inline: true },
                    { name: '📋 MOTIVO',   value: `\`\`\`${motivo}\`\`\``, inline: false }
                )
                .setFooter({ text: `${message.guild.name} · Shield System V8`, iconURL: message.guild.iconURL() || undefined })
                .setTimestamp();

            await msgConfirm.reactions.removeAll().catch(() => {});
            await msgConfirm.edit({ embeds: [embedResult] });

            const logEmbed = new EmbedBuilder()
                .setColor('#1a4a1a')
                .setAuthor({ name: 'DESCASTIGO APLICADO', iconURL: message.author.displayAvatarURL() })
                .setThumbnail(alvo.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setTitle('🔓 LOG — DESCASTIGO')
                .addFields(
                    { name: '👤 SOLTO',    value: `<@${alvo.id}> · \`${alvoTag}\` · \`${alvo.id}\``, inline: false },
                    { name: '🔫 EXECUTOR', value: `<@${message.author.id}> · \`${autorTag}\``, inline: true },
                    { name: '📋 MOTIVO',   value: motivo, inline: true }
                )
                .setFooter({ text: `Guild ID: ${message.guild.id}` })
                .setTimestamp();

            await enviarLog(message.guild, 'logs_castigo', logEmbed);
        }
    }
};