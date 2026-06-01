'use strict';
// ============================================================
//  RETH MORGAN — EMOJI FIGHT
//  ✅ Batalha 1v1 com emojis como "personagens"
//  ✅ Sistema de HP, ataque, defesa e habilidades especiais
//  ✅ Aposta de coins integrada
//  ✅ Round-by-round com botões de ação
//  ✅ Efeitos de status (paralisia, escudo, veneno)
//  ✅ Cooldown e integração com bonus.js
//  FIX: cooldown do especial decrementado na ordem certa
//  FIX: IA tem cooldown de especial igual ao jogador (simétrico)
//  FIX: buff de ATK aplicado corretamente e expirado no turno certo
// ============================================================
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const bonus = require('../../lib/bonus');

const COOLDOWNS = new Map();
const CD_MS     = 20_000;

// ── Catálogo de emojis/personagens ───────────────────────────────────────────
const PERSONAGENS = [
    { emoji: '🐉', nome: 'Dragão',    hp: 120, atk: 18, def: 8,  especial: 'fogo',       chanceSp: 0.20 },
    { emoji: '⚡',  nome: 'Trovão',   hp: 90,  atk: 22, def: 4,  especial: 'paralisia',  chanceSp: 0.25 },
    { emoji: '🦁',  nome: 'Leão',     hp: 110, atk: 16, def: 10, especial: 'rugido',     chanceSp: 0.20 },
    { emoji: '🐍',  nome: 'Serpente', hp: 85,  atk: 20, def: 5,  especial: 'veneno',     chanceSp: 0.30 },
    { emoji: '🦅',  nome: 'Águia',    hp: 80,  atk: 25, def: 3,  especial: 'rasgar',     chanceSp: 0.22 },
    { emoji: '🐺',  nome: 'Lobo',     hp: 100, atk: 17, def: 9,  especial: 'matilha',    chanceSp: 0.18 },
    { emoji: '🔥',  nome: 'Chama',    hp: 75,  atk: 28, def: 2,  especial: 'queimar',    chanceSp: 0.28 },
    { emoji: '🌊',  nome: 'Onda',     hp: 115, atk: 14, def: 12, especial: 'tsunami',    chanceSp: 0.15 },
    { emoji: '💀',  nome: 'Sombra',   hp: 95,  atk: 21, def: 6,  especial: 'drenar',     chanceSp: 0.25 },
    { emoji: '🌪️', nome: 'Tornado',  hp: 88,  atk: 19, def: 7,  especial: 'redemoinho', chanceSp: 0.20 },
];

// ── Descrições de especiais ───────────────────────────────────────────────────
const DESC_ESPECIAL = {
    fogo:       '🔥 Fogo — causa dano em área (1.8× ATK)',
    paralisia:  '⚡ Paralisia — inimigo perde 1 turno',
    rugido:     '🦁 Rugido — aumenta ATK próprio em 5 por 2 turnos',
    veneno:     '🐍 Veneno — causa 8 de dano por turno por 3 turnos',
    rasgar:     '🦅 Rasgar — ignora defesa do inimigo (ATK puro)',
    matilha:    '🐺 Matilha — ataca 2 vezes consecutivas',
    queimar:    '🔥 Queimar — dano massivo (2× ATK) mas perde 10 HP',
    tsunami:    '🌊 Tsunami — reduz DEF inimiga por 2 turnos',
    drenar:     '💀 Drenar — rouba HP do inimigo (ATK e cura 50%)',
    redemoinho: '🌪️ Redemoinho — ATK aleatório entre 0.5× e 2.5×',
};

const SP_COOLDOWN_TURNOS = 3;

function sortearPersonagem() {
    return { ...PERSONAGENS[Math.floor(Math.random() * PERSONAGENS.length)] };
}

function calcDano(atacante, defensor, statusAtk) {
    let atk = atacante.atk;
    // Aplica buff de ATK se ativo
    if (statusAtk.buffAtk && statusAtk.buffAtk.turnos > 0) {
        atk += statusAtk.buffAtk.bonus;
    }
    return Math.max(1, atk - defensor.def + Math.floor(Math.random() * 5) - 2);
}

