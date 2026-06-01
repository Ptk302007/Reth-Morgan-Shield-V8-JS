// ============================================================
//  RETH MORGAN — SHIELD SYSTEM V8
//  index.js — Servidor + Bot + Painel Web Integrado
//  FIX: Anti-Mass Ban/Kick não pune mais o próprio bot
// ============================================================
require('dotenv').config();
const express    = require('express');
const session    = require('express-session');
const fetch      = require('node-fetch');
const fs         = require('fs');
const path       = require('path');

const app  = express();
const port = process.env.PORT || 10000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'reth_morgan_secret_v8',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

const CLIENT_ID     = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI  = process.env.DISCORD_REDIRECT_URI;

function requireLogin(req, res, next) {
    if (req.session?.user) return next();
    return res.redirect('/');
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/status', (req, res) => {
    res.json({
        commandsCount: client.commands?.size || 0,
        guildsCount:   client.guilds?.cache?.size || 0,
        status:        'online'
    });
});

app.get('/auth/login', (req, res) => {
    const params = new URLSearchParams({
        client_id:     CLIENT_ID,
        redirect_uri:  REDIRECT_URI,
        response_type: 'code',
        scope:         'identify guilds'
    });
    res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/');
    try {
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI
            })
        });
        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const userData = await userRes.json();

        const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const guildsData = await guildsRes.json();

        const adminGuilds = guildsData.filter(g => {
            const isAdmin = (BigInt(g.permissions) & BigInt(0x8)) === BigInt(0x8);
            const botEsta = client.guilds.cache.has(g.id);
            return isAdmin && botEsta;
        }).map(g => ({ id: g.id, name: g.name }));

        req.session.user = {
            id: userData.id, username: userData.username,
            avatar: userData.avatar
                ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
                : `https://cdn.discordapp.com/embed/avatars/0.png`
        };
        req.session.guilds = adminGuilds;
        res.redirect('/dashboard');
    } catch (e) {
        console.error('[OAuth] Erro:', e);
        res.redirect('/');
    }
});

app.get('/dashboard', requireLogin, (req, res) => {
    const { user, guilds } = req.session;
    let panelHtml = fs.readFileSync(path.join(__dirname, 'public', 'panel.html'), 'utf-8');
    panelHtml = panelHtml.replace(
        '/* DATA_INJECTION */',
        `window.dashboardData = ${JSON.stringify({ username: user.username, avatar: user.avatar, guilds })};`
    );
    res.send(panelHtml);
});

app.get('/api/config/:guildId', requireLogin, (req, res) => {
    const { guildId } = req.params;
    const temAcesso = req.session.guilds?.some(g => g.id === guildId);
    if (!temAcesso) return res.status(403).json({ error: 'Sem permissão.' });
    try {
        const configs = JSON.parse(fs.readFileSync('./database/config.json', 'utf-8'));
        res.json(configs[guildId] || {});
    } catch (e) { res.json({}); }
});

app.post('/api/chat', requireLogin, async (req, res) => {
    const { mensagem, historico, sistema, imagemBase64, mimeType } = req.body;

    if (!mensagem && !imagemBase64) {
        return res.status(400).json({ error: 'Mensagem ou imagem obrigatória.' });
    }

    try {
        const sessionId = `web_${req.session.user.id}`;
        const resposta  = await perguntarParaIA(
            mensagem  || "Descreva esta imagem.",
            sistema   || "",
            sessionId,
            imagemBase64 || null,
            mimeType     || "image/jpeg"
        );
        res.json({ resposta: resposta.trim() });
    } catch (e) {
        console.error('[API Chat]', e);
        res.status(500).json({ error: 'Erro ao processar resposta da IA.' });
    }
});

app.post('/api/config/save', requireLogin, (req, res) => {
    const { guildId, ...novaConfig } = req.body;
    const temAcesso = req.session.guilds?.some(g => g.id === guildId);
    if (!temAcesso) return res.status(403).json({ message: 'Sem permissão.' });
    try {
        let configs = {};
        try { configs = JSON.parse(fs.readFileSync('./database/config.json', 'utf-8')); } catch(e) {}
        configs[guildId] = { ...configs[guildId], ...novaConfig };
        fs.writeFileSync('./database/config.json', JSON.stringify(configs, null, 2));
        res.json({ message: 'Protocolos gravados com sucesso, operador.' });
    } catch (e) {
        console.error('[Config Save]', e);
        res.status(500).json({ message: 'Erro ao gravar configurações.' });
    }
});

app.post('/api/config/panic', requireLogin, async (req, res) => {
    const { guildId } = req.body;
    const temAcesso = req.session.guilds?.some(g => g.id === guildId);
    if (!temAcesso) return res.status(403).json({ message: 'Sem permissão.' });
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return res.status(404).json({ message: 'Bot não está nesse servidor.' });
        let travados = 0;
        for (const [, canal] of guild.channels.cache.filter(c => c.type === 0)) {
            try {
                await canal.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
                travados++;
            } catch (_) {}
        }
        res.json({ message: `🔒 Lockdown ativado. ${travados} canais travados.` });
    } catch (e) {
        console.error('[Panic]', e);
        res.status(500).json({ message: 'Erro ao acionar lockdown.' });
    }
});

app.get('/chat', requireLogin, (req, res) => {
    const { user } = req.session;
    let chatHtml = fs.readFileSync(path.join(__dirname, 'public', 'chat.html'), 'utf-8');
    chatHtml = chatHtml.replace(
        '/* DATA_INJECTION */',
        `window.dashboardData = ${JSON.stringify({ id: user.id, username: user.username, avatar: user.avatar })};`
    );
    res.send(chatHtml);
});

app.get('/auth/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(port, () => {
    console.log(`🌐 Servidor web na porta ${port}`);
});

// ============================================================
//  TRAVAS DE SEGURANÇA
// ============================================================
process.emitWarning = () => {};
process.env.NODE_NO_WARNINGS = '1';

process.on('unhandledRejection', (reason) => {
    const msg = reason?.message || '';
    if (msg.includes('IP discovery')) return;
    if (msg.includes('socket closed')) return;
    if (msg.includes('Invalid Form Body')) return;
    if (msg.includes('Unknown interaction')) return;
    if (msg.includes('Unknown Message')) return;
    if (msg.includes('Missing Permissions')) return;
    if (msg.includes('Cannot send messages')) return;
    console.error('⚠️ Rejeição não tratada:', reason);
});

process.on('uncaughtException', (err) => {
    if (err?.message?.includes('IP discovery') || err?.message?.includes('socket closed')) return;
    console.error('⚠️ Exceção não capturada:', err);
});

