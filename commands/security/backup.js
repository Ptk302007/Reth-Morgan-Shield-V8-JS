'use strict';
// ============================================================
//  RETH MORGAN — BACKUP SYSTEM V2
//  ✅ Múltiplos slots de backup nomeados (até 5 por servidor)
//  ✅ Restore seletivo: tudo / só cargos / só canais
//  ✅ Progresso visual com barra animada no embed
//  ✅ Histórico de operações por servidor
//  ✅ DM de confirmação ao dono antes do restore destrutivo
//  ✅ Auto-backup persistente com reconexão automática
//  ✅ Exportar / importar snapshot como arquivo JSON
//  ✅ Preview do snapshot antes de restaurar
// ============================================================

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    AttachmentBuilder,
} = require('discord.js');
const fs   = require('fs/promises');
const path = require('path');

// ─── Constantes ──────────────────────────────────────────────────────────────

const DB_PATH        = path.resolve('./database/backups.json');
const CFG_PATH       = path.resolve('./database/backup_config.json');
const HIST_PATH      = path.resolve('./database/backup_historico.json');
const COLLECTOR_TTL  = 180_000;   // 3 minutos de inatividade fecha o painel
const DELAY_ROLE     = 300;
const DELAY_CHANNEL  = 350;
const MAX_SLOTS      = 5;         // máximo de backups por servidor
const COR_PRINCIPAL  = '#8B0000'; // vermelho escuro — tema Reth Morgan
const COR_SUCESSO    = '#2ecc71';
const COR_AVISO      = '#f39c12';
const COR_ERRO       = '#f53b57';

// ─── Timers automáticos em memória ───────────────────────────────────────────

const autoTimers = new Map(); // guildId → { timer, intervalMs, proxima, label }

// ─── Utilitários de tempo ────────────────────────────────────────────────────

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
    if (!(date instanceof Date)) date = new Date(date);
    return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function tempoRelativo(isoStr) {
    const diff = Date.now() - new Date(isoStr).getTime();
    if (diff < 60_000)       return 'agora há pouco';
    if (diff < 3_600_000)    return `${Math.floor(diff / 60_000)}min atrás`;
    if (diff < 86_400_000)   return `${Math.floor(diff / 3_600_000)}h atrás`;
    return `${Math.floor(diff / 86_400_000)}d atrás`;
}

const delay = (ms) => new Promise(res => setTimeout(res, ms));

// ─── I/O genérico ────────────────────────────────────────────────────────────

async function lerJSON(caminho, fallback = {}) {
    try { return JSON.parse(await fs.readFile(caminho, 'utf-8')); }
    catch (e) { if (e.code !== 'ENOENT') console.warn(`[backup] lerJSON(${path.basename(caminho)}):`, e.message); return fallback; }
}