function aplicarEspecial(atacante, defensor, statusAtk, statusDef, log) {
    switch (atacante.especial) {
        case 'fogo': {
            const d = Math.floor(atacante.atk * 1.8);
            defensor.hp -= d;
            log.push(`💥 **${atacante.nome}** usou Fogo — **${d} de dano**!`);
            break;
        }
        case 'paralisia': {
            statusDef.paralizado = 1;
            log.push(`⚡ **${atacante.nome}** paralisou **${defensor.nome}** — ele perde o próximo turno!`);
            break;
        }
        case 'rugido': {
            statusAtk.buffAtk = { bonus: 5, turnos: 2 };
            log.push(`🦁 **${atacante.nome}** rugiu — ATK +5 por 2 turnos!`);
            break;
        }
        case 'veneno': {
            statusDef.envenenado = { dano: 8, turnos: 3 };
            log.push(`🐍 **${atacante.nome}** envenenou **${defensor.nome}** — 8 de dano por 3 turnos!`);
            break;
        }
        case 'rasgar': {
            const d = atacante.atk + Math.floor(Math.random() * 6);
            defensor.hp -= d;
            log.push(`🦅 **${atacante.nome}** rasgou — **${d} de dano puro** (ignora defesa)!`);
            break;
        }
        case 'matilha': {
            const d1 = Math.max(1, atacante.atk - defensor.def);
            const d2 = Math.max(1, atacante.atk - defensor.def);
            defensor.hp -= d1 + d2;
            log.push(`🐺 **${atacante.nome}** atacou 2×: **${d1} + ${d2} = ${d1 + d2} de dano**!`);
            break;
        }
        case 'queimar': {
            const d = Math.floor(atacante.atk * 2);
            defensor.hp -= d;
            atacante.hp  -= 10;
            log.push(`🔥 **${atacante.nome}** queimou tudo — **${d} de dano** mas perdeu 10 HP!`);
            break;
        }
        case 'tsunami': {
            statusDef.debuffDef = { reducao: 6, turnos: 2 };
            defensor.def = Math.max(0, defensor.def - 6);
            log.push(`🌊 **${atacante.nome}** lançou Tsunami — DEF de **${defensor.nome}** reduzida por 2 turnos!`);
            break;
        }
        case 'drenar': {
            const d = Math.max(1, atacante.atk - defensor.def);
            defensor.hp  -= d;
            atacante.hp  += Math.floor(d / 2);
            log.push(`💀 **${atacante.nome}** drenou **${d} HP** e se curou em **${Math.floor(d / 2)} HP**!`);
            break;
        }
        case 'redemoinho': {
            const mult = 0.5 + Math.random() * 2;
            const d    = Math.floor(atacante.atk * mult);
            defensor.hp -= d;
            log.push(`🌪️ **${atacante.nome}** usou Redemoinho — **${d} de dano** (×${mult.toFixed(1)})!`);
            break;
        }
    }
}

// ── Tick de fim de turno: decrementa buffs/debuffs ────────────────────────────
function tickStatus(personagem, status, log, lado) {
    // Buff de ATK
    if (status.buffAtk) {
        status.buffAtk.turnos--;
        if (status.buffAtk.turnos <= 0) {
            delete status.buffAtk;
            log.push(`🦁 Buff de ATK de **${personagem.nome}** expirou.`);
        }
    }
    // Debuff de DEF
    if (status.debuffDef) {
        status.debuffDef.turnos--;
        if (status.debuffDef.turnos <= 0) {
            personagem.def += status.debuffDef.reducao;
            delete status.debuffDef;
            log.push(`🌊 DEF de **${personagem.nome}** voltou ao normal.`);
        }
    }
}

function barraHP(atual, max, tam = 10) {
    const p = Math.max(0, Math.min(tam, Math.round((atual / max) * tam)));
    return `${'█'.repeat(p)}${'░'.repeat(tam - p)} \`${Math.max(0, atual)}/${max}\``;
}

function buildEmbed(p1, p2, aposta, round, log, statusP1, terminado = false, vencedor = null) {
    const cor = terminado
        ? (vencedor === 'p1' ? '#2ecc71' : '#e74c3c')
        : '#f39c12';

    const embed = new EmbedBuilder()
        .setColor(cor)
        .setTitle(terminado
            ? (vencedor === 'p1' ? '🏆 VITÓRIA!' : '💀 DERROTA!')
            : `⚔️ EMOJI FIGHT — Round ${round}`)
        .addFields(
            {
                name:  `${p1.emoji} ${p1.nome} (Você)`,
                value: barraHP(p1.hp, p1.maxHp),
                inline: false,
            },
            {
                name:  `${p2.emoji} ${p2.nome} (Oponente)`,
                value: barraHP(p2.hp, p2.maxHp),
                inline: false,
            },
            {
                name:  '📜 Log do Round',
                value: log.length ? log.join('\n') : '*Nenhuma ação ainda.*',
                inline: false,
            },
        );

    if (!terminado) {
        const cdRestante = statusP1.spCd ?? 0;
        embed.addFields({
            name:  '🎯 Especial',
            value: cdRestante > 0 ? `\`Recarga: ${cdRestante} turno(s)\`` : '✅ Disponível',
            inline: true,
        });
    }

    if (terminado) {
        const ganho = vencedor === 'p1' ? aposta * 2 : 0;
        embed.addFields({
            name:  '💰 Resultado',
            value: vencedor === 'p1'
                ? `Você ganhou **${ganho} 🪙**!`
                : `Você perdeu **${aposta} 🪙**.`,
            inline: false,
        });
    }

    embed.setFooter({ text: `Aposta: ${aposta} 🪙 · Round ${round}` });
    return embed;
}