// ============================================================
//  BOT DISCORD
// ============================================================
const { Client, GatewayIntentBits, Collection, EmbedBuilder, AuditLogEvent, PermissionsBitField } = require('discord.js');
const { perguntarParaIA, limparHistoricoCanal } = require("./groq.js");

const PREFIX = 'r!';

const OWNER_IDS = ['1507543140800921610']
const OWNER_ID  = OWNER_IDS[0];

function ehDono(userId) {
    return OWNER_IDS.includes(userId);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildModeration
    ]
});

client.commands = new Collection();
const floodMap         = new Map();
const deletarCanaisMap = new Map();
const massBanMap       = new Map();
const massKickMap      = new Map();
const selfbotMap       = new Map();

// ── LOADER DE COMANDOS ──
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);
for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;
    const commandFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        try {
            const command  = require(filePath);
            if ('name' in command && 'execute' in command) {
                command.category = folder.toLowerCase();
                client.commands.set(command.name, command);
            }
        } catch (e) {
            console.error(`[Loader] Erro ao carregar ${file}:`, e.message);
        }
    }
}

const palavrasProibidas = ["macaco", "crioulo", "viadinho", "infame", "verme", "traveco"];

function getConfig(guildId) {
    try {
        const configs = JSON.parse(fs.readFileSync('./database/config.json', 'utf-8'));
        return configs[guildId] || {};
    } catch (e) { return {}; }
}

async function enviarLog(guild, tipoLog, embed) {
    try {
        const sc = getConfig(guild.id);
        const canalId = sc[tipoLog];
        if (!canalId) return;
        const canalLog = guild.channels.cache.get(canalId);
        if (canalLog && canalLog.permissionsFor(guild.members.me).has('SendMessages')) {
            canalLog.send({ embeds: [embed] }).catch(() => {});
        }
    } catch (e) {}
}

function registrarInfracao(guildId, userId, tipo, motivo) {
    try {
        let dados = JSON.parse(fs.readFileSync('./database/punicoes.json', 'utf-8'));
        if (!dados[guildId]) dados[guildId] = {};
        if (!dados[guildId][userId]) dados[guildId][userId] = { warns: 0, mutes: 0, bans: 0, historico: [] };
        dados[guildId][userId][tipo]++;
        dados[guildId][userId].historico.push({
            tipo: tipo.toUpperCase(), motivo, data: new Date().toLocaleDateString('pt-BR')
        });
        fs.writeFileSync('./database/punicoes.json', JSON.stringify(dados, null, 2));

        const sc = getConfig(guildId);
        if (tipo === 'warns' && sc.autoPunicaoWarns) {
            const limite = parseInt(sc.autoPunicaoWarns) || 3;
            if (dados[guildId][userId].warns >= limite) {
                const guild = client.guilds.cache.get(guildId);
                if (guild) {
                    guild.members.ban(userId, { reason: `Reth Morgan: Auto-ban por ${limite} warns.` }).catch(() => {});
                    dados[guildId][userId].warns = 0;
                    fs.writeFileSync('./database/punicoes.json', JSON.stringify(dados, null, 2));
                    const embed = new EmbedBuilder()
                        .setColor('#f53b57').setTitle('🔨 AUTO-BAN: LIMITE DE WARNS ATINGIDO')
                        .setDescription(`<@${userId}> foi banido automaticamente ao atingir ${limite} warns.`)
                        .setTimestamp();
                    enviarLog(guild, 'logs_seguranca', embed);
                }
            }
        }
    } catch (e) {}
}

function isWhitelisted(sc, userId, guild) {
    if (ehDono(userId) || userId === guild.ownerId) return true;
    if (!sc.whitelistIds) return false;
    const ids = sc.whitelistIds.split(',').map(s => s.trim());
    return ids.includes(userId);
}

// ── TIMEOUT CHECKER ──
setInterval(() => {
    try {
        let dados = JSON.parse(fs.readFileSync('./database/punicoes.json', 'utf-8'));
        const agora = Date.now();
        let mudou = false;
        for (const guildId in dados) {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) continue;
            for (const userId in dados[guildId]) {
                const muteData = dados[guildId][userId].muteAtivo;
                if (muteData && agora > muteData.expiresAt) {
                    const member = guild.members.cache.get(userId);
                    if (member) member.timeout(null).catch(() => {});
                    delete dados[guildId][userId].muteAtivo;
                    mudou = true;
                }
            }
        }
        if (mudou) fs.writeFileSync('./database/punicoes.json', JSON.stringify(dados, null, 2));
    } catch (e) {}
}, 10000);

// ── LIMPEZA AGENDADA ──
setInterval(() => {
    try {
        const configs = JSON.parse(fs.readFileSync('./database/config.json', 'utf-8'));
        for (const guildId in configs) {
            const sc = configs[guildId];
            if (!sc.limpezaAgendada || !sc.horasLimpeza || !sc.logChannelId) continue;
            const intervalo = parseInt(sc.horasLimpeza) * 60 * 60 * 1000;
            const ultimaLimpeza = sc._ultimaLimpeza || 0;
            if (Date.now() - ultimaLimpeza < intervalo) continue;
            const guild = client.guilds.cache.get(guildId);
            if (!guild) continue;
            const canal = guild.channels.cache.get(sc.logChannelId);
            if (!canal) continue;
            canal.bulkDelete(100, true).catch(() => {});
            configs[guildId]._ultimaLimpeza = Date.now();
            fs.writeFileSync('./database/config.json', JSON.stringify(configs, null, 2));
        }
    } catch (e) {}
}, 60000);

// ── EVENTO: READY ──
client.once('ready', () => {
    console.clear();
    console.log('==================================================');
    console.log(`🛡️   RETH MORGAN SHIELD SYSTEM V8 ONLINE`);
    console.log(`🔗 Logado como: ${client.user.tag}`);
    console.log(`🤖 IA: Groq (llama-3.3-70b-versatile)`);
    console.log(`🌐 Painel web: http://localhost:${port}`);
    console.log('==================================================');

    const statusList = [
        { name: 'r!painel | Proteger Servidores 🛡️', type: 3 },
        { name: `Segurança Máxima em ${client.guilds.cache.size} servidores! 🏢`, type: 0 },
        { name: 'Protocolo Anti-Nuke Ativo ☢️', type: 2 },
        { name: 'Desenvolvido por nossos donos 👑', type: 0 },
        { name: 'RETH MORGAN: Executando o caos. Codificando a ordem.', type: 2 },
        { name: 'Use r!setup pra me adicionar na sua ordem! 🚀', type: 0 }
    ];
    let idx = 0;
    setInterval(() => {
        const s = statusList[idx];
        client.user.setPresence({ activities: [{ name: s.name, type: s.type }], status: 'dnd' });
        idx = (idx + 1) % statusList.length;
    }, 15000);
});

