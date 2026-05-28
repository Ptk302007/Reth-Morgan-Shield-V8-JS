'use strict';
// ============================================================
//  RETH MORGAN — BAN COMMAND
//  Banimento com confirmação por reação, GIF configurável,
//  embed rico, log completo e DM ao banido.
// ============================================================
const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs   = require('fs');
const path = require('path');

function getConfig(guildId) {
    try {
        const data = JSON.parse(fs.readFileSync('./database/config.json', 'utf-8'));
        return data[guildId] || {};
    } catch { return {}; }
}

function registrarInfracao(guildId, userId, tipo, motivo) {
    try {
        let dados = {};
        try { dados = JSON.parse(fs.readFileSync('./database/punicoes.json', 'utf-8')); } catch {}
        if (!dados[guildId]) dados[guildId] = {};
        if (!dados[guildId][userId]) dados[guildId][userId] = { warns: 0, mutes: 0, bans: 0, historico: [] };
        dados[guildId][userId][tipo]++;
        dados[guildId][userId].historico.push({
            tipo: tipo.toUpperCase(), motivo, data: new Date().toLocaleDateString('pt-BR')
        });
        fs.writeFileSync('./database/punicoes.json', JSON.stringify(dados, null, 2));
    } catch (e) {}
}

async function enviarLog(guild, tipoLog, embed, gifUrl = null) {
    try {
        const sc = getConfig(guild.id);
        const canalId = sc[tipoLog] || sc['logs_staff'] || sc['logs_seguranca'];
        if (!canalId) return;
        const canal = guild.channels.cache.get(canalId);
        if (!canal) return;
        const payload = { embeds: [embed] };
        if (gifUrl) payload.content = gifUrl;
        canal.send(payload).catch(() => {});
    } catch {}
}