function buildAcoes(spDisponivel, paralizado = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('ef_atacar')
            .setLabel('⚔️ Atacar')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(paralizado),
        new ButtonBuilder()
            .setCustomId('ef_defender')
            .setLabel('🛡️ Defender')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(paralizado),
        new ButtonBuilder()
            .setCustomId('ef_especial')
            .setLabel('✨ Especial')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!spDisponivel || paralizado),
        new ButtonBuilder()
            .setCustomId('ef_desistir')
            .setLabel('🏳️ Desistir')
            .setStyle(ButtonStyle.Danger),
    );
}

module.exports = {
    name: 'emojifight',
    aliases: ['ef', 'ejf', 'luta'],

    execute: async (msg, args) => {
        const gid = msg.guild.id;
        const uid = msg.author.id;

        // ── Cooldown ─────────────────────────────────────────────────────────
        const agora = Date.now();
        if ((agora - (COOLDOWNS.get(uid) ?? 0)) < CD_MS) {
            const r = Math.ceil((CD_MS - (agora - COOLDOWNS.get(uid))) / 1000);
            return msg.reply(`⏰ Aguarde **${r}s** para jogar de novo.`);
        }

        // ── Aposta ───────────────────────────────────────────────────────────
        const aposta = parseInt(args[0]);
        if (!aposta || aposta < 10)
            return msg.reply('❌ Use: `r!emojifight <aposta>`\nAposta mínima: **10 🪙**');

        const dados = bonus.ler();
        bonus.garantir(dados, gid, uid);
        const u = dados[gid][uid];
        if ((u.coins ?? 0) < aposta)
            return msg.reply(`❌ Você não tem \`${aposta} 🪙\`!`);

        u.coins -= aposta;
        require('fs').writeFileSync('./database/xp.json', JSON.stringify(dados, null, 2));
        COOLDOWNS.set(uid, agora);

        // ── Setup ─────────────────────────────────────────────────────────────
        const p1 = sortearPersonagem(); p1.maxHp = p1.hp;
        const p2 = sortearPersonagem(); p2.maxHp = p2.hp;

        let round = 1;

        // statusP1 e statusP2 guardam: spCd, paralizado, envenenado, buffAtk, debuffDef, defendendo
        const statusP1 = { spCd: 0 };
        const statusP2 = { spCd: 0 };

        const logRound = [];

        // Mostra personagens sorteados
        await msg.reply({
            embeds: [new EmbedBuilder()
                .setColor('#9b59b6')
                .setTitle('⚔️ EMOJI FIGHT — Personagens Sorteados!')
                .addFields(
                    {
                        name:  `${p1.emoji} Você`,
                        value: `**${p1.nome}**\nHP: ${p1.hp} · ATK: ${p1.atk} · DEF: ${p1.def}\n🌟 Especial: ${DESC_ESPECIAL[p1.especial]}`,
                        inline: true,
                    },
                    {
                        name:  `${p2.emoji} Oponente`,
                        value: `**${p2.nome}**\nHP: ${p2.hp} · ATK: ${p2.atk} · DEF: ${p2.def}\n🌟 Especial: ${DESC_ESPECIAL[p2.especial]}`,
                        inline: true,
                    },
                )
                .setFooter({ text: 'A batalha começa agora!' })
            ],
        });

        await new Promise(r => setTimeout(r, 1500));

        const spP1Disponivel = () => statusP1.spCd === 0;

        const m = await msg.channel.send({
            embeds: [buildEmbed(p1, p2, aposta, round, logRound, statusP1)],
            components: [buildAcoes(spP1Disponivel())],
        });

        const coletor = m.createMessageComponentCollector({
            filter: i => i.user.id === uid,
            time: 5 * 60_000,
        });

        coletor.on('collect', async i => {
            await i.deferUpdate();
            logRound.length = 0;

            let terminado = false;
            let vencedor  = null;

            // ── Turno do jogador ──────────────────────────────────────────────
            if (i.customId === 'ef_desistir') {
                terminado = true;
                vencedor  = 'p2';
                logRound.push('🏳️ Você desistiu da batalha.');

            } else if (statusP1.paralizado) {
                logRound.push(`⚡ **${p1.nome}** está paralisado — perdeu o turno!`);
                delete statusP1.paralizado;

            } else if (i.customId === 'ef_atacar') {
                const dano = calcDano(p1, p2, statusP1);
                p2.hp -= dano;
                logRound.push(`⚔️ **${p1.nome}** atacou — **${dano} de dano**!`);

            } else if (i.customId === 'ef_defender') {
                statusP1.defendendo = true;
                logRound.push(`🛡️ **${p1.nome}** se defendeu — dano reduzido no próximo ataque inimigo!`);

            } else if (i.customId === 'ef_especial' && spP1Disponivel()) {
                aplicarEspecial(p1, p2, statusP1, statusP2, logRound);
                // FIX: cooldown definido APÓS usar o especial (não antes)
                statusP1.spCd = SP_COOLDOWN_TURNOS;
            }

            // ── Decrementa cooldown do especial do jogador ────────────────────
            // FIX: decrementado APÓS o turno ser resolvido, não antes
            if (statusP1.spCd > 0) statusP1.spCd--;

            // ── Veneno no p2 (fim do turno do jogador) ────────────────────────
            if (statusP2.envenenado) {
                p2.hp -= statusP2.envenenado.dano;
                logRound.push(`🐍 **${p2.nome}** sofreu ${statusP2.envenenado.dano} de veneno!`);
                statusP2.envenenado.turnos--;
                if (statusP2.envenenado.turnos <= 0) delete statusP2.envenenado;
            }

            // ── Tick de buffs/debuffs do jogador ─────────────────────────────
            tickStatus(p1, statusP1, logRound);
            tickStatus(p2, statusP2, logRound);

            // Checa derrota do p2
            if (p2.hp <= 0 && !terminado) { terminado = true; vencedor = 'p1'; }

            // ── Turno da IA ───────────────────────────────────────────────────
            if (!terminado) {
                if (statusP2.paralizado) {
                    logRound.push(`⚡ **${p2.nome}** está paralisado — perdeu o turno!`);
                    delete statusP2.paralizado;

                } else if (statusP2.spCd === 0 && Math.random() < p2.chanceSp) {
                    // IA usa especial (com cooldown simétrico ao jogador)
                    aplicarEspecial(p2, p1, statusP2, statusP1, logRound);
                    statusP2.spCd = SP_COOLDOWN_TURNOS;

                } else if (Math.random() < 0.15) {
                    statusP2.defendendo = true;
                    logRound.push(`🛡️ **${p2.nome}** se defendeu!`);

                } else {
                    let dano = calcDano(p2, p1, statusP2);
                    if (statusP1.defendendo) {
                        dano = Math.floor(dano * 0.4);
                        delete statusP1.defendendo;
                        logRound.push(`🛡️ Defesa absorveu o impacto!`);
                    }
                    p1.hp -= dano;
                    logRound.push(`💥 **${p2.nome}** atacou você — **${dano} de dano**!`);
                }

                // Decrementa cooldown da IA
                if (statusP2.spCd > 0) statusP2.spCd--;

                // Veneno no p1
                if (statusP1.envenenado) {
                    p1.hp -= statusP1.envenenado.dano;
                    logRound.push(`🐍 **${p1.nome}** sofreu ${statusP1.envenenado.dano} de veneno!`);
                    statusP1.envenenado.turnos--;
                    if (statusP1.envenenado.turnos <= 0) delete statusP1.envenenado;
                }

                if (p1.hp <= 0) { terminado = true; vencedor = 'p2'; }
            }

            round++;

            if (terminado) {
                coletor.stop('user');

                if (vencedor === 'p1') {
                    const ganho = aposta * 2;
                    const d2 = bonus.ler();
                    bonus.garantir(d2, gid, uid);
                    d2[gid][uid].coins += ganho;
                    require('fs').writeFileSync('./database/xp.json', JSON.stringify(d2, null, 2));
                }

                await m.edit({
                    embeds: [buildEmbed(p1, p2, aposta, round, logRound, statusP1, true, vencedor)],
                    components: [],
                });
            } else {
                await m.edit({
                    embeds: [buildEmbed(p1, p2, aposta, round, logRound, statusP1)],
                    components: [buildAcoes(spP1Disponivel(), !!statusP1.paralizado)],
                });
            }
        });

        coletor.on('end', (_, reason) => {
            if (reason !== 'user') {
                m.edit({ components: [] }).catch(() => {});
            }
        });
    },
};