// ── ANTI-CARGOS ──
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
        const sc = getConfig(newMember.guild.id);
        if (!sc.anticargos) return;
        if (!sc.cargos_protegidos || sc.cargos_protegidos.length === 0) return;

        const cargoAdicionado = newMember.roles.cache.find(
            r => sc.cargos_protegidos.includes(r.id) && !oldMember.roles.cache.has(r.id)
        );
        if (!cargoAdicionado) return;

        let executor = null;
        try {
            const logs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberRoleUpdate });
            const entry = logs.entries.first();
            if (entry && Date.now() - entry.createdTimestamp < 5000) executor = entry.executor;
        } catch {}

        if (isWhitelisted(sc, executor?.id, newMember.guild)) return;
        await newMember.roles.remove(cargoAdicionado, 'Reth Morgan Anti-Cargos').catch(() => {});

        const logEmbed = new EmbedBuilder()
            .setColor('#f39c12').setTitle('🔰 ANTI-CARGOS — TENTATIVA BLOQUEADA')
            .setDescription('Uma tentativa de atribuir um cargo protegido foi interceptada e revertida.')
            .addFields(
                { name: '🎯 Cargo Bloqueado', value: `<@&${cargoAdicionado.id}> (\`${cargoAdicionado.name}\`)`, inline: true },
                { name: '👤 Alvo da Ação',    value: `<@${newMember.id}> (\`${newMember.user.tag}\`)`, inline: true },
                { name: '🕵️ Executor',        value: executor ? `<@${executor.id}> (\`${executor.tag}\`)` : '`Não identificado`', inline: true }
            ).setTimestamp();

        const enviarParaCanal = async (canalId) => {
            if (!canalId) return;
            const canal = newMember.guild.channels.cache.get(canalId);
            if (canal && canal.permissionsFor(newMember.guild.members.me)?.has('SendMessages'))
                await canal.send({ embeds: [logEmbed] }).catch(() => {});
        };
        await enviarParaCanal(sc.logs_anticargos);
        if (sc.logs_anticargos !== sc.logs_seguranca) await enviarParaCanal(sc.logs_seguranca);
    } catch (e) { console.error('[anti-cargos]', e.message); }
});

// ── ANTI-REMOÇÃO DE CASTIGO ──
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
        const tihaTimeout = !!oldMember.communicationDisabledUntil && oldMember.communicationDisabledUntil > new Date();
        const temAgora    = !!newMember.communicationDisabledUntil && newMember.communicationDisabledUntil > new Date();
        if (!tihaTimeout || temAgora) return;

        let dados = {};
        try { dados = JSON.parse(require('fs').readFileSync('./database/punicoes.json', 'utf-8')); } catch { return; }

        const muteAtivo = dados[newMember.guild.id]?.[newMember.id]?.muteAtivo;
        if (!muteAtivo) return;

        const tempoRestante = muteAtivo.expiresAt - Date.now();
        if (tempoRestante <= 0) return;

        await newMember.timeout(tempoRestante, 'Reth Morgan: Remoção não autorizada de castigo — reaplicado').catch(() => {});

        let removedor = null;
        try {
            const logs  = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate });
            const entry = logs.entries.first();
            if (entry && Date.now() - entry.createdTimestamp < 5000) removedor = entry.executor;
        } catch {}

        const logEmbed = new EmbedBuilder()
            .setColor('#8B0000')
            .setAuthor({ name: 'ANTI-REMOÇÃO DE CASTIGO', iconURL: newMember.guild.members.me.displayAvatarURL() })
            .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTitle('🔒 CASTIGO REAPLICADO — REMOÇÃO BLOQUEADA')
            .setDescription('Uma tentativa de remoção não autorizada de castigo foi interceptada.')
            .addFields(
                { name: '👤 PUNIDO',        value: `<@${newMember.id}> · \`${newMember.id}\``, inline: true },
                { name: '🕵️ REMOVEDOR',     value: removedor ? `<@${removedor.id}>` : '`Não identificado`', inline: true },
                { name: '🔫 APLICADO POR',  value: `<@${muteAtivo.executorId}>`, inline: true },
                { name: '⏱️ TEMPO RESTANTE', value: (() => {
                    const d = Math.floor(tempoRestante / 86400000);
                    const h = Math.floor((tempoRestante % 86400000) / 3600000);
                    const m = Math.floor((tempoRestante % 3600000) / 60000);
                    const s = Math.floor((tempoRestante % 60000) / 1000);
                    return [d&&`${d}d`,h&&`${h}h`,m&&`${m}m`,s&&`${s}s`].filter(Boolean).join(' ') || '0s';
                })(), inline: true },
                { name: '📋 MOTIVO ORIGINAL', value: muteAtivo.motivo || 'Não informado.', inline: false }
            )
            .setFooter({ text: `Guild ID: ${newMember.guild.id}` })
            .setTimestamp();

        await enviarLog(newMember.guild, 'logs_castigo', logEmbed);

        if (removedor) {
            try {
                await removedor.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#8B0000')
                        .setTitle('🔒 AÇÃO BLOQUEADA — RETH MORGAN')
                        .setDescription(`Você tentou remover o castigo de <@${newMember.id}> sem autorização.\nApenas quem aplicou o castigo (<@${muteAtivo.executorId}>) pode removê-lo.\nO castigo foi reaplicado automaticamente.`)
                        .setTimestamp()
                    ]
                });
            } catch {}
        }
    } catch (e) {
        console.error('[anti-remoção-castigo]', e.message);
    }
});

// ── ANTI-MASS BAN ──
client.on('guildBanAdd', async (ban) => {
    try {
        const sc = getConfig(ban.guild.id);
        if (!sc.antiMassBan) return;
        const limite = parseInt(sc.maxBans) || 5;

        const logs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
        const entry = logs.entries.first();
        if (!entry) return;
        const executor = entry.executor;

        // ✅ FIX: ignora ações do próprio bot (r!ban, IA ban, etc)
        if (executor.id === client.user.id) return;

        if (isWhitelisted(sc, executor.id, ban.guild)) return;

        const agora = Date.now();
        if (!massBanMap.has(executor.id)) massBanMap.set(executor.id, []);
        const ts = massBanMap.get(executor.id).filter(t => agora - t < 60000);
        ts.push(agora);
        massBanMap.set(executor.id, ts);

        if (ts.length >= limite) {
            const member = await ban.guild.members.fetch(executor.id).catch(() => {});
            if (member) {
                const cargosRem = member.roles.cache.filter(r => r.id !== ban.guild.id && !r.managed);
                await member.roles.remove(cargosRem).catch(() => {});
                await member.timeout(1000 * 60 * 60, 'Reth Morgan: Anti-Mass Ban').catch(() => {});
            }
            const embed = new EmbedBuilder()
                .setColor('#f53b57').setTitle('🚨 ANTI-MASS BAN ACIONADO')
                .setDescription(`<@${executor.id}> efetuou ${ts.length} bans em 1 minuto. Privilégios suspensos.`)
                .setTimestamp();
            enviarLog(ban.guild, 'logs_seguranca', embed);
            massBanMap.set(executor.id, []);
        }
    } catch (e) {}
});

