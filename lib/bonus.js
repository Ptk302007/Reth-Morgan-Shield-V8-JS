'use strict';
/**
 * lib/bonus.js — Sistema central de bônus e inventário
 *
 * Todos os comandos importam daqui. Nunca leia/escreva bônus ativos
 * diretamente no xp.json fora desse arquivo.
 *
 * Estrutura salva em xp.json por usuário:
 * {
 *   xp, nivel, coins, banco,
 *   inventario: { escudo: 2, xp2x_1h: 1, ... },   // estoque de itens
 *   bonus_ativos: {                                  // itens em uso com expiração
 *     xp_mult:    { mult: 2, expira: 1700000000000 },
 *     escudo:     { expira: null },   // null = uso único (consome ao ser ativado)
 *     invisivel:  { expira: 1700000000000 },
 *     armadura:   { expira: 1700000000000 },
 *     sorte:      { mult: 1.5, expira: 1700000000000 },
 *     apostas:    { mult: 1.5, expira: 1700000000000 },
 *   },
 *   tags: ['vip', 'mvp'],    // tags cosméticas
 *   titulo: 'Mestre Ladrão', // título customizado
 *   cor_nome: '#e74c3c',     // cor do nome (se integrar com roles)
 * }
 */

const fs   = require('fs');
const PATH = './database/xp.json';

// ─── I/O ────────────────────────────────────────────────────────────────────
function ler() {
    try { return JSON.parse(fs.readFileSync(PATH, 'utf-8')); } catch { return {}; }
}
function salvar(dados) {
    fs.writeFileSync(PATH, JSON.stringify(dados, null, 2));
}

// Garante que o usuário existe no JSON com todos os campos
function garantir(dados, gid, uid) {
    if (!dados[gid])          dados[gid] = {};
    if (!dados[gid][uid])     dados[gid][uid] = {};
    const u = dados[gid][uid];
    u.xp            ??= 0;
    u.nivel         ??= 1;
    u.coins         ??= 0;
    u.banco         ??= 0;
    u.inventario    ??= {};
    u.bonus_ativos  ??= {};
    u.tags          ??= [];
    u.titulo        ??= null;
    u.cor_nome      ??= null;
    return u;
}

// ─── Helpers internos ────────────────────────────────────────────────────────
function _expirou(expira) {
    if (expira === null) return false;   // uso único — nunca "expira" sozinho
    return Date.now() > expira;
}

function _limparExpirados(u) {
    for (const [chave, bonus] of Object.entries(u.bonus_ativos)) {
        if (bonus.expira !== null && _expirou(bonus.expira)) {
            delete u.bonus_ativos[chave];
        }
    }
}

// ─── Duração em ms por ID de item ────────────────────────────────────────────
const DURACOES = {
    xp2x_1h:   60 * 60 * 1000,
    xp2x_6h:   6  * 60 * 60 * 1000,
    xp2x_24h:  24 * 60 * 60 * 1000,
    xp3x_1h:   60 * 60 * 1000,
    xp5x_30m:  30 * 60 * 1000,
    escudo:     null,             // uso único
    escudo_plus:24 * 60 * 60 * 1000,
    cofre:      7  * 24 * 60 * 60 * 1000,
    invisivel:  12 * 60 * 60 * 1000,
    armadura:   6  * 60 * 60 * 1000,
    amuleto:    30 * 60 * 1000,
    ferradura:  60 * 60 * 1000,
    trevo4:     2  * 60 * 60 * 1000,
    dado_ouro:  60 * 60 * 1000,
    estrela_cad: null,            // uso único / evento imediato
    deus:       60 * 60 * 1000,
    roubo_perfeito: null,         // uso único
    assinatura: 7  * 24 * 60 * 60 * 1000,
};

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Ativa um item do inventário do usuário.
 * Retorna { ok: true } ou { ok: false, motivo: string }
 */
