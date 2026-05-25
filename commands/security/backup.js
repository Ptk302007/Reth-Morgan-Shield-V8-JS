// commands/security/backup.js
// Requer: discord.js v14+, Node 18+
'use strict';

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const fs   = require('fs/promises');
const path = require('path');

// ─── Configuração ────────────────────────────────────────────────────────────

const DB_PATH       = path.resolve('./database/backups.json');
const CFG_PATH      = path.resolve('./database/backup_config.json');
const COLLECTOR_TTL = 120_000;
const DELAY_ROLE    = 350;
const DELAY_CHANNEL = 400;

// Estado dos timers em memória: guildId → { timer, intervalMs, proxima: Date }
const autoTimers = new Map();

// ─── Parse de duração ────────────────────────────────────────────────────────

function parseDuration(str) {
    if (!str || typeof str !== 'string') return null;
    const regex = /(\d+)\s*(d|h|m)/gi;
    const units = { d: 86_400_000, h: 3_600_000, m: 60_000 };
    let total = 0, match;
    while ((match = regex.exec(str)) !== null)
        total += parseInt(match[1], 10) * units[match[2].toLowerCase()];
    return total > 0 ? total : null;
}

function formatDuration(ms) {
    const d = Math.floor(ms / 86_400_000);
    const h = Math.floor((ms % 86_400_000) / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || '< 1m';
}

function formatDate(date) {
    return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// ─── I/O de config ───────────────────────────────────────────────────────────

async function readCfg() {
    try { return JSON.parse(await fs.readFile(CFG_PATH, 'utf-8')); }
    catch { return {}; }
}

async function writeCfg(data) {
    const tmp = CFG_PATH + '.tmp';
    await fs.mkdir(path.dirname(CFG_PATH), { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tmp, CFG_PATH);
}

// ─── I/O de backups ──────────────────────────────────────────────────────────

async function readDB() {
    try { return JSON.parse(await fs.readFile(DB_PATH, 'utf-8')); }
    catch (e) { if (e.code !== 'ENOENT') console.warn('[backup] readDB:', e.message); return {}; }
}

async function writeDB(data) {
    const tmp = DB_PATH + '.tmp';
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tmp, DB_PATH);
}

// ─── Timer automático ────────────────────────────────────────────────────────

async function armarTimer(guild, intervalMs) {
    if (autoTimers.has(guild.id)) clearInterval(autoTimers.get(guild.id).timer);

    const proxima = new Date(Date.now() + intervalMs);

    const timer = setInterval(async () => {
        try {
            const db = await readDB();
            db[guild.id] = snapshotGuild(guild);
            await writeDB(db);

            const cfg = await readCfg();
            if (cfg[guild.id]) {
                cfg[guild.id].proxima = new Date(Date.now() + intervalMs).toISOString();
                await writeCfg(cfg);
                if (autoTimers.has(guild.id))
                    autoTimers.get(guild.id).proxima = new Date(Date.now() + intervalMs);
            }
            console.log(`[auto-backup] ${guild.name} salvo em ${new Date().toISOString()}`);
        } catch (e) {
            console.error('[auto-backup] Falha:', e.message);
        }
    }, intervalMs);

    autoTimers.set(guild.id, { timer, intervalMs, proxima });

    const cfg = await readCfg();
    cfg[guild.id] = { intervalMs, proxima: proxima.toISOString() };
    await writeCfg(cfg);
}

async function cancelarTimer(guildId) {
    if (autoTimers.has(guildId)) {
        clearInterval(autoTimers.get(guildId).timer);
        autoTimers.delete(guildId);
    }
    const cfg = await readCfg();
    delete cfg[guildId];
    await writeCfg(cfg);
}

/**
 * Recarrega timers persistidos ao iniciar o bot.
 * Chame no evento 'ready': recarregarTimers(client)
 */
async function recarregarTimers(client) {
    const cfg = await readCfg();
    for (const [guildId, { intervalMs }] of Object.entries(cfg)) {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue;
        await armarTimer(guild, intervalMs);
        console.log(`[auto-backup] Timer rearmado: ${guild.name} — ${formatDuration(intervalMs)}`);
    }
}

// ─── Snapshot ────────────────────────────────────────────────────────────────

function snapshotGuild(guild) {
    const cargos = guild.roles.cache
        .filter(r => r.id !== guild.id && !r.managed)
        .sort((a, b) => a.position - b.position)
        .map(r => ({
            id: r.id, name: r.name, color: r.color, hoist: r.hoist,
            mentionable: r.mentionable, permissions: r.permissions.bitfield.toString(), position: r.position,
        }));

    const canais = guild.channels.cache
        .sort((a, b) => a.position - b.position)
        .map(c => ({
            id: c.id, name: c.name, type: c.type, parentId: c.parentId ?? null,
            position: c.position, topic: c.topic ?? null, nsfw: c.nsfw ?? false,
            overwrites: c.permissionOverwrites.cache.map(o => ({
                id: o.id, type: o.type,
                allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString(),
            })),
        }));

    return { nome: guild.name, data: new Date().toISOString(), cargos, canais };
}

// ─── Restore ─────────────────────────────────────────────────────────────────

async function restoreGuild(guild, snapshot, statusMsg) {
    const upd = (txt) => statusMsg.edit({ content: txt, embeds: [], components: [] }).catch(() => {});

    await upd('🔴 **[1/5]** Removendo canais...');
    for (const c of [...guild.channels.cache.values()]) await c.delete().catch(() => {});

    await upd('🔴 **[2/5]** Removendo cargos...');
    const posBot = guild.members.me.roles.highest.position;
    for (const r of [...guild.roles.cache.values()])
        if (r.id !== guild.id && !r.managed && r.position < posBot) await r.delete().catch(() => {});

    const mapaCargos = {}, mapaCanais = {};

    await upd('🟡 **[3/5]** Recriando cargos...');
    for (const cOld of snapshot.cargos) {
        try {
            const novo = await guild.roles.create({
                name: cOld.name, color: cOld.color, hoist: cOld.hoist,
                mentionable: cOld.mentionable, permissions: BigInt(cOld.permissions),
                position: cOld.position, reason: 'Restore de backup',
            });
            mapaCargos[cOld.id] = novo.id;
        } catch (e) { console.error(`[restore] Cargo "${cOld.name}":`, e.message); }
        await delay(DELAY_ROLE);
    }

    const convOws = (ows) => (ows ?? []).map(ov => ({
        id: mapaCargos[ov.id] ?? ov.id, type: ov.type,
        allow: BigInt(ov.allow), deny: BigInt(ov.deny),
    }));

    await upd('🟡 **[4/5]** Recriando categorias...');
    for (const cat of snapshot.canais.filter(c => c.type === 4).sort((a, b) => a.position - b.position)) {
        try {
            const nova = await guild.channels.create({
                name: cat.name, type: 4, position: cat.position,
                permissionOverwrites: convOws(cat.overwrites), reason: 'Restore de backup',
            });
            mapaCanais[cat.id] = nova.id;
        } catch (e) { console.error(`[restore] Categoria "${cat.name}":`, e.message); }
        await delay(DELAY_CHANNEL);
    }

    await upd('🟡 **[5/5]** Recriando canais...');
    for (const ch of snapshot.canais.filter(c => c.type !== 4).sort((a, b) => a.position - b.position)) {
        try {
            await guild.channels.create({
                name: ch.name, type: ch.type,
                parent: ch.parentId ? (mapaCanais[ch.parentId] ?? null) : null,
                position: ch.position, topic: ch.topic, nsfw: ch.nsfw,
                permissionOverwrites: convOws(ch.overwrites), reason: 'Restore de backup',
            });
        } catch (e) { console.error(`[restore] Canal "${ch.name}":`, e.message); }
        await delay(DELAY_CHANNEL);
    }

    await upd('🟩 **SISTEMA:** Servidor restaurado com sucesso.');
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function tempMsg(channel, content, ms = 5000) {
    const m = await channel.send({ content }).catch(() => null);
    if (m) setTimeout(() => m.delete().catch(() => {}), ms);
}

// ─── Embeds & Componentes ────────────────────────────────────────────────────

function painelPrincipal(guildId) {
    const timerInfo = autoTimers.get(guildId);
    const autoAtivo = !!timerInfo;

    const linhaAuto = autoAtivo
        ? `⏱️ **Auto Backup** — 🟩 Ativo · Intervalo: \`${formatDuration(timerInfo.intervalMs)}\` · Próximo: \`${formatDate(timerInfo.proxima)}\``
        : '⏱️ **Auto Backup** — 🟥 Inativo · Clique para configurar o intervalo.';

    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('🗄️ COFRE DE BACKUPS')
        .setDescription(
            '💾 **Salvar Backup** — Snapshot completo de cargos, canais e permissões.\n' +
            '🔄 **Restaurar Backup** — Reconstrói o servidor a partir do último snapshot.\n' +
            linhaAuto
        );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bkp_salvar').setLabel('Salvar').setEmoji('💾').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('bkp_restaurar').setLabel('Restaurar').setEmoji('🔄').setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('bkp_auto')
            .setLabel(autoAtivo ? 'Auto: ON' : 'Auto: OFF')
            .setEmoji('⏱️')
            .setStyle(autoAtivo ? ButtonStyle.Primary : ButtonStyle.Secondary),
    );

    return { embed, row };
}

function embedConfirmacaoRestore(snapshot) {
    if (!snapshot) {
        return {
            embed: new EmbedBuilder()
                .setColor('#f53b57')
                .setTitle('❌ Nenhum Backup Encontrado')
                .setDescription('Salve um backup antes de tentar restaurar.'),
            components: [],
        };
    }
    return {
        embed: new EmbedBuilder()
            .setColor('#f53b57')
            .setTitle('⚠️ PROTOCOLO DE RESTAURAÇÃO')
            .setDescription(
                `**Backup:** \`${snapshot.nome}\` — salvo em \`${formatDate(new Date(snapshot.data))}\`\n` +
                `**Cargos:** ${snapshot.cargos.length} · **Canais:** ${snapshot.canais.length}\n\n` +
                '**ATENÇÃO:** Todos os canais e cargos atuais serão **APAGADOS** e recriados.\n' +
                '**Esta ação é irreversível.** Deseja continuar?'
            )
            .setFooter({ text: 'Confirme apenas se tiver certeza absoluta.' }),
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('bkp_confirmar_sim').setLabel('Executar Restore').setEmoji('✅').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('bkp_confirmar_nao').setLabel('Cancelar').setEmoji('❌').setStyle(ButtonStyle.Secondary),
            ),
        ],
    };
}