// ── ANTI-MASS KICK ──
client.on('guildMemberRemove', async (member) => {
    const guild = member.guild;
    const sc = getConfig(guild.id);

    if (sc.logs_join) {
        const leaveEmbed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setAuthor({ name: `${member.user.tag} saiu`, iconURL: member.user.displayAvatarURL() })
            .setDescription(`🚪 O usuário deixou o servidor.\nID: \`${member.id}\``)
            .setTimestamp();
        enviarLog(guild, 'logs_join', leaveEmbed);
    }

    if (!sc.antiMassKick) return;
    try {
        const limite = parseInt(sc.maxKicks) || 5;
        const logs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick });
        const entry = logs.entries.first();
        if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
        const executor = entry.executor;

        // ✅ FIX: ignora ações do próprio bot (r!kick, antifake, etc)
        if (executor.id === client.user.id) return;

        if (isWhitelisted(sc, executor.id, guild)) return;

        const agora = Date.now();
        if (!massKickMap.has(executor.id)) massKickMap.set(executor.id, []);
        const ts = massKickMap.get(executor.id).filter(t => agora - t < 60000);
        ts.push(agora);
        massKickMap.set(executor.id, ts);

        if (ts.length >= limite) {
            const exec = await guild.members.fetch(executor.id).catch(() => {});
            if (exec) {
                const cargosRem = exec.roles.cache.filter(r => r.id !== guild.id && !r.managed);
                await exec.roles.remove(cargosRem).catch(() => {});
                await exec.timeout(1000 * 60 * 60, 'Reth Morgan: Anti-Mass Kick').catch(() => {});
            }
            const embed = new EmbedBuilder()
                .setColor('#f53b57').setTitle('🚨 ANTI-MASS KICK ACIONADO')
                .setDescription(`<@${executor.id}> efetuou ${ts.length} kicks em 1 minuto. Privilégios suspensos.`)
                .setTimestamp();
            enviarLog(guild, 'logs_seguranca', embed);
            massKickMap.set(executor.id, []);
        }
    } catch (e) {}
});

// ── ENTRADA DE MEMBROS ──
client.on('guildMemberAdd', async (member) => {
    const guild = member.guild;
    const sc = getConfig(guild.id);

    if (sc.autorole) {
        const cargoAlvo = guild.roles.cache.get(sc.autorole);
        if (cargoAlvo) await member.roles.add(cargoAlvo).catch(() => {});
    }

    if (sc.msg_join) {
        const canalPublico = guild.channels.cache.get(sc.msg_join);
        if (canalPublico) canalPublico.send(`👋 Bem-vindo(a) <@${member.id}> ao servidor **${guild.name}**! Aproveite o chat!`).catch(() => {});
    }

    if (sc.logs_join) {
        const joinEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setAuthor({ name: `${member.user.tag} entrou`, iconURL: member.user.displayAvatarURL() })
            .setDescription(`• Conta criada em: <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n• ID: \`${member.id}\``)
            .setTimestamp();
        enviarLog(guild, 'logs_join', joinEmbed);
    }

    if (member.user.bot && (sc.antibot || sc.bloqueioBots)) {
        try {
            await new Promise(r => setTimeout(r, 1000));
            const logsAuditoria = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.BotAdd });
            const logAdicao = logsAuditoria.entries.first();
            if (logAdicao) {
                const executor = logAdicao.executor;
                if (isWhitelisted(sc, executor.id, guild)) return;
                await member.ban({ reason: 'Reth Morgan: Entrada de bot não autorizada.' }).catch(() => {});
                const staffer = await guild.members.fetch(executor.id).catch(() => {});
                if (staffer) {
                    await staffer.ban({ reason: 'Reth Morgan Anti-Raid: Injeção ilícita de bot.' }).catch(() => {
                        const cargosRemoviveis = staffer.roles.cache.filter(r => r.id !== guild.id && !r.managed);
                        staffer.roles.remove(cargosRemoviveis).catch(() => {});
                    });
                }
                const logBotEmbed = new EmbedBuilder()
                    .setColor('#f53b57').setTitle('🚨 ALERTA: ATAQUE DE BOT REPELIDO')
                    .setDescription(`<@${executor.id}> tentou injetar um bot no servidor.`)
                    .addFields(
                        { name: '🤖 Bot Invasor', value: `\`${member.user.tag}\` (${member.id})`, inline: true },
                        { name: '🔨 Punição',     value: '`Banido / Permissões Cassadas`', inline: true }
                    ).setTimestamp();
                enviarLog(guild, 'logs_seguranca', logBotEmbed);
            }
        } catch (e) {}
        return;
    }

    if (sc.antifake && !member.user.bot) {
        const contaCriadaHa = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
        const limiteDias = parseInt(sc.diasFake) || 7;
        if (contaCriadaHa < limiteDias) {
            const msg = sc.customPunishMsg || `Reth Morgan: Conta menor que ${limiteDias} dias.`;
            await member.kick(msg).catch(() => {});
            const logFakeEmbed = new EmbedBuilder()
                .setColor('#f53b57').setTitle('🚨 SEGURANÇA: CONTA FAKE EXPULSADA')
                .setDescription(`**${member.user.tag}** removido por não atingir a idade mínima.`)
                .addFields(
                    { name: '⏳ Idade da Conta', value: `\`${Math.floor(contaCriadaHa)} dias\``, inline: true },
                    { name: '🔒 Mínimo Exigido',  value: `\`${limiteDias} dias\``, inline: true }
                ).setTimestamp();
            enviarLog(guild, 'logs_seguranca', logFakeEmbed);
        }
    }

    if (sc.autoModNomes && !member.user.bot) {
        const nick = member.displayName;
        const temInvisivel = /[\u200b\u200c\u200d\u0000-\u001f\u007f-\u009f]/.test(nick);
        const temAbusivo   = /^[^a-zA-Z0-9À-ÿ\s]{5,}/.test(nick);
        if (temInvisivel || temAbusivo) {
            await member.setNickname('Usuário', 'Reth Morgan: Nick inválido').catch(() => {});
        }
    }
});