async function salvarJSON(caminho, data) {
    const tmp = caminho + '.tmp';
    await fs.mkdir(path.dirname(caminho), { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tmp, caminho);
}

// ─── Histórico de operações ──────────────────────────────────────────────────

async function registrarHistorico(guildId, tipo, detalhes) {
    const hist = await lerJSON(HIST_PATH);
    if (!hist[guildId]) hist[guildId] = [];
    hist[guildId].unshift({
        tipo,       // 'SALVAR' | 'RESTAURAR' | 'DELETAR' | 'AUTO'
        detalhes,   // string descritiva
        data: new Date().toISOString(),
    });
    // Mantém só os últimos 20 registros por servidor
    hist[guildId] = hist[guildId].slice(0, 20);
    await salvarJSON(HIST_PATH, hist);
}

// ─── Snapshot ────────────────────────────────────────────────────────────────

function snapshotGuild(guild, label = 'backup') {
    const cargos = [...guild.roles.cache.values()]
        .filter(r => r.id !== guild.id && !r.managed)
        .sort((a, b) => a.position - b.position)
        .map(r => ({
            id: r.id, name: r.name, color: r.color,
            hoist: r.hoist, mentionable: r.mentionable,
            permissions: r.permissions.bitfield.toString(),
            position: r.position,
            icon: r.icon ?? null,
        }));

    const canais = [...guild.channels.cache.values()]
        .sort((a, b) => a.position - b.position)
        .map(c => ({
            id: c.id, name: c.name, type: c.type,
            parentId: c.parentId ?? null,
            position: c.position,
            topic: c.topic ?? null,
            nsfw: c.nsfw ?? false,
            rateLimitPerUser: c.rateLimitPerUser ?? 0,
            userLimit: c.userLimit ?? 0,
            bitrate: c.bitrate ?? null,
            overwrites: [...(c.permissionOverwrites?.cache?.values() ?? [])].map(o => ({
                id: o.id, type: o.type,
                allow: o.allow.bitfield.toString(),
                deny:  o.deny.bitfield.toString(),
            })),
        }));

    return {
        label,
        guildName:  guild.name,
        guildIcon:  guild.iconURL() ?? null,
        data:       new Date().toISOString(),
        stats: {
            cargos:  cargos.length,
            canais:  canais.length,
            membros: guild.memberCount,
        },
        cargos,
        canais,
    };
}

// ─── Barra de progresso ──────────────────────────────────────────────────────

function barraProgresso(atual, total, tamanho = 10) {
    const preenchido = Math.round((atual / total) * tamanho);
    const vazio      = tamanho - preenchido;
    return `${'█'.repeat(preenchido)}${'░'.repeat(vazio)} ${atual}/${total}`;
}

// ─── Restore ─────────────────────────────────────────────────────────────────

async function restoreGuild(guild, snapshot, msgStatus, modo = 'tudo') {
    const editStatus = (embed) => msgStatus.edit({ embeds: [embed], components: [] }).catch(() => {});

    const baseEmbed = () => new EmbedBuilder()
        .setColor(COR_PRINCIPAL)
        .setAuthor({ name: 'RETH MORGAN — PROTOCOLO DE RESTAURAÇÃO', iconURL: guild.client.user.displayAvatarURL() })
        .setFooter({ text: `Servidor: ${guild.name} · Não interrompa o processo` });

    const totalCargos  = modo !== 'canais' ? snapshot.cargos.length  : 0;
    const totalCanais  = modo !== 'cargos' ? snapshot.canais.length  : 0;
    let   feitos       = 0;
    const total        = totalCargos + totalCanais + (modo === 'tudo' ? 2 : 1); // +remoções

    const mapaCargos = {};
    const mapaCanais = {};

    // ── Fase 1: Remover canais ────────────────────────────────────────────────
    if (modo === 'tudo' || modo === 'canais') {
        const canaisAtuais = [...guild.channels.cache.values()];
        feitos++;
        await editStatus(baseEmbed()
            .setTitle('🔴 FASE 1 — Limpando canais existentes')
            .setDescription(`Removendo ${canaisAtuais.length} canais...\n\`${barraProgresso(feitos, total)}\``)
        );
        for (const c of canaisAtuais) await c.delete('Reth Morgan: Restore de backup').catch(() => {});
    }

    // ── Fase 2: Remover cargos ────────────────────────────────────────────────
    if (modo === 'tudo' || modo === 'cargos') {
        const posBot      = guild.members.me.roles.highest.position;
        const cargosAtuais = [...guild.roles.cache.values()]
            .filter(r => r.id !== guild.id && !r.managed && r.position < posBot);
        feitos++;
        await editStatus(baseEmbed()
            .setTitle('🔴 FASE 2 — Limpando cargos existentes')
            .setDescription(`Removendo ${cargosAtuais.length} cargos...\n\`${barraProgresso(feitos, total)}\``)
        );
        for (const r of cargosAtuais) await r.delete('Reth Morgan: Restore de backup').catch(() => {});
    }

    // ── Fase 3: Recriar cargos ────────────────────────────────────────────────
    if (modo === 'tudo' || modo === 'cargos') {
        for (const [idx, cOld] of snapshot.cargos.entries()) {
            try {
                const novo = await guild.roles.create({
                    name:        cOld.name,
                    color:       cOld.color,
                    hoist:       cOld.hoist,
                    mentionable: cOld.mentionable,
                    permissions: BigInt(cOld.permissions),
                    reason:      'Reth Morgan: Restore de backup',
                });
                mapaCargos[cOld.id] = novo.id;
            } catch (e) {
                console.error(`[restore] Cargo "${cOld.name}":`, e.message);
            }
            feitos++;
            if (idx % 3 === 0) {
                await editStatus(baseEmbed()
                    .setTitle('🟡 FASE 3 — Recriando cargos')
                    .setDescription(`Criando cargos do snapshot...\n\`${barraProgresso(feitos, total)}\`\n\n` +
                        `Último: **${cOld.name}**`)
                );
            }
            await delay(DELAY_ROLE);
        }
    }

    // ── Fase 4 e 5: Recriar categorias e canais ───────────────────────────────
    if (modo === 'tudo' || modo === 'canais') {
        const convOws = (ows) => (ows ?? []).map(ov => ({
            id:    mapaCargos[ov.id] ?? ov.id,
            type:  ov.type,
            allow: BigInt(ov.allow),
            deny:  BigInt(ov.deny),
        }));

        // Categorias primeiro
        const categorias = snapshot.canais
            .filter(c => c.type === 4)
            .sort((a, b) => a.position - b.position);

        for (const [idx, cat] of categorias.entries()) {
            try {
                const nova = await guild.channels.create({
                    name:                cat.name,
                    type:                4,
                    position:            cat.position,
                    permissionOverwrites: convOws(cat.overwrites),
                    reason:              'Reth Morgan: Restore de backup',
                });
                mapaCanais[cat.id] = nova.id;
            } catch (e) {
                console.error(`[restore] Categoria "${cat.name}":`, e.message);
            }
            feitos++;
            if (idx % 2 === 0) {
                await editStatus(baseEmbed()
                    .setTitle('🟡 FASE 4 — Recriando categorias')
                    .setDescription(`Estruturando categorias...\n\`${barraProgresso(feitos, total)}\`\n\n` +
                        `Última: **${cat.name}**`)
                );
            }
            await delay(DELAY_CHANNEL);
        }

        // Demais canais
        const demaisCanais = snapshot.canais
            .filter(c => c.type !== 4)
            .sort((a, b) => a.position - b.position);

        for (const [idx, ch] of demaisCanais.entries()) {
            try {
                await guild.channels.create({
                    name:                 ch.name,
                    type:                 ch.type,
                    parent:               ch.parentId ? (mapaCanais[ch.parentId] ?? null) : null,
                    position:             ch.position,
                    topic:                ch.topic,
                    nsfw:                 ch.nsfw,
                    rateLimitPerUser:     ch.rateLimitPerUser ?? 0,
                    userLimit:            ch.userLimit ?? 0,
                    ...(ch.bitrate ? { bitrate: ch.bitrate } : {}),
                    permissionOverwrites: convOws(ch.overwrites),
                    reason:               'Reth Morgan: Restore de backup',
                });
            } catch (e) {
                console.error(`[restore] Canal "${ch.name}":`, e.message);
            }
            feitos++;
            if (idx % 3 === 0) {
                await editStatus(baseEmbed()
                    .setTitle('🟡 FASE 5 — Recriando canais')
                    .setDescription(`Canais sendo reconstruídos...\n\`${barraProgresso(feitos, total)}\`\n\n` +
                        `Último: **${ch.name}**`)
                );
            }
            await delay(DELAY_CHANNEL);
        }
    }

    // ── Concluído ─────────────────────────────────────────────────────────────
    await editStatus(
        new EmbedBuilder()
            .setColor(COR_SUCESSO)
            .setAuthor({ name: 'RETH MORGAN — RESTAURAÇÃO CONCLUÍDA', iconURL: guild.client.user.displayAvatarURL() })
            .setTitle('🟩 SERVIDOR RESTAURADO COM SUCESSO')
            .addFields(
                { name: '📂 Snapshot',  value: `\`${snapshot.label}\` — salvo ${tempoRelativo(snapshot.data)}`, inline: true },
                { name: '🎭 Cargos',    value: `${snapshot.cargos.length} recriados`,  inline: true },
                { name: '📣 Canais',    value: `${snapshot.canais.length} recriados`,  inline: true },
                { name: '⚙️ Modo',      value: modo === 'tudo' ? 'Restauração completa' : modo === 'cargos' ? 'Apenas cargos' : 'Apenas canais', inline: true },
            )
            .setTimestamp()
            .setFooter({ text: 'Reth Morgan Shield System V2' })
    );
}

// ─── Auto-backup ─────────────────────────────────────────────────────────────

async function armarTimer(guild, intervalMs, label = 'auto') {
    if (autoTimers.has(guild.id)) clearInterval(autoTimers.get(guild.id).timer);

    const proxima = new Date(Date.now() + intervalMs);

    const timer = setInterval(async () => {
        try {
            const db = await lerJSON(DB_PATH);
            db[guild.id] = normalizarSlots(db[guild.id]);

            const snap = snapshotGuild(guild, label);

            // Adiciona no início e limita MAX_SLOTS slots
            db[guild.id].unshift(snap);
            if (db[guild.id].length > MAX_SLOTS) db[guild.id] = db[guild.id].slice(0, MAX_SLOTS);

            await salvarJSON(DB_PATH, db);
            await registrarHistorico(guild.id, 'AUTO', `Auto-backup "${label}" executado`);

            const cfg = await lerJSON(CFG_PATH);
            if (cfg[guild.id]) {
                cfg[guild.id].proxima = new Date(Date.now() + intervalMs).toISOString();
                await salvarJSON(CFG_PATH, cfg);
            }
            if (autoTimers.has(guild.id))
                autoTimers.get(guild.id).proxima = new Date(Date.now() + intervalMs);

            console.log(`[auto-backup] "${guild.name}" — slot "${label}" salvo`);
        } catch (e) {
            console.error('[auto-backup] Falha:', e.message);
        }
    }, intervalMs);

    autoTimers.set(guild.id, { timer, intervalMs, proxima, label });

    const cfg = await lerJSON(CFG_PATH);
    cfg[guild.id] = { intervalMs, label, proxima: proxima.toISOString() };
    await salvarJSON(CFG_PATH, cfg);
}

async function cancelarTimer(guildId) {
    if (autoTimers.has(guildId)) {
        clearInterval(autoTimers.get(guildId).timer);
        autoTimers.delete(guildId);
    }
    const cfg = await lerJSON(CFG_PATH);
    delete cfg[guildId];
    await salvarJSON(CFG_PATH, cfg);
}

async function recarregarTimers(client) {
    const cfg = await lerJSON(CFG_PATH);
    for (const [guildId, { intervalMs, label }] of Object.entries(cfg)) {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue;
        await armarTimer(guild, intervalMs, label || 'auto');
        console.log(`[auto-backup] Timer rearmado: "${guild.name}" — ${formatDuration(intervalMs)}`);
    }
}

// ─── Embeds do painel ────────────────────────────────────────────────────────

function normalizarSlots(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    // Formato antigo: objeto único com { nome, data, cargos, canais }
    if (raw.cargos && raw.canais) {
        return [{
            label:     raw.label ?? raw.nome ?? 'backup-antigo',
            guildName: raw.guildName ?? raw.nome ?? '?',
            guildIcon: raw.guildIcon ?? null,
            data:      raw.data,
            stats: {
                cargos:  raw.cargos.length,
                canais:  raw.canais.length,
                membros: raw.stats?.membros ?? 0,
            },
            cargos:  raw.cargos,
            canais:  raw.canais,
        }];
    }
    return [];
}

async function embedPainelPrincipal(guild) {
    const db        = await lerJSON(DB_PATH);
    const slots     = normalizarSlots(db[guild.id]);
    const timerInfo = autoTimers.get(guild.id);
    const autoAtivo = !!timerInfo;
    const hist      = (await lerJSON(HIST_PATH))[guild.id] ?? [];

    const linhasSlots = slots.length === 0
        ? '> *Nenhum backup salvo ainda.*'
        : slots.map((s, i) =>
            `> \`[${i + 1}]\` **${s.label}** — ${s.stats.cargos} cargos · ${s.stats.canais} canais · *${tempoRelativo(s.data)}*`
          ).join('\n');

    const ultimaOp = hist[0]
        ? `\`${hist[0].tipo}\` — ${hist[0].detalhes} *(${tempoRelativo(hist[0].data)})*`
        : '*Nenhuma operação registrada*';

    const statusAuto = autoAtivo
        ? `🟩 **ATIVO** — intervalo \`${formatDuration(timerInfo.intervalMs)}\` · próximo \`${formatDate(timerInfo.proxima)}\``
        : '🟥 **INATIVO** — clique em **⏱️ Auto** para configurar';

    return new EmbedBuilder()
        .setColor(COR_PRINCIPAL)
        .setAuthor({ name: 'RETH MORGAN — COFRE DE BACKUPS V2', iconURL: guild.client.user.displayAvatarURL() })
        .setThumbnail(guild.iconURL({ dynamic: true }) ?? null)
        .setTitle(`🗄️ ${guild.name}`)
        .addFields(
            {
                name:   `📦 SLOTS SALVOS  \`${slots.length}/${MAX_SLOTS}\``,
                value:  linhasSlots,
                inline: false,
            },
            {
                name:   '⏱️ AUTO-BACKUP',
                value:  statusAuto,
                inline: false,
            },
            {
                name:   '📋 ÚLTIMA OPERAÇÃO',
                value:  ultimaOp,
                inline: false,
            },
        )
        .setFooter({ text: `Use os botões abaixo · Painel fecha em 3min sem uso` })
        .setTimestamp();
}

function rowPainelPrincipal(temSlots) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bkp_salvar').setLabel('Salvar Novo').setEmoji('💾').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('bkp_restaurar').setLabel('Restaurar').setEmoji('🔄').setStyle(ButtonStyle.Danger).setDisabled(!temSlots),
            new ButtonBuilder().setCustomId('bkp_deletar').setLabel('Deletar').setEmoji('🗑️').setStyle(ButtonStyle.Secondary).setDisabled(!temSlots),
            new ButtonBuilder().setCustomId('bkp_exportar').setLabel('Exportar').setEmoji('📤').setStyle(ButtonStyle.Secondary).setDisabled(!temSlots),
            new ButtonBuilder().setCustomId('bkp_auto').setLabel('⏱️ Auto').setStyle(ButtonStyle.Primary),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bkp_historico').setLabel('Histórico').setEmoji('📋').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('bkp_preview').setLabel('Preview').setEmoji('🔍').setStyle(ButtonStyle.Secondary).setDisabled(!temSlots),
        ),
    ];
}

