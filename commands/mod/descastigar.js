'use strict';
// ============================================================
//  RETH MORGAN — DESCASTIGO COMMAND
//  Quem pode remover um castigo:
//    1. O próprio executor que aplicou
//    2. Dono do bot (OWNER_IDS)
//    3. Dono do servidor (guild.ownerId)
//    4. bypass_roles configurados no painel (Imunes)
//    5. Membros com ManageGuild ou Administrator
// ============================================================
const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');

function getConfig(guildId) {
    try { return JSON.parse(fs.readFileSync('./database/config.json', 'utf-8'))[guildId] || {}; }
    catch { return {}; }
}

function getPunicoes(guildId, userId) {
    try {
        const dados = JSON.parse(fs.readFileSync('./database/punicoes.json', 'utf-8'));
        return dados?.[guildId]?.[userId] || null;
    } catch { return null; }
}

function limparMuteAtivo(guildId, userId) {
    try {
        let dados = JSON.parse(fs.readFileSync('./database/punicoes.json', 'utf-8'));
        if (dados?.[guildId]?.[userId]) {
            delete dados[guildId][userId].muteAtivo;
            fs.writeFileSync('./database/punicoes.json', JSON.stringify(dados, null, 2));
        }
    } catch {}
}

function getUserTag(user) {
    if (!user) return 'Desconhecido';
    if (user.discriminator && user.discriminator !== '0') return `${user.username}#${user.discriminator}`;
    return user.username;
}