// ── ANTI-NUKE: EXCLUSÃO DE CANAIS ──
client.on('channelDelete', async (channel) => {
    const guild = channel.guild;
    const sc = getConfig(guild.id);
    if (!sc.antinuke) return;
    try {
        const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete });
        const entry = auditLogs.entries.first();
        if (!entry) return;
        const executor = entry.executor;
        if (isWhitelisted(sc, executor.id, guild) || executor.id === client.user.id) return;

        const agora = Date.now();
        if (!deletarCanaisMap.has(executor.id)) deletarCanaisMap.set(executor.id, []);
        const timestamps = deletarCanaisMap.get(executor.id).filter(t => agora - t < 10000);
        timestamps.push(agora);
        deletarCanaisMap.set(executor.id, timestamps);

        if (timestamps.length >= 3) {
            const member = await guild.members.fetch(executor.id).catch(() => {});
            if (member) {
                const cargosRemoviveis = member.roles.cache.filter(r => r.id !== guild.id && !r.managed);
                await member.roles.remove(cargosRemoviveis).catch(() => {});
                await member.timeout(1000 * 60 * 60 * 24, 'Reth Morgan: Anti-Nuke').catch(() => {});
            }
            const embedAlerta = new EmbedBuilder()
                .setColor('#f53b57').setTitle('🚨 ANTI-NUKE ACIONADO: PROTEÇÃO DE CANAIS')
                .setDescription(`<@${executor.id}> tentou deletar múltiplos canais. Privilégios cassados.`)
                .setTimestamp();
            enviarLog(guild, 'logs_seguranca', embedAlerta);
        }
    } catch (e) {}
});