// ─── Select menus ─────────────────────────────────────────────────────────────

function selectSlots(slots, customId, placeholder) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(placeholder)
            .addOptions(
                slots.map((s, i) => ({
                    label:       `[${i + 1}] ${s.label}`,
                    description: `${s.stats.cargos} cargos · ${s.stats.canais} canais · ${tempoRelativo(s.data)}`,
                    value:       String(i),
                    emoji:       '💾',
                }))
            )
    );
}

function selectModoRestore() {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('bkp_modo_restore')
            .setPlaceholder('Escolha o modo de restauração...')
            .addOptions([
                { label: 'Restauração Completa',   description: 'Apaga tudo e reconstrói cargos + canais',  value: 'tudo',   emoji: '🔄' },
                { label: 'Apenas Cargos',           description: 'Remove e recria somente os cargos',         value: 'cargos', emoji: '🎭' },
                { label: 'Apenas Canais',            description: 'Remove e recria somente os canais',         value: 'canais', emoji: '📣' },
            ])
    );
}

// ─── Modais ──────────────────────────────────────────────────────────────────

function modalSalvar() {
    return new ModalBuilder()
        .setCustomId('bkp_modal_salvar')
        .setTitle('💾 Salvar Backup')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('bkp_input_label')
                    .setLabel('Nome do backup (ex: pré-evento, limpo, v2)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('backup-principal')
                    .setMinLength(2)
                    .setMaxLength(30)
                    .setRequired(true)
            )
        );
}