function ativar(gid, uid, itemId) {
    const dados = ler();
    const u     = garantir(dados, gid, uid);
    _limparExpirados(u);

    if (!u.inventario[itemId] || u.inventario[itemId] <= 0)
        return { ok: false, motivo: 'Você não tem esse item no inventário!' };

    u.inventario[itemId]--;
    if (u.inventario[itemId] === 0) delete u.inventario[itemId];

    const duracao = DURACOES[itemId] ?? null;
    const expira  = duracao ? Date.now() + duracao : null;

    // Mapeamento item → efeito
    switch (itemId) {
        case 'xp2x_1h': case 'xp2x_6h': case 'xp2x_24h':
            u.bonus_ativos.xp_mult = { mult: 2, expira };
            break;
        case 'xp3x_1h':
            u.bonus_ativos.xp_mult = { mult: 3, expira };
            break;
        case 'xp5x_30m':
            u.bonus_ativos.xp_mult = { mult: 5, expira };
            break;
        case 'escudo':
            u.bonus_ativos.escudo = { expira: null }; // uso único
            break;
        case 'escudo_plus':
            u.bonus_ativos.escudo = { expira };
            break;
        case 'cofre':
            u.bonus_ativos.cofre = { limite: 5000, expira };
            break;
        case 'invisivel':
            u.bonus_ativos.invisivel = { expira };
            break;
        case 'armadura':
            u.bonus_ativos.armadura = { expira };
            break;
        case 'amuleto': case 'ferradura':
            u.bonus_ativos.sorte = { mult: itemId === 'ferradura' ? 1.4 : 1.25, expira };
            break;
        case 'trevo4':
            u.bonus_ativos.sorte = { mult: 1.75, expira };
            break;
        case 'dado_ouro':
            u.bonus_ativos.apostas = { mult: 1.5, expira };
            break;
        case 'estrela_cad': {
            // Evento imediato: bônus aleatório de coins
            const premio = Math.floor(Math.random() * 900) + 100;
            u.coins += premio;
            salvar(dados);
            return { ok: true, efeito: 'estrela', premio };
        }
        case 'roubo_perfeito':
            u.bonus_ativos.roubo_perfeito = { expira: null };
            break;
        case 'deus':
            u.bonus_ativos.xp_mult  = { mult: 10, expira };
            u.bonus_ativos.escudo   = { expira };
            u.bonus_ativos.sorte    = { mult: 2, expira };
            u.bonus_ativos.armadura = { expira };
            break;
        case 'assinatura':
            u.bonus_ativos.xp_mult  = { mult: 2, expira };
            u.bonus_ativos.escudo   = { expira };
            u.bonus_ativos.sorte    = { mult: 1.5, expira };
            u.bonus_ativos.apostas  = { mult: 1.5, expira };
            u.bonus_ativos.invisivel= { expira };
            break;
        // Itens cosméticos / sem efeito de ativação (tags, cor, título)
        case 'vip': case 'mvp': case 'lenda': case 'og': case 'streamer':
            if (!u.tags.includes(itemId)) u.tags.push(itemId);
            break;
        case 'cor_nome':
            u.cor_nome = '#e74c3c'; // placeholder; troca via d!perfil cor #hex
            break;
        case 'titulo':
            u.titulo = ''; // define via d!perfil titulo <texto>
            break;
        // Itens de uso imediato sem ativação manual
        case 'coins_bag': {
            const premio = Math.floor(Math.random() * 400) + 100;
            u.coins += premio;
            salvar(dados);
            return { ok: true, efeito: 'coins_bag', premio };
        }
        case 'xp_bonus': {
            const xpGanho = u.nivel * 100;
            u.xp += xpGanho;
            salvar(dados);
            return { ok: true, efeito: 'xp_bonus', premio: xpGanho };
        }
        // Itens sem lógica de ativação aqui (jackpot, loot_box tratados nos seus cmds)
        default:
            break;
    }

    salvar(dados);
    return { ok: true, efeito: itemId, expira };
}

// ─── Consultas de bônus ativo (usadas nos outros comandos) ──────────────────

function _getBonus(gid, uid, chave) {
    const dados = ler();
    const u     = dados[gid]?.[uid];
    if (!u?.bonus_ativos?.[chave]) return null;
    if (_expirou(u.bonus_ativos[chave].expira)) {
        // Limpa e salva
        delete u.bonus_ativos[chave];
        salvar(dados);
        return null;
    }
    return u.bonus_ativos[chave];
}

/** Multiplica o XP ganho pela mensagem. Retorna multiplicador (1 se sem bônus). */
function getMultXP(gid, uid) {
    return _getBonus(gid, uid, 'xp_mult')?.mult ?? 1;
}

/** Retorna true se o usuário tem escudo ativo. Consome se for uso único. */
function temEscudo(gid, uid) {
    const b = _getBonus(gid, uid, 'escudo');
    if (!b) return false;
    // Se uso único (expira null), consome ao verificar
    if (b.expira === null) {
        const dados = ler();
        delete dados[gid][uid].bonus_ativos.escudo;
        salvar(dados);
    }
    return true;
}

/** Retorna true se invisível para roubos. */
function estaInvisivel(gid, uid) {
    return !!_getBonus(gid, uid, 'invisivel');
}