// ── EVENTO CENTRAL: MENSAGENS ──
client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot || message.webhookId) return;
    if (message.author.id === client.user?.id) return;

    let data = { canaisComandos: [] };
    try {
        if (fs.existsSync('./database/canais.json')) {
            const parsed = JSON.parse(fs.readFileSync('./database/canais.json', 'utf8'));
            if (parsed) data = parsed;
        }
    } catch (e) {}
    if (!data.canaisComandos) data.canaisComandos = [];

    const sc             = getConfig(message.guild.id);
    const canalPermitido = data.canaisComandos.length === 0 || data.canaisComandos.includes(message.channel.id);
    const temPermissao   = message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages);
    const isDono         = ehDono(message.author.id);

    // ── ANTI-FLOOD ──
    if (sc.antiflood && !temPermissao) {
        const limite = parseInt(sc.limiteFlood) || 5;
        const agora  = Date.now();
        const userId = message.author.id;
        if (!floodMap.has(userId)) floodMap.set(userId, []);
        const msgs = floodMap.get(userId).filter(t => agora - t < 4000);
        msgs.push(agora);
        floodMap.set(userId, msgs);
        if (msgs.length >= limite) {
            await message.delete().catch(() => {});
            const aviso = await message.channel.send(`⚠️ <@${message.author.id}>, você está enviando mensagens muito rápido!`).catch(() => {});
            if (aviso) setTimeout(() => aviso.delete().catch(() => {}), 5000);
            return;
        }
    }

    // ── ANTI-LINK ──
    if (sc.antilink && !temPermissao) {
        const temLink = /https?:\/\/[^\s]+/.test(message.content);
        if (temLink) {
            const dominiosBanidos = sc.filtroLinks
                ? sc.filtroLinks.split(',').map(d => d.trim()).filter(Boolean)
                : [];
            const deveBloquear = dominiosBanidos.length === 0
                ? true
                : dominiosBanidos.some(d => message.content.includes(d));
            if (deveBloquear) {
                await message.delete().catch(() => {});
                const msg = sc.customPunishMsg || `🔗 <@${message.author.id}>, links não são permitidos!`;
                const aviso = await message.channel.send(msg).catch(() => {});
                if (aviso) setTimeout(() => aviso.delete().catch(() => {}), 5000);
                return;
            }
        }
    }

    // ── ANTI-INVITE ──
    if (sc.antiinvite && !temPermissao) {
        if (/(discord\.gg|discord\.com\/invite)\/[^\s]+/i.test(message.content)) {
            await message.delete().catch(() => {});
            const msg = sc.customPunishMsg || `📩 <@${message.author.id}>, convites não são permitidos!`;
            const aviso = await message.channel.send(msg).catch(() => {});
            if (aviso) setTimeout(() => aviso.delete().catch(() => {}), 5000);
            return;
        }
    }

    // ── ANTI-CAPS ──
    if ((sc.anticaps || sc.antiCapsLock) && message.content.length > 10 && !temPermissao) {
        const maiusculas = message.content.replace(/[^A-Z]/g, '').length;
        const total      = message.content.replace(/[^a-zA-Z]/g, '').length;
        if (total > 0 && (maiusculas / total) > 0.7) {
            await message.delete().catch(() => {});
            const aviso = await message.channel.send(`🔠 <@${message.author.id}>, evite CAPS LOCK em excesso!`).catch(() => {});
            if (aviso) setTimeout(() => aviso.delete().catch(() => {}), 5000);
            return;
        }
    }

    // ── ANTI-PRECONCEITO ──
    if (sc.antipreconceito && !temPermissao) {
        if (palavrasProibidas.some(p => message.content.toLowerCase().includes(p))) {
            await message.delete().catch(() => {});
            const msg = sc.customPunishMsg || `⚠️ <@${message.author.id}>, mantenha o chat limpo!`;
            const aviso = await message.channel.send(msg).catch(() => {});
            if (aviso) setTimeout(() => aviso.delete().catch(() => {}), 5000);
            registrarInfracao(message.guild.id, message.author.id, 'warns', 'Discurso de ódio');
            return;
        }
    }

    // ── ANTI-SPOILER ──
    if (sc.antiSpoiler && !temPermissao) {
        const spoilers = message.content.match(/\|\|[^|]+\|\|/g) || [];
        if (spoilers.length > 3) {
            await message.delete().catch(() => {});
            const aviso = await message.channel.send(`🙈 <@${message.author.id}>, uso excessivo de spoilers!`).catch(() => {});
            if (aviso) setTimeout(() => aviso.delete().catch(() => {}), 5000);
            return;
        }
    }

    // ── FILTRO DE EMOJIS ──
    if (sc.filtroEmojis && !temPermissao) {
        const maxEmojis  = parseInt(sc.maxEmojis) || 10;
        const emojiCount = (message.content.match(/<a?:\w+:\d+>|[\u{1F300}-\u{1FAFF}]/gu) || []).length;
        if (emojiCount > maxEmojis) {
            await message.delete().catch(() => {});
            const aviso = await message.channel.send(`😅 <@${message.author.id}>, muitos emojis! Máximo: ${maxEmojis}`).catch(() => {});
            if (aviso) setTimeout(() => aviso.delete().catch(() => {}), 5000);
            return;
        }
    }

    // ── LIMITE DE MENÇÕES ──
    if (sc.limiteMencoes && !temPermissao) {
        const limite  = parseInt(sc.maxMencoes || sc.limiteMencoes) || 5;
        const mencoes = message.mentions.users.size + message.mentions.roles.size;
        if (mencoes > limite) {
            await message.delete().catch(() => {});
            const aviso = await message.channel.send(`🔇 <@${message.author.id}>, muitas menções! Máximo: ${limite}`).catch(() => {});
            if (aviso) setTimeout(() => aviso.delete().catch(() => {}), 5000);
            registrarInfracao(message.guild.id, message.author.id, 'warns', 'Menções em massa');
            return;
        }
    }

    // ── AUTO-MOD DE NOMES ──
    if (sc.autoModNomes && message.member && !message.member.user.bot) {
        const nick = message.member.displayName;
        const temInvisivel = /[\u200b\u200c\u200d\u0000-\u001f]/.test(nick);
        if (temInvisivel) {
            await message.member.setNickname('Usuário', 'Reth Morgan: Nick com caracteres inválidos').catch(() => {});
        }
    }

    // ── DETECTOR DE SELFBOTS ──
    if (sc.detectorSelfbots && !temPermissao) {
        const userId = message.author.id;
        const agora  = Date.now();
        if (!selfbotMap.has(userId)) selfbotMap.set(userId, { msgs: [], identical: 0, lastMsg: '' });
        const dados = selfbotMap.get(userId);
        dados.msgs = dados.msgs.filter(t => agora - t < 5000);
        dados.msgs.push(agora);
        if (message.content === dados.lastMsg) dados.identical++;
        else { dados.identical = 0; dados.lastMsg = message.content; }

        if (dados.msgs.length >= 10 || dados.identical >= 5) {
            await message.member.timeout(1000 * 60 * 30, 'Reth Morgan: Comportamento suspeito de selfbot').catch(() => {});
            selfbotMap.delete(userId);
            const embed = new EmbedBuilder()
                .setColor('#f39c12').setTitle('🤖 DETECTOR DE SELFBOT ACIONADO')
                .setDescription(`<@${userId}> apresentou padrão suspeito e foi silenciado por 30 min.`)
                .setTimestamp();
            enviarLog(message.guild, 'logs_seguranca', embed);
            return;
        }
    }

    // ── COMANDOS ──
    if (canalPermitido && message.content.startsWith(PREFIX)) {
        const args        = message.content.slice(PREFIX.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        const command     = client.commands.get(commandName)
            || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
        if (command) {
            try { await command.execute(message, args, client, OWNER_ID); }
            catch (error) {
                console.error(error);
                message.reply('❌ Ocorreu um erro ao executar esse comando!');
            }
            return;
        }
    }

    // ── IA: RETH MORGAN ──
    const morganAtiva = sc.morgan_ativo === true;
    const canalMorgan = sc.morgan_canal || null;

    if (!morganAtiva && !isDono) return;

    const contemMorgan    = message.content.toLowerCase().includes('morgan');
    const comecaComMorgan = message.content.toLowerCase().trim().startsWith('morgan');
    const marcouOBot      = message.mentions.has(client.user);
    const noCanaldaMorgan = canalMorgan && message.channel.id === canalMorgan;

    const deveAtivarIA = marcouOBot || comecaComMorgan || noCanaldaMorgan || (isDono && contemMorgan);
    if (!deveAtivarIA) return;

    try {
        let perguntaLimpa = message.content;
        if (marcouOBot) perguntaLimpa = perguntaLimpa.split('<@' + client.user.id + '>').join('');
        const textoMinusculo = perguntaLimpa.toLowerCase();
        const posicaoMorgan  = textoMinusculo.indexOf('morgan');
        if (posicaoMorgan !== -1) perguntaLimpa = perguntaLimpa.slice(0, posicaoMorgan) + perguntaLimpa.slice(posicaoMorgan + 6);
        perguntaLimpa = perguntaLimpa.trim();
        if (perguntaLimpa.startsWith(',')) perguntaLimpa = perguntaLimpa.slice(1).trim();

        if (!perguntaLimpa) return message.reply(`Olá, ${message.author.username}! Sou o Reth Morgan. Como posso ajudar? ⚙️`);

        await message.channel.sendTyping();

        const diretrizesIA = `Você é a Reth Morgan, assistente de segurança e desenvolvimento do Discord.
Personalidade: direta, rápida, sem enrolação, sem palavras difíceis.

STATUS DO OPERADOR: ${isDono ? "DONO DO BOT — ACESSO TOTAL LIBERADO." : "USUÁRIO COMUM — SEM ACESSO A AÇÕES."}

${isDono ? `VOCÊ DEVE EXECUTAR AS ORDENS DO DONO. Para ações específicas, responda SOMENTE com o formato abaixo, sem texto extra, sem markdown, sem crases:

BAN: { "acao": "ban", "motivo": "motivo deduzido", "resposta_chat": "Feito." }
LIMPAR CHAT: { "acao": "clear", "quantidade": 100, "resposta_chat": "Feito." }
ADICIONAR CARGO: { "acao": "addRole", "cargo": "nome ou id", "resposta_chat": "Feito." }
REMOVER CARGO: { "acao": "removeRole", "cargo": "nome ou id", "resposta_chat": "Feito." }
REMOVER TODOS OS CARGOS: { "acao": "removeAllRoles", "resposta_chat": "Feito." }
CRIAR COMANDO:
[CRIAR_COMANDO]
<nome_arquivo>nome.js</nome_arquivo>
<categoria_pasta>utilitarios</categoria_pasta>
<resposta_chat>Pronto.</resposta_chat>
<codigo_js>
module.exports = { name: 'nome', execute(message, args, client) { } };
</codigo_js>

REGRAS DE AÇÃO:
- O alvo é sempre quem foi mencionado com @.
- Frases como "tire todos os cargos", "cassa os cargos" → removeAllRoles.
- Frases como "dá o cargo X", "adiciona X" → addRole.
- Frases como "tira o cargo X" → removeRole.
- Use JSON/[CRIAR_COMANDO] SOMENTE quando o dono pedir explicitamente uma ação.
- Para perguntas normais, mesmo do dono, responda em texto simples e direto.

══════════════════════════════════════════
REGRAS OBRIGATÓRIAS PARA CRIAÇÃO DE COMANDOS (Discord.js v14):
══════════════════════════════════════════

IMPORTS: NUNCA use "new Discord.MessageEmbed()" nem "require('discord.js')" dentro do comando.
Use SEMPRE: const { EmbedBuilder, PermissionsBitField } = require('discord.js');

EMBEDS: NUNCA use .setDescription().addField(). Use SEMPRE EmbedBuilder com .addFields([]):
  const embed = new EmbedBuilder()
    .setColor('#hex')
    .setTitle('Título')
    .setDescription('Descrição')
    .addFields({ name: 'Campo', value: 'Valor', inline: true })
    .setTimestamp();
  message.channel.send({ embeds: [embed] });

PERMISSÕES: NUNCA use hasPermission() nem 'ADMINISTRATOR' como string.
Use SEMPRE: message.member.permissions.has(PermissionsBitField.Flags.BanMembers)
Flags comuns: BanMembers, KickMembers, ManageMessages, ManageRoles, Administrator

BANS: NUNCA use guild.fetchBans(). Use SEMPRE: guild.bans.fetch()

REAÇÕES: NUNCA use createReactionCollector(filter, { time }) — isso é v12.
Use SEMPRE: msg.createReactionCollector({ filter, time: 15000 })

COLETOR DE MENSAGENS: NUNCA use channel.createMessageCollector(filter, { time }).
Use SEMPRE: channel.createMessageCollector({ filter, time: 15000, max: 1 })

TIMEOUT/MUTE: NUNCA use member.timeout(ms). Use SEMPRE member.timeout(ms, 'motivo') com ms em milissegundos.

MENSAGENS: NUNCA use message.channel.send("texto puro") para enviar apenas texto simples junto com embeds.
Use SEMPRE: message.channel.send({ content: 'texto' }) ou message.channel.send({ embeds: [embed] })

RATE LIMIT: Em loops de ban/unban/kick em massa, SEMPRE adicione delay:
  await new Promise(r => setTimeout(r, 300));

EXECUTE: SEMPRE use async: execute: async (message, args, client) => { }

VERIFICAÇÃO DE PERMISSÃO DO BOT: Sempre verifique se o bot tem permissão antes de executar ações:
  if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers))
    return message.reply('❌ Não tenho permissão para isso.');