function modalAutoBackup(labelAtual = '') {
    return new ModalBuilder()
        .setCustomId('bkp_modal_auto')
        .setTitle('⏱️ Configurar Auto-Backup')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('bkp_auto_intervalo')
                    .setLabel('Intervalo (ex: 1d, 12h, 6h, 30m)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('1d')
                    .setMinLength(2).setMaxLength(20).setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('bkp_auto_label')
                    .setLabel('Nome do slot (substituído a cada ciclo)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('auto')
                    .setValue(labelAtual || 'auto')
                    .setMinLength(2).setMaxLength(30).setRequired(true)
            )
        );
}

// ─── Confirmação de restore por DM ───────────────────────────────────────────

async function pedirConfirmacaoDM(member, snapshot, modo) {
    try {
        const dm = await member.createDM();
        const embed = new EmbedBuilder()
            .setColor(COR_ERRO)
            .setTitle('⚠️ CONFIRMAÇÃO DE RESTORE — RETH MORGAN')
            .setDescription(
                `Você acionou um **protocolo de restauração** no servidor **${member.guild.name}**.\n\n` +
                `📦 **Backup:** \`${snapshot.label}\`\n` +
                `🕐 **Salvo:** ${formatDate(new Date(snapshot.data))}\n` +
                `⚙️ **Modo:** ${modo === 'tudo' ? 'Restauração completa' : modo === 'cargos' ? 'Apenas cargos' : 'Apenas canais'}\n\n` +
                '**Esta ação é irreversível.** Confirme digitando `CONFIRMAR` nessa DM em até 60 segundos.'
            )
            .setFooter({ text: 'Se não foi você, alguém acessou seu painel.' });

        await dm.send({ embeds: [embed] });

        const filtro    = (m) => m.author.id === member.id && m.content.trim().toUpperCase() === 'CONFIRMAR';
        const coletorDM = dm.createMessageCollector({ filter: filtro, max: 1, time: 60_000 });

        return new Promise((resolve) => {
            coletorDM.on('collect', () => resolve(true));
            coletorDM.on('end',     (col) => { if (col.size === 0) resolve(false); });
        });
    } catch {
        // DMs fechadas — permite sem confirmação (avisa no canal)
        return null;
    }
}

