'use strict';
// ============================================================
//  RETH MORGAN — UNBAN COMMAND
//  Desbanimento com embed rico, busca por ID ou tag, log completo.
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
    name: 'unban',
    aliases: ['desbanir', 'desbane'],

    execute: async (message, args, client, OWNER_ID) => {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('🔒 ACESSO NEGADO')
                    .setDescription('Você não possui permissão para desbanir membros.')
                    .setTimestamp()
                ]
            });
        }

        if (!args[0]) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#1a0000')
                    .setTitle('🩸 RETH MORGAN — UNBAN')
                    .setDescription('**Uso correto:** `r!unban <ID ou tag> [motivo]`\n**Exemplo:** `r!unban 123456789012345678 Erro de moderação`')
                    .addFields({ name: '💡 DICA', value: 'Use `r!bans` para ver a lista de banidos.', inline: false })
                    .setTimestamp()
                ]
            });
        }

        // ── Buscar usuário banido ────────────────────────────────
        const bans  = await message.guild.bans.fetch();
        const input = args[0].replace(/[<@!>]/g, '').trim();
        const entry = bans.get(input)
            || bans.find(b => b.user.tag.toLowerCase() === input.toLowerCase())
            || bans.find(b => b.user.username.toLowerCase().includes(input.toLowerCase()));

        if (!entry) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ USUÁRIO NÃO ENCONTRADO')
                    .setDescription(`Nenhum banimento encontrado para: \`${input}\`\n\nVerifique o ID ou tag do usuário.`)
                    .setTimestamp()
                ]
            });
        }

        const motivo = args.slice(1).join(' ') || 'Revisão de moderação.';

        // ── Embed de carregamento ────────────────────────────────
        const embedProcess = new EmbedBuilder()
            .setColor('#1a3a1a')
            .setAuthor({ name: 'RETH MORGAN — PROCESSANDO...', iconURL: client.user.displayAvatarURL() })
            .setThumbnail(entry.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTitle('⚙️ REMOVENDO BAN...')
            .setDescription('`Consultando registros de banimento...`\n`Verificando hierarquia...`\n`Executando remoção...`')
            .setTimestamp();

        const msgProcess = await message.channel.send({ embeds: [embedProcess] });

        // ── Executa unban ────────────────────────────────────────
        try {
            await message.guild.members.unban(entry.user.id, `[${message.author.tag}] ${motivo}`);
        } catch (e) {
            return msgProcess.edit({
                embeds: [new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ FALHA NA OPERAÇÃO')
                    .setDescription(`Não foi possível desbanir **${entry.user.tag}**.\n\nErro: \`${e.message}\``)
                    .setTimestamp()
                ]
            });
        }

        // ── Embed de resultado ───────────────────────────────────
        const embedResultado = new EmbedBuilder()
            .setColor('#1a4a1a')
            .setAuthor({
                name: 'RETH MORGAN — BAN REVOGADO',
                iconURL: client.user.displayAvatarURL()
            })
            .setThumbnail(entry.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTitle('✅ BANIMENTO REMOVIDO COM SUCESSO')
            .setDescription('> *"A absolvição foi concedida. Vigilância máxima mantida."*\n> — Reth Morgan')
            .addFields(
                { name: '👤 ABSOLVIDO', value: `\`${entry.user.tag}\`\nID: \`${entry.user.id}\``, inline: true },
                { name: '🔫 EXECUTOR',  value: `<@${message.author.id}>\n\`${message.author.tag}\``, inline: true },
                { name: '📋 MOTIVO',    value: `\`\`\`${motivo}\`\`\``, inline: false },
                { name: '📅 DATA & HORA', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setFooter({ text: `${message.guild.name} · Shield System V8`, iconURL: message.guild.iconURL() || undefined })
            .setTimestamp();

        await msgProcess.edit({ embeds: [embedResultado] });

        // ── Log ──────────────────────────────────────────────────
        const logEmbed = new EmbedBuilder()
            .setColor('#1a4a1a')
            .setAuthor({ name: 'UNBAN EXECUTADO', iconURL: message.author.displayAvatarURL() })
            .setThumbnail(entry.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTitle('✅ LOG — DESBANIMENTO')
            .addFields(
                { name: '👤 ABSOLVIDO',  value: `\`${entry.user.tag}\` · \`${entry.user.id}\``, inline: false },
                { name: '🔫 EXECUTOR',   value: `<@${message.author.id}> · \`${message.author.tag}\``, inline: true },
                { name: '📋 MOTIVO',     value: motivo, inline: true },
                { name: '📅 DATA',       value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setFooter({ text: `Guild ID: ${message.guild.id}` })
            .setTimestamp();

        await enviarLog(message.guild, 'logs_ban', logEmbed);
    }
};
