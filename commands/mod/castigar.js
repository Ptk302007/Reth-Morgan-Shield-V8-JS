'use strict';
// ============================================================
//  RETH MORGAN — CASTIGO COMMAND (CORRIGIDO V2)
//  ✅ Respeita castigo_confirmacao do painel
//  ✅ Não executa castigo antes da confirmação
//  ✅ DM ao punido
//  ✅ Log correto
// ============================================================
const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');

function getConfig(guildId) {
    try { return JSON.parse(fs.readFileSync('./database/config.json', 'utf-8'))[guildId] || {}; }
    catch { return {}; }
}

function registrarInfracao(guildId, userId, tipo, motivo, duracaoMs, executorId) {
    try {
        let dados = {};
        try { dados = JSON.parse(fs.readFileSync('./database/punicoes.json', 'utf-8')); } catch {}
        if (!dados[guildId]) dados[guildId] = {};
        if (!dados[guildId][userId]) dados[guildId][userId] = { warns: 0, mutes: 0, bans: 0, historico: [] };
        dados[guildId][userId][tipo]++;
        dados[guildId][userId].muteAtivo = {
            expiresAt: Date.now() + duracaoMs,
            duracaoMs,
            motivo,
            executorId
        };
        dados[guildId][userId].historico.push({
            tipo: 'CASTIGO', motivo, data: new Date().toLocaleDateString('pt-BR'),
            duracao: duracaoMs
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

function parseDuracao(str) {
    if (!str) return null;
    let ms = 0;
    const regex = /(\d+)(d|h|m|s)/gi;
    let match;
    while ((match = regex.exec(str)) !== null) {
        const val  = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        if (unit === 'd') ms += val * 86400000;
        else if (unit === 'h') ms += val * 3600000;
        else if (unit === 'm') ms += val * 60000;
        else if (unit === 's') ms += val * 1000;
    }
    return ms > 0 ? ms : null;
}

function formatDuracao(ms) {
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0) parts.push(`${s}s`);
    return parts.join(' ') || '0s';
}

function getUserTag(user) {
    if (!user) return 'Desconhecido';
    if (user.discriminator && user.discriminator !== '0') return `${user.username}#${user.discriminator}`;
    return user.username;
}

module.exports = {
    name: 'castigo',
    aliases: ['prender', 'timeout', 'silenciar'],

    execute: async (message, args, client, OWNER_ID) => {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply({ embeds: [new EmbedBuilder().setColor('#8B0000').setTitle('🔒 ACESSO NEGADO').setDescription('Você não possui permissão para aplicar castigos.').setTimestamp()] });
        }
        if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply({ embeds: [new EmbedBuilder().setColor('#8B0000').setTitle('⚠️ SEM PERMISSÃO').setDescription('Não possuo permissão para silenciar membros.').setTimestamp()] });
        }

        const alvo = message.mentions.members.first()
            || (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);

        if (!alvo) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#1a0000').setTitle('🩸 RETH MORGAN — CASTIGO')
                    .setDescription('**Uso:** `r!castigo @usuário <duração> [motivo]`\n**Exemplos:**\n`r!castigo @fulano 30m Spam`\n`r!castigo @fulano 2h Desrespeito`\n`r!castigo @fulano 1d Insultos`')
                    .addFields({ name: '⏱️ FORMATOS', value: '`s` = segundos | `m` = minutos | `h` = horas | `d` = dias\nMáximo: **28 dias**', inline: false })
                    .setTimestamp()
                ]
            });
        }

        const OWNER_IDS = [OWNER_ID, '1507543140800921610'];
        if (OWNER_IDS.includes(alvo.id) || alvo.id === message.guild.ownerId) {
            return message.reply({ embeds: [new EmbedBuilder().setColor('#8B0000').setTitle('🛡️ ALVO PROTEGIDO').setDescription('Este usuário não pode ser punido.').setTimestamp()] });
        }

        if (alvo.roles.highest.position >= message.member.roles.highest.position && message.author.id !== message.guild.ownerId) {
            return message.reply({ embeds: [new EmbedBuilder().setColor('#8B0000').setTitle('⛔ HIERARQUIA INSUFICIENTE').setDescription('Você não pode punir alguém com cargo igual ou superior ao seu.').setTimestamp()] });
        }

        const duracaoStr = args[1] || '10m';
        let duracaoMs    = parseDuracao(duracaoStr);
        let motivoStart  = 2;

        if (!duracaoMs) {
            duracaoMs   = 10 * 60 * 1000;
            motivoStart = 1;
        }

        const MAX_TIMEOUT = 28 * 24 * 60 * 60 * 1000;
        if (duracaoMs > MAX_TIMEOUT) duracaoMs = MAX_TIMEOUT;

        const motivo    = args.slice(motivoStart).join(' ') || 'Nenhum motivo informado.';
        const expiresAt = Math.floor((Date.now() + duracaoMs) / 1000);
        const sc        = getConfig(message.guild.id);
        const alvoTag   = getUserTag(alvo.user);
        const autorTag  = getUserTag(message.author);

        // ─────────────────────────────────────────────────────────
        // Função que executa o castigo de fato
        // ─────────────────────────────────────────────────────────
        async function executarCastigo(msgParaEditar) {
            // DM ao punido
            try {
                await alvo.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#b8860b')
                        .setAuthor({ name: 'RETH MORGAN SHIELD SYSTEM', iconURL: client.user.displayAvatarURL() })
                        .setTitle(`⏱️ VOCÊ RECEBEU UM CASTIGO EM ${message.guild.name.toUpperCase()}`)
                        .addFields(
                            { name: '⏱️ DURAÇÃO',  value: formatDuracao(duracaoMs), inline: true },
                            { name: '⏰ EXPIRA',    value: `<t:${expiresAt}:R>`, inline: true },
                            { name: '📋 MOTIVO',    value: motivo, inline: false },
                            { name: '🔫 MODERADOR', value: autorTag, inline: true }
                        )
                        .setFooter({ text: 'Respeite as regras do servidor.' })
                        .setTimestamp()
                    ]
                });
            } catch {}

            // Aplica o timeout
            try {
                await alvo.timeout(duracaoMs, `[${autorTag}] ${motivo}`);
            } catch (err) {
                const embedErro = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ ERRO AO APLICAR CASTIGO')
                    .setDescription(`Não foi possível aplicar o timeout em **${alvoTag}**.\n\`\`\`${err.message}\`\`\``)
                    .setTimestamp();
                if (msgParaEditar) {
                    await msgParaEditar.reactions.removeAll().catch(() => {});
                    await msgParaEditar.edit({ embeds: [embedErro] }).catch(() => {});
                } else {
                    await message.channel.send({ embeds: [embedErro] }).catch(() => {});
                }
                return;
            }

            registrarInfracao(message.guild.id, alvo.id, 'mutes', motivo, duracaoMs, message.author.id);

            const embedResult = new EmbedBuilder()
                .setColor('#b8860b')
                .setAuthor({ name: 'RETH MORGAN — CASTIGO APLICADO', iconURL: client.user.displayAvatarURL() })
                .setThumbnail(alvo.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setTitle('⏱️ CASTIGO EXECUTADO COM SUCESSO')
                .setDescription('> *"O silêncio é a pena mais eficaz para o indisciplinado."*\n> — Reth Morgan')
                .addFields(
                    { name: '👤 PUNIDO',   value: `<@${alvo.id}>\n\`${alvoTag}\``, inline: true },
                    { name: '🔫 EXECUTOR', value: `<@${message.author.id}>\n\`${autorTag}\``, inline: true },
                    { name: '⏱️ DURAÇÃO',  value: `**${formatDuracao(duracaoMs)}**\nExpira: <t:${expiresAt}:R>`, inline: true },
                    { name: '📋 MOTIVO',   value: `\`\`\`${motivo}\`\`\``, inline: false }
                )
                .setFooter({ text: `${message.guild.name} · Shield System V8`, iconURL: message.guild.iconURL() || undefined })
                .setTimestamp();

            if (msgParaEditar) {
                await msgParaEditar.reactions.removeAll().catch(() => {});
                await msgParaEditar.edit({ embeds: [embedResult] }).catch(() => {});
            } else {
                await message.channel.send({ embeds: [embedResult] }).catch(() => {});
            }

            const logEmbed = new EmbedBuilder()
                .setColor('#b8860b')
                .setAuthor({ name: 'CASTIGO APLICADO', iconURL: message.author.displayAvatarURL() })
                .setThumbnail(alvo.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setTitle('⏱️ LOG — CASTIGO')
                .addFields(
                    { name: '👤 PUNIDO',   value: `<@${alvo.id}> · \`${alvoTag}\` · \`${alvo.id}\``, inline: false },
                    { name: '🔫 EXECUTOR', value: `<@${message.author.id}> · \`${autorTag}\``, inline: true },
                    { name: '⏱️ DURAÇÃO',  value: formatDuracao(duracaoMs), inline: true },
                    { name: '⏰ EXPIRA',   value: `<t:${expiresAt}:F>`, inline: true },
                    { name: '📋 MOTIVO',   value: motivo, inline: false }
                )
                .setFooter({ text: `Guild ID: ${message.guild.id}` })
                .setTimestamp();

            await enviarLog(message.guild, 'logs_castigo', logEmbed);
        }

        // ─────────────────────────────────────────────────────────
        // Confirmação desativada → executa direto
        // ─────────────────────────────────────────────────────────
        if (sc.castigo_confirmacao === false) {
            await executarCastigo(null);
            return;
        }

        // ─────────────────────────────────────────────────────────
        // Confirmação ativada → embed + reactions
        // ─────────────────────────────────────────────────────────
        const embedConfirm = new EmbedBuilder()
            .setColor('#b8860b')
            .setAuthor({ name: 'RETH MORGAN — PROTOCOLO DE CASTIGO', iconURL: client.user.displayAvatarURL() })
            .setThumbnail(alvo.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTitle('⏱️ CONFIRMAÇÃO DE CASTIGO')
            .addFields(
                { name: '👤 ALVO',    value: `<@${alvo.id}>\n\`${alvoTag}\``, inline: true },
                { name: '⏱️ DURAÇÃO', value: `\`${formatDuracao(duracaoMs)}\`\nExpira: <t:${expiresAt}:R>`, inline: true },
                { name: '📋 MOTIVO',  value: `\`\`\`${motivo}\`\`\``, inline: false },
                { name: '⚠️ AÇÃO',    value: 'Reaja ✅ para **confirmar** · ❌ para **cancelar**\n*Aguardando 30 segundos...*', inline: false }
            )
            .setFooter({ text: `Servidor: ${message.guild.name}`, iconURL: message.guild.iconURL() || undefined })
            .setTimestamp();

        const msgConfirm = await message.channel.send({ embeds: [embedConfirm] });
        await msgConfirm.react('✅').catch(() => {});
        await msgConfirm.react('❌').catch(() => {});

        const filter = (r, u) => ['✅', '❌'].includes(r.emoji.name) && u.id === message.author.id;
        const collector = msgConfirm.createReactionCollector({ filter, time: 30_000, max: 1 });
        let respondeu = false;

        collector.on('collect', async (reaction) => {
            respondeu = true;
            await msgConfirm.reactions.removeAll().catch(() => {});

            if (reaction.emoji.name === '❌') {
                return msgConfirm.edit({
                    embeds: [new EmbedBuilder()
                        .setColor('#2c2c2c')
                        .setTitle('🚫 CASTIGO CANCELADO')
                        .setDescription(`O castigo de **${alvoTag}** foi abortado.`)
                        .setTimestamp()
                    ]
                });
            }

            await executarCastigo(msgConfirm);
        });

        collector.on('end', async () => {
            if (!respondeu) {
                await msgConfirm.reactions.removeAll().catch(() => {});
                await msgConfirm.edit({
                    embeds: [new EmbedBuilder()
                        .setColor('#2c2c2c')
                        .setTitle('⏰ TEMPO ESGOTADO')
                        .setDescription('Operação de castigo expirou por inatividade.')
                        .setTimestamp()
                    ]
                }).catch(() => {});
            }
        });
    }
};