module.exports = {
    name: 'ban',
    aliases: ['banir', 'bane'],

    execute: async (message, args, client, OWNER_ID) => {
        // ── Permissões ───────────────────────────────────────────
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('🔒 ACESSO NEGADO')
                    .setDescription('Você não possui permissão para banir membros.')
                    .setTimestamp()
                ]
            });
        }
        if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('⚠️ SEM PERMISSÃO')
                    .setDescription('Não possuo permissão de banir neste servidor.')
                    .setTimestamp()
                ]
            });
        }

        // ── Args ─────────────────────────────────────────────────
        const alvo = message.mentions.members.first()
            || (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);

        if (!alvo) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#1a0000')
                    .setTitle('🩸 RETH MORGAN — BAN')
                    .setDescription('**Uso correto:** `r!ban @usuário [motivo]`\n**Exemplo:** `r!ban @fulano Comportamento tóxico`')
                    .setTimestamp()
                ]
            });
        }

        const OWNER_IDS = [OWNER_ID, '1272650221402194095'];
        if (OWNER_IDS.includes(alvo.id) || alvo.id === message.guild.ownerId) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('🛡️ ALVO PROTEGIDO')
                    .setDescription('Este usuário não pode ser banido.')
                    .setTimestamp()
                ]
            });
        }

        if (alvo.roles.highest.position >= message.member.roles.highest.position && message.author.id !== message.guild.ownerId) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('⛔ HIERARQUIA INSUFICIENTE')
                    .setDescription('Você não pode banir alguém com cargo igual ou superior ao seu.')
                    .setTimestamp()
                ]
            });
        }

        const motivo = args.slice(1).join(' ') || 'Nenhum motivo fornecido.';
        const sc     = getConfig(message.guild.id);

        // ── Embed de confirmação ─────────────────────────────────
        const embedConfirm = new EmbedBuilder()
            .setColor('#8B0000')
            .setAuthor({
                name: `RETH MORGAN — PROTOCOLO DE BAN`,
                iconURL: client.user.displayAvatarURL()
            })
            .setThumbnail(alvo.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTitle('🔨 CONFIRMAÇÃO DE BANIMENTO')
            .addFields(
                { name: '👤 ALVO', value: `<@${alvo.id}>\n\`${alvo.user.tag}\`\nID: \`${alvo.id}\``, inline: true },
                { name: '🔫 EXECUTOR', value: `<@${message.author.id}>\n\`${message.author.tag}\``, inline: true },
                { name: '📋 MOTIVO', value: `\`\`\`${motivo}\`\`\``, inline: false },
                { name: '⚠️ INSTRUÇÕES', value: `Reaja com ✅ para **confirmar** o banimento\nReaja com ❌ para **cancelar** a operação\n\n*Aguardando resposta por 30 segundos...*`, inline: false }
            )
            .setImage(alvo.user.bannerURL?.({ dynamic: true, size: 1024 }) || null)
            .setFooter({ text: `Servidor: ${message.guild.name}`, iconURL: message.guild.iconURL() || undefined })
            .setTimestamp();

        // ── Usa confirmação por emoji se configurado (padrão: ativo) ──
        const usarConfirmacao = sc.ban_confirmacao !== false;

        const msgConfirm = await message.channel.send({ embeds: [embedConfirm] });

        if (usarConfirmacao) {
            await msgConfirm.react('✅').catch(() => {});
            await msgConfirm.react('❌').catch(() => {});

            const filter = (reaction, user) => ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id;
            const collector = msgConfirm.createReactionCollector({ filter, time: 30_000, max: 1 });

            collector.on('collect', async (reaction) => {
                if (reaction.emoji.name === '❌') {
                    await msgConfirm.edit({
                        embeds: [new EmbedBuilder()
                            .setColor('#2c2c2c')
                            .setTitle('🚫 BANIMENTO CANCELADO')
                            .setDescription(`O banimento de **${alvo.user.tag}** foi abortado.`)
                            .setTimestamp()
                        ]
                    });
                    await msgConfirm.reactions.removeAll().catch(() => {});
                    return;
                }
                await executarBan(message, alvo, motivo, sc, msgConfirm, client, guild => guild);
            });

            collector.on('end', async (collected) => {
                if (collected.size === 0) {
                    await msgConfirm.edit({
                        embeds: [new EmbedBuilder()
                            .setColor('#2c2c2c')
                            .setTitle('⏰ TEMPO ESGOTADO')
                            .setDescription('Operação de banimento expirou por inatividade.')
                            .setTimestamp()
                        ]
                    });
                    await msgConfirm.reactions.removeAll().catch(() => {});
                }
            });
        } else {
            await executarBan(message, alvo, motivo, sc, msgConfirm, client, g => g);
        }

        // ── Função principal de ban ──────────────────────────────
        async function executarBan(msg, membro, mot, config, msgRef, bot, _) {
            // DM ao banido
            try {
                await membro.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#8B0000')
                        .setAuthor({ name: 'RETH MORGAN SHIELD SYSTEM', iconURL: bot.user.displayAvatarURL() })
                        .setTitle(`🔨 VOCÊ FOI BANIDO DE ${msg.guild.name.toUpperCase()}`)
                        .addFields(
                            { name: '📋 MOTIVO', value: mot, inline: false },
                            { name: '🔫 EXECUTOR', value: msg.author.tag, inline: true },
                            { name: '📅 DATA', value: new Date().toLocaleDateString('pt-BR'), inline: true }
                        )
                        .setThumbnail(msg.guild.iconURL() || null)
                        .setFooter({ text: 'Sistema de moderação automático' })
                        .setTimestamp()
                    ]
                });
            } catch {}

            // Executa o ban
            await membro.ban({ reason: `[${msg.author.tag}] ${mot}`, deleteMessageDays: 1 });
            registrarInfracao(msg.guild.id, membro.id, 'bans', mot);

            // Embed de resultado
            const gifUrl = config.gif_ban || null;
            const embedResultado = new EmbedBuilder()
                .setColor('#8B0000')
                .setAuthor({
                    name: 'RETH MORGAN — EXECUÇÃO CONFIRMADA',
                    iconURL: bot.user.displayAvatarURL()
                })
                .setThumbnail(membro.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setTitle('🔨 BANIMENTO EXECUTADO COM SUCESSO')
                .setDescription(gifUrl ? '' : '> *"A ordem foi restaurada. O caos, eliminado."*\n> — Reth Morgan')
                .addFields(
                    { name: '👤 BANIDO', value: `<@${membro.id}>\n\`${membro.user.tag}\`\nID: \`${membro.id}\``, inline: true },
                    { name: '🔫 EXECUTOR', value: `<@${msg.author.id}>\n\`${msg.author.tag}\``, inline: true },
                    { name: '📋 MOTIVO', value: `\`\`\`${mot}\`\`\``, inline: false },
                    { name: '📅 DATA & HORA', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                )
                .setFooter({ text: `${msg.guild.name} · Shield System V8`, iconURL: msg.guild.iconURL() || undefined })
                .setTimestamp();

            await msgRef.reactions.removeAll().catch(() => {});
            await msgRef.edit({ embeds: [embedResultado] });
            if (gifUrl) await msg.channel.send(gifUrl).catch(() => {});

            // Log
            const logEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setAuthor({ name: `BAN EXECUTADO`, iconURL: msg.author.displayAvatarURL() })
                .setThumbnail(membro.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setTitle('🔨 LOG — BANIMENTO')
                .addFields(
                    { name: '👤 BANIDO',   value: `<@${membro.id}> · \`${membro.user.tag}\` · \`${membro.id}\``, inline: false },
                    { name: '🔫 EXECUTOR', value: `<@${msg.author.id}> · \`${msg.author.tag}\``, inline: true },
                    { name: '📋 MOTIVO',   value: mot, inline: true },
                    { name: '📅 DATA',     value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                )
                .setFooter({ text: `Guild ID: ${msg.guild.id}` })
                .setTimestamp();

            await enviarLog(msg.guild, 'logs_ban', logEmbed, gifUrl);
        }
    }
};