ESTRUTURA MÍNIMA CORRETA:
const { EmbedBuilder, PermissionsBitField } = require('discord.js');
module.exports = {
  name: 'nomecomando',
  execute: async (message, args, client) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
      return message.reply('❌ Sem permissão.');
    // lógica aqui
  }
};

SEGURANÇA OBRIGATÓRIA EM COMANDOS:
- SEMPRE valide args antes de usar: if (!args[0]) return message.reply('❌ Uso: r!comando <argumento>');
- Em comandos destrutivos (ban, kick, timeout, deletar, remover cargos em massa), OBRIGATORIAMENTE peça confirmação por texto antes de executar:
  message.channel.send('Digite **confirmar** em 15 segundos para prosseguir.');
  const filter = m => m.author.id === message.author.id && m.content.toLowerCase() === 'confirmar';
  const collector = message.channel.createMessageCollector({ filter, time: 15000, max: 1 });
- NUNCA afete bots, donos (IDs: ${OWNER_IDS.join(', ')}) ou membros com cargo acima do bot na hierarquia.
- NUNCA use forEach com await — use sempre for...of com await para loops assíncronos.
- Em loops de ações em massa, SEMPRE use delay: await new Promise(r => setTimeout(r, 300));
- SEMPRE capture erros e responda com message.reply('❌ Erro: ' + e.message) — nunca deixe erros silenciosos.
- Todo comando usado sem argumentos obrigatórios DEVE mostrar exemplo de uso.` : `- Responda curto e direto. Não execute nenhuma ação.`}`;

        const respostaIA = await perguntarParaIA(perguntaLimpa, diretrizesIA, message.channel.id);
        let textoResposta = respostaIA.trim();

        // ── LIMPEZA DE MARKDOWN ──
const crasesMarkdown = '\`\`\`';
if (textoResposta.startsWith(crasesMarkdown)) {
    textoResposta = textoResposta.slice(3).trim();
    if (textoResposta.toLowerCase().startsWith('json')) textoResposta = textoResposta.slice(4).trim();
    if (textoResposta.endsWith(crasesMarkdown)) textoResposta = textoResposta.slice(0, -3).trim();
}