function formatDuracao(ms) {
    if (!ms || ms <= 0) return '0s';
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return [d && `${d}d`, h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(' ') || '0s';
}

async function enviarLog(guild, embed) {
    try {
        const sc = getConfig(guild.id);
        const canalId = sc.logs_castigo || sc.logs_staff || sc.logs_seguranca;
        if (!canalId) return;
        const canal = guild.channels.cache.get(canalId);
        if (canal) canal.send({ embeds: [embed] }).catch(() => {});
    } catch {}
}

module.exports = {
    name: 'descastigo',
    aliases: ['untimeout', 'desprende', 'dessilenciar', 'uncastigo'],

    execute: async (message, args, client, OWNER_ID) => {
        const OWNER_IDS = [OWNER_ID, '1507543140800921610'];
        const sc = getConfig(message.guild.id);

        // ── Busca o alvo ──────────────────────────────────────────
        const alvo = message.mentions.members.first()
            || (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : null);

        if (!alvo) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#1a0000')
                    .setTitle('🩸 RETH MORGAN — DESCASTIGO')
                    .setDescription('**Uso:** `r!descastigo @usuário [motivo]`\n**Exemplo:** `r!descastigo @fulano Apelou a decisão`')
                    .setTimestamp()
                ]
            });
        }

        // ── Verifica se o alvo tem castigo ativo ──────────────────
        const temTimeoutAtivo = alvo.communicationDisabledUntil && alvo.communicationDisabledUntil > new Date();
        const dadosPunicao = getPunicoes(message.guild.id, alvo.id);
        const muteAtivo = dadosPunicao?.muteAtivo;

        if (!temTimeoutAtivo && !muteAtivo) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#2c2c2c')
                    .setTitle('⚠️ SEM CASTIGO ATIVO')
                    .setDescription(`<@${alvo.id}> não possui nenhum castigo ativo no momento.`)
                    .setTimestamp()
                ]
            });
        }

        // ── Verificação de autorização ────────────────────────────
        const autorId      = message.author.id;
        const ehDono       = OWNER_IDS.includes(autorId);
        const ehDonoServer = autorId === message.guild.ownerId;
        const ehExecutor   = muteAtivo?.executorId === autorId;

        const temCargoImune = sc.bypass_roles?.length > 0
            && message.member.roles.cache.some(r => sc.bypass_roles.includes(r.id));

        const temPermAdmin = message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)
            || message.member.permissions.has(PermissionsBitField.Flags.Administrator);

        const autorizado = ehDono || ehDonoServer || ehExecutor || temCargoImune || temPermAdmin;

        if (!autorizado) {
            const executorMencao = muteAtivo?.executorId
                ? `<@${muteAtivo.executorId}>`
                : '`Não identificado`';

            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('🔒 SEM AUTORIZAÇÃO')
                    .setDescription('Você **não tem permissão** para remover este castigo.')
                    .addFields(
                        { name: '🔫 Aplicado por', value: executorMencao, inline: true },
                        { name: '✅ Quem pode remover', value:
                            `${executorMencao} *(executor)*\n` +
                            `<@${message.guild.ownerId}> *(dono do servidor)*\n` +
                            `Cargos imunes configurados no painel\n` +
                            `Membros com **Gerenciar Servidor** ou **Administrador**`,
                            inline: false
                        }
                    )
                    .setFooter({ text: 'Use r!painel → Automação → Imunes para configurar cargos autorizados.' })
                    .setTimestamp()
                ]
            });
        }

        const motivo  = args.slice(1).join(' ') || 'Nenhum motivo informado.';
        const alvoTag = getUserTag(alvo.user);
        const autorTag = getUserTag(message.author);

        // ── Sinaliza para o evento guildMemberUpdate que esta
        //    remoção é autorizada — evita o castigo ser reaplicado
        const flagKey = `${message.guild.id}:${alvo.id}`;
        if (global._remocaoAutorizadaSet) {
            global._remocaoAutorizadaSet.add(flagKey);
            // Remove a flag após 5s como segurança
            setTimeout(() => global._remocaoAutorizadaSet?.delete(flagKey), 5000);
        }

        // ── Limpa o registro ANTES de remover o timeout
        //    (garante que o evento não encontre muteAtivo)
        limparMuteAtivo(message.guild.id, alvo.id);

        // ── Executa a remoção ─────────────────────────────────────
        try {
            await alvo.timeout(null, `[${autorTag}] ${motivo}`);
        } catch (err) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#e74c3c')
                    .setTitle('❌ ERRO AO REMOVER CASTIGO')
                    .setDescription(`Não foi possível remover o timeout de **${alvoTag}**.\n\`\`\`${err.message}\`\`\``)
                    .setTimestamp()
                ]
            });
        }

        // ── Embed de resultado ────────────────────────────────────
        const embedResult = new EmbedBuilder()
            .setColor('#2ecc71')
            .setAuthor({ name: 'RETH MORGAN — CASTIGO REMOVIDO', iconURL: client.user.displayAvatarURL() })
            .setThumbnail(alvo.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTitle('✅ CASTIGO ENCERRADO COM SUCESSO')
            .setDescription('> *"A ordem foi restabelecida. O protocolo encerrado."*\n> — Reth Morgan')
            .addFields(
                { name: '👤 LIBERADO',     value: `<@${alvo.id}>\n\`${alvoTag}\``, inline: true },
                { name: '🔓 REMOVIDO POR', value: `<@${autorId}>\n\`${autorTag}\``, inline: true },
                { name: '📋 MOTIVO',       value: `\`\`\`${motivo}\`\`\``, inline: false },
                ...(muteAtivo ? [
                    { name: '🔫 APLICADO POR',    value: `<@${muteAtivo.executorId}>`, inline: true },
                    { name: '📝 MOTIVO ORIGINAL', value: muteAtivo.motivo || 'Não informado.', inline: true },
                ] : [])
            )
            .setFooter({ text: `${message.guild.name} · Shield System V8`, iconURL: message.guild.iconURL() || undefined })
            .setTimestamp();

        await message.reply({ embeds: [embedResult] });

        // ── Log ───────────────────────────────────────────────────
        const logEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setAuthor({ name: 'CASTIGO REMOVIDO', iconURL: message.author.displayAvatarURL() })
            .setThumbnail(alvo.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTitle('✅ LOG — DESCASTIGO')
            .addFields(
                { name: '👤 LIBERADO',     value: `<@${alvo.id}> · \`${alvoTag}\` · \`${alvo.id}\``, inline: false },
                { name: '🔓 REMOVIDO POR', value: `<@${autorId}> · \`${autorTag}\``, inline: true },
                { name: '📋 MOTIVO',       value: motivo, inline: true },
                ...(muteAtivo ? [
                    { name: '🔫 APLICADO POR',    value: `<@${muteAtivo.executorId}>`, inline: true },
                    { name: '📝 MOTIVO ORIGINAL', value: muteAtivo.motivo || 'Não informado.', inline: false },
                ] : [])
            )
            .setFooter({ text: `Guild ID: ${message.guild.id}` })
            .setTimestamp();

        await enviarLog(message.guild, logEmbed);
    }
};