/** Retorna true se tem armadura (bloqueia 100% dos roubos). */
function temArmadura(gid, uid) {
    return !!_getBonus(gid, uid, 'armadura');
}

/** Retorna multiplicador de sorte no roubo (1 se sem bônus). */
function getMultSorte(gid, uid) {
    return _getBonus(gid, uid, 'sorte')?.mult ?? 1;
}

/** Retorna multiplicador de ganhos em apostas (1 se sem bônus). */
function getMultApostas(gid, uid) {
    return _getBonus(gid, uid, 'apostas')?.mult ?? 1;
}

/** Retorna true e consome o roubo perfeito se ativo. */
function temRouboPerfeito(gid, uid) {
    const b = _getBonus(gid, uid, 'roubo_perfeito');
    if (!b) return false;
    const dados = ler();
    delete dados[gid][uid].bonus_ativos.roubo_perfeito;
    salvar(dados);
    return true;
}

/** Retorna limite do cofre se ativo, null caso contrário. */
function getLimiteCofre(gid, uid) {
    return _getBonus(gid, uid, 'cofre')?.limite ?? null;
}

/** Lista todos os bônus ativos formatados pro embed do perfil. */
function listarBonusAtivos(gid, uid) {
    const dados = ler();
    const u     = dados[gid]?.[uid];
    if (!u?.bonus_ativos) return [];

    const agora = Date.now();
    const resultado = [];

    for (const [chave, bonus] of Object.entries(u.bonus_ativos)) {
        if (bonus.expira !== null && agora > bonus.expira) continue;

        let label = '';
        let tempo = bonus.expira
            ? `expira em ${_formatarTempo(bonus.expira - agora)}`
            : 'uso único restante';

        switch (chave) {
            case 'xp_mult':     label = `⚡ XP ×${bonus.mult}`; break;
            case 'escudo':      label = '🛡️ Escudo'; break;
            case 'armadura':    label = '⚔️ Armadura'; break;
            case 'invisivel':   label = '👻 Invisível'; break;
            case 'sorte':       label = `🍀 Sorte ×${bonus.mult}`; break;
            case 'apostas':     label = `🎲 Apostas ×${bonus.mult}`; break;
            case 'roubo_perfeito': label = '🦊 Roubo Perfeito'; break;
            case 'cofre':       label = `🏦 Cofre (${bonus.limite} coins)`; break;
            default:            label = chave;
        }
        resultado.push(`${label} — \`${tempo}\``);
    }
    return resultado;
}

function _formatarTempo(ms) {
    if (ms <= 0) return 'expirando';
    const s = Math.floor(ms / 1000);
    if (s < 60)   return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60)   return `${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24)   return `${h}h ${m % 60}min`;
    return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/** Retorna tags cosméticas do usuário. */
function getTags(gid, uid) {
    const dados = ler();
    return dados[gid]?.[uid]?.tags ?? [];
}

/** Retorna { titulo, cor_nome } do usuário. */
function getCosmeticos(gid, uid) {
    const dados = ler();
    const u = dados[gid]?.[uid] ?? {};
    return { titulo: u.titulo ?? null, cor_nome: u.cor_nome ?? null };
}

/** Seta título customizado (chamado pelo d!perfil titulo <texto>). */
function setTitulo(gid, uid, texto) {
    const dados = ler();
    garantir(dados, gid, uid);
    if (!dados[gid][uid].tags.includes('titulo'))
        return { ok: false, motivo: 'Você não tem o item **Título Customizado** no inventário!' };
    dados[gid][uid].titulo = texto.slice(0, 32);
    salvar(dados);
    return { ok: true };
}

/** Seta cor customizada (chamado pelo d!perfil cor #hex). */
function setCor(gid, uid, hex) {
    const dados = ler();
    garantir(dados, gid, uid);
    if (!dados[gid][uid].tags.includes('cor_nome'))
        return { ok: false, motivo: 'Você não tem o item **Cor Personalizada** no inventário!' };
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex))
        return { ok: false, motivo: 'Cor inválida! Use o formato `#RRGGBB`.' };
    dados[gid][uid].cor_nome = hex;
    salvar(dados);
    return { ok: true };
}

module.exports = {
    ler, salvar, garantir,
    ativar,
    getMultXP,
    temEscudo, estaInvisivel, temArmadura,
    getMultSorte, getMultApostas,
    temRouboPerfeito,
    getLimiteCofre,
    listarBonusAtivos,
    getTags, getCosmeticos,
    setTitulo, setCor,
    _formatarTempo,
};