// ── EXTRAÇÃO DE JSON (mesmo que venha com texto antes) ──
const jsonMatch = textoResposta.match(/\{[\s\S]*"acao"[\s\S]*\}/);
if (jsonMatch) textoResposta = jsonMatch[0];

        // ── EXECUÇÃO DE ORDENS JSON ──
        if (textoResposta.startsWith('{') && textoResposta.includes('"acao"')) {
            try {
                const ordem = JSON.parse(textoResposta);

                if (ordem.acao === 'ban' && isDono) {
                    const membroAlvo = message.mentions.members.first();
                    if (!membroAlvo) return message.reply("⚠️ Marque quem quer banir.");
                    if (ehDono(membroAlvo.id)) return message.reply("⚠️ Não posso banir um dos donos.");
                    await membroAlvo.ban({ reason: `Morgan: ${ordem.motivo || 'Ordem do dono'}` });
                    registrarInfracao(message.guild.id, membroAlvo.id, 'bans', `Morgan: ${ordem.motivo || 'Ordem do dono'}`);
                    return message.reply(`🔨 ${ordem.resposta_chat}`);
                }

                if (ordem.acao === 'clear' && isDono) {
                    let qtd = parseInt(ordem.quantidade) || 100;
                    if (qtd < 1) qtd = 1;
                    if (qtd > 100) qtd = 100;
                    await message.delete().catch(() => {});
                    const deletadas = await message.channel.bulkDelete(qtd, true).catch(() => null);
                    if (!deletadas) return message.channel.send("⚠️ Mensagens com mais de 14 dias não podem ser limpas em massa.");
                    const conf = await message.channel.send(`🧹 ${ordem.resposta_chat} (\`${deletadas.size}\` mensagens)`);
                    setTimeout(() => conf.delete().catch(() => {}), 5000);
                    limparHistoricoCanal(message.channel.id);
                    return;
                }

                if (ordem.acao === 'addRole' && isDono) {
                    const membroAlvo = message.mentions.members.first();
                    if (!membroAlvo) return message.reply("⚠️ Marque o usuário alvo.");
                    let cargoAlvo = message.guild.roles.cache.get(ordem.cargo)
                        || message.guild.roles.cache.find(r => r.name.toLowerCase() === (ordem.cargo || '').toLowerCase());
                    if (!cargoAlvo && ordem.cargo) {
                        const matchId = ordem.cargo.match(/\d{17,20}/);
                        if (matchId) cargoAlvo = message.guild.roles.cache.get(matchId[0]);
                    }
                    if (!cargoAlvo && message.mentions.roles.size > 0) cargoAlvo = message.mentions.roles.first();
                    if (!cargoAlvo) return message.reply("⚠️ Cargo não encontrado.");
                    try {
                        await membroAlvo.roles.add(cargoAlvo, 'Morgan: Ordem do dono');
                        const logEmbed = new EmbedBuilder()
                            .setColor('#2ecc71').setTitle('🔰 CARGO ADICIONADO PELA IA')
                            .addFields(
                                { name: '👤 Usuário', value: `<@${membroAlvo.id}>`, inline: true },
                                { name: '🎭 Cargo',   value: `<@&${cargoAlvo.id}>`, inline: true }
                            ).setTimestamp();
                        enviarLog(message.guild, 'logs_seguranca', logEmbed);
                        return message.reply(`🔰 ${ordem.resposta_chat}`);
                    } catch (e) {
                        return message.reply("❌ Sem permissão ou cargo acima do bot na hierarquia.");
                    }
                }

                if (ordem.acao === 'removeRole' && isDono) {
                    const membroAlvo = message.mentions.members.first();
                    if (!membroAlvo) return message.reply("⚠️ Marque o usuário alvo.");
                    let cargoAlvo = message.guild.roles.cache.get(ordem.cargo)
                        || message.guild.roles.cache.find(r => r.name.toLowerCase() === (ordem.cargo || '').toLowerCase());
                    if (!cargoAlvo && ordem.cargo) {
                        const matchId = ordem.cargo.match(/\d{17,20}/);
                        if (matchId) cargoAlvo = message.guild.roles.cache.get(matchId[0]);
                    }
                    if (!cargoAlvo && message.mentions.roles.size > 0) cargoAlvo = message.mentions.roles.first();
                    if (!cargoAlvo) return message.reply("⚠️ Cargo não encontrado.");
                    try {
                        await membroAlvo.roles.remove(cargoAlvo, 'Morgan: Ordem do dono');
                        const logEmbed = new EmbedBuilder()
                            .setColor('#e74c3c').setTitle('🔰 CARGO REMOVIDO PELA IA')
                            .addFields(
                                { name: '👤 Usuário', value: `<@${membroAlvo.id}>`, inline: true },
                                { name: '🎭 Cargo',   value: `<@&${cargoAlvo.id}>`, inline: true }
                            ).setTimestamp();
                        enviarLog(message.guild, 'logs_seguranca', logEmbed);
                        return message.reply(`🔰 ${ordem.resposta_chat}`);
                    } catch (e) {
                        return message.reply("❌ Sem permissão ou cargo acima do bot na hierarquia.");
                    }
                }

                if (ordem.acao === 'removeAllRoles' && isDono) {
                    const membroAlvo = message.mentions.members.first();
                    if (!membroAlvo) return message.reply("⚠️ Marque o usuário alvo.");
                    if (ehDono(membroAlvo.id)) return message.reply("⚠️ Não posso remover cargos de um dos donos.");
                    try {
                        const cargosRemoviveis = membroAlvo.roles.cache.filter(r => r.id !== message.guild.id && !r.managed);
                        if (cargosRemoviveis.size === 0) return message.reply("⚠️ Esse usuário não tem cargos removíveis.");
                        await membroAlvo.roles.remove(cargosRemoviveis, 'Morgan: Ordem do dono');
                        const logEmbed = new EmbedBuilder()
                            .setColor('#e74c3c').setTitle('🔰 TODOS OS CARGOS REMOVIDOS PELA IA')
                            .addFields(
                                { name: '👤 Usuário',          value: `<@${membroAlvo.id}>`, inline: true },
                                { name: '🎭 Cargos removidos', value: `\`${cargosRemoviveis.size}\``, inline: true }
                            ).setTimestamp();
                        enviarLog(message.guild, 'logs_seguranca', logEmbed);
                        return message.reply(`🔰 ${ordem.resposta_chat}`);
                    } catch (e) {
                        return message.reply("❌ Sem permissão ou hierarquia insuficiente.");
                    }
                }

            } catch (e) { console.error("Erro ao decodificar ordem JSON:", e); }
        }

        // ── CRIAR COMANDO ──
        if ((textoResposta.includes('[CRIAR_COMANDO]') || textoResposta.includes('CRIAR_COMANDO')) && isDono) {
            try {
                const extrairTag = (tag, texto) => {
                    const ini = texto.indexOf('<' + tag + '>');
                    const fim = texto.indexOf('</' + tag + '>');
                    if (ini === -1 || fim === -1) return null;
                    return texto.slice(ini + tag.length + 2, fim).trim();
                };
                const nomeArquivo  = extrairTag('nome_arquivo', textoResposta);
                const categoria    = (extrairTag('categoria_pasta', textoResposta) || 'utilitarios').toLowerCase();
                const respostaChat = extrairTag('resposta_chat', textoResposta) || 'Pronto.';
                const codigoJs     = extrairTag('codigo_js', textoResposta);

                if (nomeArquivo && codigoJs) {
                    const nomeFinal      = nomeArquivo.endsWith('.js') ? nomeArquivo : `${nomeArquivo}.js`;
                    const pastaDestino   = path.join(__dirname, 'commands', categoria);
                    if (!fs.existsSync(pastaDestino)) fs.mkdirSync(pastaDestino, { recursive: true });
                    const caminhoArquivo = path.join(pastaDestino, nomeFinal);
                    fs.writeFileSync(caminhoArquivo, codigoJs, 'utf-8');
                    delete require.cache[require.resolve(caminhoArquivo)];
                    const novoComando = require(caminhoArquivo);
                    novoComando.category = categoria;
                    client.commands.set(novoComando.name, novoComando);

                    try {
                        const chunks = [];
                        let cod = codigoJs;
                        while (cod.length > 0) {
                            chunks.push(cod.slice(0, 1800));
                            cod = cod.slice(1800);
                        }
                        await message.author.send(`📦 **Comando compilado:** \`commands/${categoria}/${nomeFinal}\`\nConferência do código:`);
                        for (const chunk of chunks) {
                            await message.author.send(`\`\`\`js\n${chunk}\n\`\`\``);
                        }
                    } catch (e) {
                        console.error('[Compilador] Não consegui enviar DM ao dono:', e.message);
                    }

                    return message.reply(`📩 **[Compilador]** ${respostaChat}\n\`commands/${categoria}/${nomeFinal}\`\nCódigo enviado no seu privado para conferência! ✅`);
                } else {
                    return message.reply("❌ Compilador: estrutura de tags incompleta. Verifique `<nome_arquivo>` e `<codigo_js>`.");
                }
            } catch (e) {
                console.error("Erro no compilador:", e);
                return message.reply("❌ Erro ao compilar o comando.");
            }
        }

        return message.reply(textoResposta);
    } catch (err) {
        console.error("Erro no processamento da IA:", err);
    }
});

client.login(process.env.TOKEN);