function modalIntervalo() {
    return new ModalBuilder()
        .setCustomId('bkp_modal_intervalo')
        .setTitle('Configurar Backup Automático')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('bkp_input_intervalo')
                    .setLabel('Intervalo (ex: 1d, 12h, 1d 6h, 30m)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('1d 12h')
                    .setMinLength(2)
                    .setMaxLength(20)
                    .setRequired(true)
            )
        );
}

// ─── Módulo do Comando ────────────────────────────────────────────────────────

module.exports = {
    name: 'backup',
    aliases: ['bkp'],
    recarregarTimers, // chame no evento 'ready' do seu client

    execute: async (msg, args, client, OWNER_ID) => {
        const { guild, author, channel } = msg;

        if (author.id !== OWNER_ID && author.id !== guild.ownerId)
            return msg.reply({ content: '👑 Apenas a alta cúpula pode gerenciar backups.' });

        const { embed, row } = painelPrincipal(guild.id);
        const resposta       = await msg.reply({ embeds: [embed], components: [row] });

        const coletor = resposta.createMessageComponentCollector({
            filter: (i) => i.user.id === author.id,
            time:   COLLECTOR_TTL,
        });

        coletor.on('collect', async (i) => {

            // ── SALVAR ──────────────────────────────────────────────────────
            if (i.customId === 'bkp_salvar') {
                await i.deferUpdate();
                try {
                    const db = await readDB();
                    db[guild.id] = snapshotGuild(guild);
                    await writeDB(db);
                    const { embed: e, row: r } = painelPrincipal(guild.id);
                    await resposta.edit({ embeds: [e], components: [r] });
                    await tempMsg(channel, `🟩 **SISTEMA:** Backup salvo em \`${formatDate(new Date())}\`.`);
                } catch (e) {
                    console.error('[backup] Falha ao salvar:', e);
                    await tempMsg(channel, '❌ **ERRO:** Falha ao gravar o backup. Verifique os logs.');
                }
                return;
            }

            // ── RESTAURAR — Confirmação ──────────────────────────────────────
            if (i.customId === 'bkp_restaurar') {
                await i.deferUpdate();
                const db = await readDB();
                const { embed: e, components } = embedConfirmacaoRestore(db[guild.id] ?? null);
                await resposta.edit({ embeds: [e], components });
                return;
            }

            // ── RESTAURAR — Cancelar ─────────────────────────────────────────
            if (i.customId === 'bkp_confirmar_nao') {
                await i.deferUpdate();
                const { embed: e, row: r } = painelPrincipal(guild.id);
                await resposta.edit({ embeds: [e], components: [r] });
                return;
            }

            // ── RESTAURAR — Executar ─────────────────────────────────────────
            if (i.customId === 'bkp_confirmar_sim') {
                await i.deferUpdate();
                const db       = await readDB();
                const snapshot = db[guild.id];
                if (!snapshot) { await tempMsg(channel, '❌ Snapshot não encontrado.'); return; }
                coletor.stop('restore_iniciado');
                const msgProg = await channel.send({ content: '⏳ **SISTEMA:** Iniciando protocolo de restauração...' });
                await resposta.delete().catch(() => {});
                try {
                    await restoreGuild(guild, snapshot, msgProg);
                } catch (e) {
                    console.error('[restore] Erro crítico:', e);
                    await msgProg.edit({ content: '❌ **ERRO CRÍTICO:** Restore falhou. Verifique os logs.' }).catch(() => {});
                }
                return;
            }

            // ── AUTO BACKUP ──────────────────────────────────────────────────
            if (i.customId === 'bkp_auto') {
                if (autoTimers.has(guild.id)) {
                    // Desativar
                    await i.deferUpdate();
                    await cancelarTimer(guild.id);
                    const { embed: e, row: r } = painelPrincipal(guild.id);
                    await resposta.edit({ embeds: [e], components: [r] });
                    await tempMsg(channel, '⏱️ **MÓDULO:** Backup automático **desativado**.');
                } else {
                    // Abre modal para configurar intervalo
                    await i.showModal(modalIntervalo());

                    let submit;
                    try {
                        submit = await i.awaitModalSubmit({
                            filter: (m) => m.customId === 'bkp_modal_intervalo' && m.user.id === author.id,
                            time: 60_000,
                        });
                    } catch {
                        return; // Usuário fechou sem preencher
                    }

                    const inputBruto = submit.fields.getTextInputValue('bkp_input_intervalo').trim();
                    const intervalMs = parseDuration(inputBruto);

                    if (!intervalMs) {
                        await submit.reply({
                            content: '❌ **Formato inválido.** Use `d` (dias), `h` (horas), `m` (minutos).\nExemplos: `1d`, `12h`, `1d 6h`, `30m`.',
                            ephemeral: true,
                        });
                        return;
                    }

                    await submit.deferUpdate();
                    await armarTimer(guild, intervalMs);

                    const timerInfo = autoTimers.get(guild.id);
                    const { embed: e, row: r } = painelPrincipal(guild.id);
                    await resposta.edit({ embeds: [e], components: [r] });
                    await tempMsg(
                        channel,
                        `🟩 **MÓDULO:** Backup automático ativado — intervalo: \`${formatDuration(intervalMs)}\` · Próximo: \`${formatDate(timerInfo.proxima)}\`.`
                    );
                }
                return;
            }
        });

        coletor.on('end', (_, reason) => {
            if (reason === 'restore_iniciado') return;
            resposta.edit({ components: [] }).catch(() => {});
        });
    },
};