'use strict';
// ============================================================
//  RETH MORGAN — BAN COMMAND (CORRIGIDO)
//  ✅ Reaction collector funcionando
//  ✅ Log enviando corretamente
//  ✅ DM ao banido
//  ✅ GIF configurável
// ============================================================
const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs   = require('fs');

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
    } catch {}
}

async function enviarLog(guild, sc, embed, gifUrl) {
    try {
        // Tenta todos os canais de log em ordem de prioridade
        const canalId = sc.logs_ban || sc.logs_staff || sc.logs_seguranca;
        if (!canalId) return;
        const canal = guild.channels.cache.get(canalId);
        if (!canal) return;
        if (gifUrl) await canal.send({ content: gifUrl }).catch(() => {});
        await canal.send({ embeds: [embed] }).catch(() => {});
    } catch {}
}

module.exports = {
    name: 'ban',
    aliases: ['banir', 'bane'],

    execute: async (message, args, client, OWNER_ID) => {

        // ── Permissão do autor ────────────────────────────────────
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

        // ── Permissão do bot ──────────────────────────────────────
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

        // ── Busca o alvo ──────────────────────────────────────────
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

        // ── Proteções ─────────────────────────────────────────────
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

        if (
            alvo.roles.highest.position >= message.member.roles.highest.position &&
            message.author.id !== message.guild.ownerId
        ) {
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

        // ── Embed de confirmação ──────────────────────────────────
        const embedConfirm = new EmbedBuilder()
            .setColor('#8B0000')
            .setAuthor({
                name: `RETH MORGAN — PROTOCOLO DE BAN`,
                iconURL: client.user.displayAvatarURL()
            })
            .setThumbnail(alvo.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTitle('🔨 CONFIRMAÇÃO DE BANIMENTO')
            .addFields(
                { name: '👤 ALVO',    value: `<@${alvo.id}>\n\`${alvo.user.tag}\`\nID: \`${alvo.id}\``, inline: true },
                { name: '🔫 EXECUTOR', value: `<@${message.author.id}>\n\`${message.author.tag}\``, inline: true },
                { name: '📋 MOTIVO',  value: `\`\`\`${motivo}\`\`\``, inline: false },
                { name: '⚠️ INSTRUÇÕES', value: 'Reaja com ✅ para **confirmar**\nReaja com ❌ para **cancelar**\n\n*Aguardando por 30 segundos...*', inline: false }
            )
            .setFooter({ text: `Servidor: ${message.guild.name}`, iconURL: message.guild.iconURL() || undefined })
            .setTimestamp();

        const msgConfirm = await message.channel.send({ embeds: [embedConfirm] });

        // ── Adiciona reações ──────────────────────────────────────
        await msgConfirm.react('✅').catch(() => {});
        await msgConfirm.react('❌').catch(() => {});

        // ── Collector de reações ──────────────────────────────────
        const filter = (reaction, user) =>
            ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id;

        const collector = msgConfirm.createReactionCollector({ filter, time: 30_000, max: 1 });

        // ── Confirmado ────────────────────────────────────────────
        collector.on('collect', async (reaction) => {
            await msgConfirm.reactions.removeAll().catch(() => {});

            if (reaction.emoji.name === '❌') {
                return msgConfirm.edit({
                    embeds: [new EmbedBuilder()
                        .setColor('#2c2c2c')
                        .setTitle('🚫 BANIMENTO CANCELADO')
                        .setDescription(`O banimento de **${alvo.user.tag}** foi abortado.`)
                        .setTimestamp()
                    ]
                });
            }

            // ── DM ao banido ──────────────────────────────────────
            try {
                await alvo.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#8B0000')
                        .setAuthor({ name: 'RETH MORGAN SHIELD SYSTEM', iconURL: client.user.displayAvatarURL() })
                        .setTitle(`🔨 VOCÊ FOI BANIDO DE ${message.guild.name.toUpperCase()}`)
                        .addFields(
                            { name: '📋 MOTIVO',   value: motivo, inline: false },
                            { name: '🔫 EXECUTOR', value: message.author.tag, inline: true },
                            { name: '📅 DATA',     value: new Date().toLocaleDateString('pt-BR'), inline: true }
                        )
                        .setThumbnail(message.guild.iconURL() || null)
                        .setFooter({ text: 'Sistema de moderação automático' })
                        .setTimestamp()
                    ]
                });
            } catch {}

            // ── Executa o ban ─────────────────────────────────────
            try {
                await alvo.ban({ reason: `[${message.author.tag}] ${motivo}`, deleteMessageDays: 1 });
                registrarInfracao(message.guild.id, alvo.id, 'bans', motivo);
            } catch (err) {
                return msgConfirm.edit({
                    embeds: [new EmbedBuilder()
                        .setColor('#e74c3c')
                        .setTitle('❌ ERRO AO BANIR')
                        .setDescription(`Não foi possível banir ${alvo.user.tag}.\n\`\`\`${err.message}\`\`\``)
                        .setTimestamp()
                    ]
                });
            }

            // ── Embed de resultado ────────────────────────────────
            const gifUrl = sc.gif_ban || null;
            const embedResultado = new EmbedBuilder()
                .setColor('#8B0000')
                .setAuthor({
                    name: 'RETH MORGAN — EXECUÇÃO CONFIRMADA',
                    iconURL: client.user.displayAvatarURL()
                })
                .setThumbnail(alvo.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setTitle('🔨 BANIMENTO EXECUTADO COM SUCESSO')
                .setDescription('> *"A ordem foi restaurada. O caos, eliminado."*\n> — Reth Morgan')
                .addFields(
                    { name: '👤 BANIDO',   value: `<@${alvo.id}>\n\`${alvo.user.tag}\`\nID: \`${alvo.id}\``, inline: true },
                    { name: '🔫 EXECUTOR', value: `<@${message.author.id}>\n\`${message.author.tag}\``, inline: true },
                    { name: '📋 MOTIVO',   value: `\`\`\`${motivo}\`\`\``, inline: false },
                    { name: '📅 DATA & HORA', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                )
                .setFooter({ text: `${message.guild.name} · Shield System V8`, iconURL: message.guild.iconURL() || undefined })
                .setTimestamp();

            await msgConfirm.edit({ embeds: [embedResultado] });
            if (gifUrl) await message.channel.send({ content: gifUrl }).catch(() => {});

            // ── Log ───────────────────────────────────────────────
            const logEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setAuthor({ name: `BAN EXECUTADO`, iconURL: message.author.displayAvatarURL() })
                .setThumbnail(alvo.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setTitle('🔨 LOG — BANIMENTO')
                .addFields(
                    { name: '👤 BANIDO',   value: `<@${alvo.id}> · \`${alvo.user.tag}\` · \`${alvo.id}\``, inline: false },
                    { name: '🔫 EXECUTOR', value: `<@${message.author.id}> · \`${message.author.tag}\``, inline: true },
                    { name: '📋 MOTIVO',   value: motivo, inline: true },
                    { name: '📅 DATA',     value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                )
                .setFooter({ text: `Guild ID: ${message.guild.id}` })
                .setTimestamp();

            await enviarLog(message.guild, sc, logEmbed, gifUrl);
        });

        // ── Timeout ───────────────────────────────────────────────
        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                await msgConfirm.reactions.removeAll().catch(() => {});
                await msgConfirm.edit({
                    embeds: [new EmbedBuilder()
                        .setColor('#2c2c2c')
                        .setTitle('⏰ TEMPO ESGOTADO')
                        .setDescription('Operação de banimento expirou por inatividade.')
                        .setTimestamp()
                    ]
                }).catch(() => {});
            }
        });
    }
};