// ─── MÓDULO PRINCIPAL ─────────────────────────────────────────────────────────

module.exports = {
    name:    'backup',
    aliases: ['bkp', 'cofre'],
    recarregarTimers,

    execute: async (msg, args, client, OWNER_ID) => {
        const { guild, author, channel } = msg;

        // Permissão
        if (author.id !== OWNER_ID && author.id !== guild.ownerId)
            return msg.reply({
                embeds: [new EmbedBuilder()
                    .setColor(COR_ERRO)
                    .setDescription('👑 Apenas o **dono do servidor** ou o **desenvolvedor** pode gerenciar backups.')
                ],
            });

        // Estado da sessão
        let slotSelecionado  = null; // índice do slot escolhido
        let modoPendente     = null; // modo de restore escolhido

        // ── Renderiza painel principal ────────────────────────────────────────
        async function buildPainelPayload() {
            const db    = await lerJSON(DB_PATH);
            const slots = normalizarSlots(db[guild.id]);
            const embed = await embedPainelPrincipal(guild);
            const rows  = rowPainelPrincipal(slots.length > 0);
            return { embeds: [embed], components: rows };
        }

        const resposta = await msg.reply(await buildPainelPayload());

        async function renderPainel() {
            return resposta.edit(await buildPainelPayload());
        }

        const coletor = resposta.createMessageComponentCollector({
            filter: (i) => i.user.id === author.id,
            idle:   COLLECTOR_TTL,
        });

        // ── Handler central ───────────────────────────────────────────────────
        coletor.on('collect', async (i) => {

            // ══ SALVAR ════════════════════════════════════════════════════════
            if (i.customId === 'bkp_salvar') {
                const db    = await lerJSON(DB_PATH);
                const slots = normalizarSlots(db[guild.id]);

                if (slots.length >= MAX_SLOTS) {
                    return i.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(COR_AVISO)
                            .setDescription(`⚠️ Limite de **${MAX_SLOTS} slots** atingido. Delete um backup antes de salvar novo.`)
                        ],
                        ephemeral: true,
                    });
                }

                await i.showModal(modalSalvar());

                let submit;
                try {
                    submit = await i.awaitModalSubmit({
                        filter: (m) => m.customId === 'bkp_modal_salvar' && m.user.id === author.id,
                        time: 60_000,
                    });
                } catch { return; }

                const label = submit.fields.getTextInputValue('bkp_input_label').trim();
                await submit.deferUpdate();

                try {
                    const snap       = snapshotGuild(guild, label);
                    const dbAtual    = await lerJSON(DB_PATH);
                    dbAtual[guild.id] = normalizarSlots(dbAtual[guild.id]);
                    dbAtual[guild.id].unshift(snap);
                    if (dbAtual[guild.id].length > MAX_SLOTS)
                        dbAtual[guild.id] = dbAtual[guild.id].slice(0, MAX_SLOTS);
                    await salvarJSON(DB_PATH, dbAtual);
                    await registrarHistorico(guild.id, 'SALVAR', `Snapshot "${label}" criado · ${snap.stats.cargos} cargos · ${snap.stats.canais} canais`);
                    await renderPainel();
                } catch (e) {
                    console.error('[backup] Falha ao salvar:', e);
                    await i.followUp({ content: '❌ Erro ao gravar o backup. Verifique os logs.', ephemeral: true });
                }
                return;
            }

            // ══ RESTAURAR — escolha do slot ══════════════════════════════════
            if (i.customId === 'bkp_restaurar') {
                await i.deferUpdate();
                const db    = await lerJSON(DB_PATH);
                const slots = normalizarSlots(db[guild.id]);
                if (!slots.length) return;

                await resposta.edit({
                    embeds: [new EmbedBuilder()
                        .setColor(COR_AVISO)
                        .setTitle('🔄 PROTOCOLO DE RESTAURAÇÃO — Passo 1/3')
                        .setDescription('Selecione **qual backup** deseja restaurar:')
                    ],
                    components: [
                        selectSlots(slots, 'bkp_select_slot_restore', 'Escolha um backup...'),
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('bkp_voltar').setLabel('Voltar').setEmoji('↩️').setStyle(ButtonStyle.Secondary)
                        ),
                    ],
                });
                return;
            }

            if (i.customId === 'bkp_select_slot_restore') {
                slotSelecionado = parseInt(i.values[0]);
                await i.deferUpdate();
                await resposta.edit({
                    embeds: [new EmbedBuilder()
                        .setColor(COR_AVISO)
                        .setTitle('🔄 PROTOCOLO DE RESTAURAÇÃO — Passo 2/3')
                        .setDescription('Selecione o **modo de restauração**:')
                        .addFields(
                            { name: '🔄 Completo',      value: 'Apaga tudo e reconstrói cargos + canais', inline: true },
                            { name: '🎭 Só cargos',     value: 'Remove e recria apenas os cargos',        inline: true },
                            { name: '📣 Só canais',     value: 'Remove e recria apenas os canais',        inline: true },
                        )
                    ],
                    components: [
                        selectModoRestore(),
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('bkp_voltar').setLabel('Voltar').setEmoji('↩️').setStyle(ButtonStyle.Secondary)
                        ),
                    ],
                });
                return;
            }

            if (i.customId === 'bkp_modo_restore') {
                modoPendente = i.values[0];
                await i.deferUpdate();

                const db      = await lerJSON(DB_PATH);
                const slots   = normalizarSlots(db[guild.id]);
                const snapshot = slots[slotSelecionado];
                if (!snapshot) return;

                await resposta.edit({
                    embeds: [new EmbedBuilder()
                        .setColor(COR_ERRO)
                        .setTitle('⚠️ PROTOCOLO DE RESTAURAÇÃO — Passo 3/3 · CONFIRMAÇÃO FINAL')
                        .addFields(
                            { name: '📦 Backup',      value: `\`${snapshot.label}\``,                                                    inline: true },
                            { name: '🕐 Salvo em',    value: formatDate(new Date(snapshot.data)),                                          inline: true },
                            { name: '⚙️ Modo',        value: modoPendente === 'tudo' ? '🔄 Completo' : modoPendente === 'cargos' ? '🎭 Só cargos' : '📣 Só canais', inline: true },
                            { name: '🎭 Cargos',      value: `${snapshot.stats.cargos}`,  inline: true },
                            { name: '📣 Canais',      value: `${snapshot.stats.canais}`,  inline: true },
                            { name: '👥 Membros',     value: `${snapshot.stats.membros}`, inline: true },
                            { name: '‼️ ATENÇÃO',      value: 'Estrutura atual será **destruída**. Você receberá uma confirmação por **DM**.', inline: false },
                        )
                        .setFooter({ text: 'Você tem 60 segundos para confirmar na sua DM.' })
                    ],
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('bkp_executar_restore').setLabel('Prosseguir — enviar DM de confirmação').setEmoji('✅').setStyle(ButtonStyle.Danger),
                            new ButtonBuilder().setCustomId('bkp_voltar').setLabel('Cancelar').setEmoji('❌').setStyle(ButtonStyle.Secondary),
                        ),
                    ],
                });
                return;
            }

            if (i.customId === 'bkp_executar_restore') {
                await i.deferUpdate();

                const db       = await lerJSON(DB_PATH);
                const slots    = normalizarSlots(db[guild.id]);
                const snapshot = slots[slotSelecionado];
                if (!snapshot) return;

                const member    = await guild.members.fetch(author.id).catch(() => null);
                const confirmou = await pedirConfirmacaoDM(member, snapshot, modoPendente);

                if (confirmou === false) {
                    await resposta.edit({
                        embeds: [new EmbedBuilder()
                            .setColor(COR_ERRO)
                            .setDescription('❌ **Restore cancelado.** Confirmação na DM não recebida em 60 segundos.')
                        ],
                        components: [],
                    });
                    setTimeout(() => renderPainel().catch(() => {}), 4000);
                    return;
                }

                if (confirmou === null) {
                    await channel.send({
                        embeds: [new EmbedBuilder()
                            .setColor(COR_AVISO)
                            .setDescription('⚠️ Suas DMs estão fechadas — **prosseguindo sem confirmação por DM**. Abra suas DMs no futuro para maior segurança.')
                        ],
                    }).catch(() => {});
                }

                coletor.stop('restore_iniciado');
                const msgProg = await channel.send({ content: '⏳ **SISTEMA:** Inicializando protocolo...' });
                await resposta.delete().catch(() => {});

                try {
                    await restoreGuild(guild, snapshot, msgProg, modoPendente);
                    await registrarHistorico(guild.id, 'RESTAURAR', `Restore do slot "${snapshot.label}" (modo: ${modoPendente})`);
                } catch (e) {
                    console.error('[restore] Erro crítico:', e);
                    await msgProg.edit({
                        embeds: [new EmbedBuilder()
                            .setColor(COR_ERRO)
                            .setTitle('❌ ERRO CRÍTICO NO RESTORE')
                            .setDescription('Ocorreu uma falha durante a restauração. Verifique os logs do console.')
                        ],
                        components: [],
                    }).catch(() => {});
                }
                return;
            }

            // ══ DELETAR slot ═════════════════════════════════════════════════
            if (i.customId === 'bkp_deletar') {
                await i.deferUpdate();
                const db    = await lerJSON(DB_PATH);
                const slots = normalizarSlots(db[guild.id]);

                await resposta.edit({
                    embeds: [new EmbedBuilder()
                        .setColor(COR_AVISO)
                        .setTitle('🗑️ DELETAR BACKUP')
                        .setDescription('Selecione qual backup deseja remover permanentemente:')
                    ],
                    components: [
                        selectSlots(slots, 'bkp_select_slot_delete', 'Escolha um backup para deletar...'),
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('bkp_voltar').setLabel('Cancelar').setEmoji('↩️').setStyle(ButtonStyle.Secondary)
                        ),
                    ],
                });
                return;
            }

            if (i.customId === 'bkp_select_slot_delete') {
                await i.deferUpdate();
                const idx     = parseInt(i.values[0]);
                const db      = await lerJSON(DB_PATH);
                const slots   = normalizarSlots(db[guild.id]);
                const removido = slots[idx];
                if (!removido) return;

                slots.splice(idx, 1);
                db[guild.id] = slots;
                await salvarJSON(DB_PATH, db);
                await registrarHistorico(guild.id, 'DELETAR', `Slot "${removido.label}" removido`);
                await renderPainel();
                return;
            }

            // ══ EXPORTAR snapshot como arquivo JSON ═══════════════════════════
            if (i.customId === 'bkp_exportar') {
                await i.deferUpdate();
                const db    = await lerJSON(DB_PATH);
                const slots = normalizarSlots(db[guild.id]);

                await resposta.edit({
                    embeds: [new EmbedBuilder()
                        .setColor(COR_PRINCIPAL)
                        .setTitle('📤 EXPORTAR BACKUP')
                        .setDescription('Selecione qual backup exportar como arquivo `.json`:')
                    ],
                    components: [
                        selectSlots(slots, 'bkp_select_slot_export', 'Escolha um backup para exportar...'),
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('bkp_voltar').setLabel('Cancelar').setEmoji('↩️').setStyle(ButtonStyle.Secondary)
                        ),
                    ],
                });
                return;
            }

            if (i.customId === 'bkp_select_slot_export') {
                await i.deferUpdate();
                const idx     = parseInt(i.values[0]);
                const db      = await lerJSON(DB_PATH);
                const snapshot = normalizarSlots(db[guild.id])[idx];
                if (!snapshot) return;

                const json    = JSON.stringify(snapshot, null, 2);
                const buffer  = Buffer.from(json, 'utf-8');
                const arquivo = new AttachmentBuilder(buffer, {
                    name:        `reth-backup-${snapshot.label.replace(/\s/g, '_')}-${guild.id}.json`,
                    description: `Backup "${snapshot.label}" de ${guild.name}`,
                });

                await channel.send({
                    embeds: [new EmbedBuilder()
                        .setColor(COR_SUCESSO)
                        .setDescription(`📤 Backup **${snapshot.label}** exportado com sucesso.`)
                    ],
                    files: [arquivo],
                });
                await renderPainel();
                return;
            }

            // ══ PREVIEW do snapshot ══════════════════════════════════════════
            if (i.customId === 'bkp_preview') {
                await i.deferUpdate();
                const db    = await lerJSON(DB_PATH);
                const slots = normalizarSlots(db[guild.id]);

                await resposta.edit({
                    embeds: [new EmbedBuilder()
                        .setColor(COR_PRINCIPAL)
                        .setTitle('🔍 PREVIEW DE BACKUP')
                        .setDescription('Selecione um backup para visualizar o conteúdo:')
                    ],
                    components: [
                        selectSlots(slots, 'bkp_select_slot_preview', 'Escolha um backup para ver o preview...'),
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('bkp_voltar').setLabel('Voltar').setEmoji('↩️').setStyle(ButtonStyle.Secondary)
                        ),
                    ],
                });
                return;
            }

            if (i.customId === 'bkp_select_slot_preview') {
                await i.deferUpdate();
                const idx      = parseInt(i.values[0]);
                const db       = await lerJSON(DB_PATH);
                const snapshot = normalizarSlots(db[guild.id])[idx];
                if (!snapshot) return;

                const topCargos = snapshot.cargos.slice(-5).reverse().map(r => `\`${r.name}\``).join(', ');
                const topCanais = snapshot.canais.filter(c => c.type !== 4).slice(0, 5).map(c => `\`#${c.name}\``).join(', ');
                const cats      = snapshot.canais.filter(c => c.type === 4).map(c => `\`${c.name}\``).join(', ') || '*nenhuma*';

                await resposta.edit({
                    embeds: [new EmbedBuilder()
                        .setColor(COR_PRINCIPAL)
                        .setTitle(`🔍 PREVIEW — ${snapshot.label}`)
                        .addFields(
                            { name: '🏠 Servidor',        value: snapshot.guildName,        inline: true },
                            { name: '🕐 Salvo em',        value: formatDate(new Date(snapshot.data)), inline: true },
                            { name: '👥 Membros',         value: `${snapshot.stats.membros}`,        inline: true },
                            { name: `🎭 Cargos (${snapshot.stats.cargos})`,   value: topCargos || '*—*',  inline: false },
                            { name: `📁 Categorias`,       value: cats,                                  inline: false },
                            { name: `📣 Canais (${snapshot.stats.canais})`,   value: topCanais || '*—*',  inline: false },
                        )
                        .setFooter({ text: 'Mostrando amostra dos dados · arquivo completo via Exportar' })
                    ],
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('bkp_voltar').setLabel('Voltar').setEmoji('↩️').setStyle(ButtonStyle.Secondary)
                        ),
                    ],
                });
                return;
            }

            // ══ HISTÓRICO ════════════════════════════════════════════════════
            if (i.customId === 'bkp_historico') {
                await i.deferUpdate();
                const hist = (await lerJSON(HIST_PATH))[guild.id] ?? [];

                const linhas = hist.length === 0
                    ? '*Nenhuma operação registrada ainda.*'
                    : hist.slice(0, 10).map((h, idx) =>
                        `\`[${String(idx + 1).padStart(2, '0')}]\` **${h.tipo}** — ${h.detalhes} *(${tempoRelativo(h.data)})*`
                      ).join('\n');

                await resposta.edit({
                    embeds: [new EmbedBuilder()
                        .setColor(COR_PRINCIPAL)
                        .setTitle('📋 HISTÓRICO DE OPERAÇÕES')
                        .setDescription(linhas)
                        .setFooter({ text: 'Últimas 10 operações' })
                    ],
                    components: [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('bkp_voltar').setLabel('Voltar').setEmoji('↩️').setStyle(ButtonStyle.Secondary)
                        ),
                    ],
                });
                return;
            }

            // ══ AUTO-BACKUP ══════════════════════════════════════════════════
            if (i.customId === 'bkp_auto') {
                const autoAtivo = autoTimers.has(guild.id);

                if (autoAtivo) {
                    // Mostra painel com opção de desativar ou reconfigurar
                    const ti = autoTimers.get(guild.id);
                    await i.deferUpdate();
                    await resposta.edit({
                        embeds: [new EmbedBuilder()
                            .setColor(COR_PRINCIPAL)
                            .setTitle('⏱️ AUTO-BACKUP — ATIVO')
                            .addFields(
                                { name: '📦 Slot',       value: `\`${ti.label}\``,              inline: true },
                                { name: '🔁 Intervalo',  value: formatDuration(ti.intervalMs),   inline: true },
                                { name: '📅 Próximo',    value: formatDate(ti.proxima),           inline: true },
                            )
                        ],
                        components: [new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('bkp_auto_desativar').setLabel('Desativar').setEmoji('🛑').setStyle(ButtonStyle.Danger),
                            new ButtonBuilder().setCustomId('bkp_auto_reconfigurar').setLabel('Reconfigurar').setEmoji('⚙️').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId('bkp_voltar').setLabel('Voltar').setEmoji('↩️').setStyle(ButtonStyle.Secondary),
                        )],
                    });
                } else {
                    await i.showModal(modalAutoBackup());
                    let submit;
                    try {
                        submit = await i.awaitModalSubmit({
                            filter: (m) => m.customId === 'bkp_modal_auto' && m.user.id === author.id,
                            time: 60_000,
                        });
                    } catch { return; }

                    const intervaloStr = submit.fields.getTextInputValue('bkp_auto_intervalo').trim();
                    const labelAuto    = submit.fields.getTextInputValue('bkp_auto_label').trim();
                    const intervalMs   = parseDuration(intervaloStr);

                    if (!intervalMs) {
                        return submit.reply({ content: '❌ Formato inválido. Use `d`, `h`, `m`. Ex: `1d`, `12h`, `30m`.', ephemeral: true });
                    }

                    await submit.deferUpdate();
                    await armarTimer(guild, intervalMs, labelAuto);
                    await registrarHistorico(guild.id, 'AUTO', `Auto-backup configurado: a cada ${formatDuration(intervalMs)}`);
                    await renderPainel();
                }
                return;
            }

            if (i.customId === 'bkp_auto_desativar') {
                await i.deferUpdate();
                await cancelarTimer(guild.id);
                await registrarHistorico(guild.id, 'AUTO', 'Auto-backup desativado');
                await renderPainel();
                return;
            }

            if (i.customId === 'bkp_auto_reconfigurar') {
                const labelAtual = autoTimers.get(guild.id)?.label ?? 'auto';
                await i.showModal(modalAutoBackup(labelAtual));
                let submit;
                try {
                    submit = await i.awaitModalSubmit({
                        filter: (m) => m.customId === 'bkp_modal_auto' && m.user.id === author.id,
                        time: 60_000,
                    });
                } catch { return; }

                const intervaloStr = submit.fields.getTextInputValue('bkp_auto_intervalo').trim();
                const labelAuto    = submit.fields.getTextInputValue('bkp_auto_label').trim();
                const intervalMs   = parseDuration(intervaloStr);

                if (!intervalMs)
                    return submit.reply({ content: '❌ Formato inválido.', ephemeral: true });

                await submit.deferUpdate();
                await armarTimer(guild, intervalMs, labelAuto);
                await registrarHistorico(guild.id, 'AUTO', `Auto-backup reconfigurado: a cada ${formatDuration(intervalMs)}`);
                await renderPainel();
                return;
            }

            // ══ VOLTAR ════════════════════════════════════════════════════════
            if (i.customId === 'bkp_voltar') {
                await i.deferUpdate();
                slotSelecionado = null;
                modoPendente    = null;
                await renderPainel();
                return;
            }
        });

        coletor.on('end', (_, reason) => {
            if (reason === 'restore_iniciado') return;
            resposta.edit({ components: [] }).catch(() => {});
        });
    },
};
