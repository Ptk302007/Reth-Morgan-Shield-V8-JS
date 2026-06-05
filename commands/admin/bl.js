'use strict';
// ============================================================
//  RETH MORGAN — SISTEMA DE BLACKLIST GLOBAL
//  commands/admin/bl.js
//  Acesso: OWNER_IDS apenas (donos do bot)
//  Funções: add, remove, list, info, wipe
// ============================================================
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const DB_PATH = './database/blacklist.json';

// ── helpers ──────────────────────────────────────────────────

function lerBlacklist() {
    try {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        // suporte ao formato legado (array simples) e novo (objeto com metadados)
        if (Array.isArray(parsed)) {
            // migra pra novo formato
            const novo = {};
            for (const id of parsed) novo[id] = { addedAt: new Date().toISOString(), addedBy: 'migrado', motivo: 'Migrado do sistema legado.' };
            salvarBlacklist(novo);
            return novo;
        }
        return parsed;
    } catch { return {}; }
}

function salvarBlacklist(dados) {
    fs.writeFileSync(DB_PATH, JSON.stringify(dados, null, 2));
}

function formatarData(iso) {
    if (!iso) return '`Desconhecida`';
    return `<t:${Math.floor(new Date(iso).getTime() / 1000)}:D>`;
}

function formatarDataR(iso) {
    if (!iso) return '`Desconhecida`';
    return `<t:${Math.floor(new Date(iso).getTime() / 1000)}:R>`;
}

// ── módulo ───────────────────────────────────────────────────

module.exports = {
    name: 'bl',
    aliases: ['blacklist', 'lista-negra'],
    category: 'admin',

    execute: async (msg, args, client, OWNER_ID) => {
        const OWNER_IDS = [OWNER_ID, '1507543140800921610'].filter(Boolean);

        // ── TRAVA: só donos do bot ────────────────────────────
        if (!OWNER_IDS.includes(msg.author.id)) {
            return msg.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#8B0000')
                    .setAuthor({ name: 'RETH MORGAN — ACESSO NEGADO', iconURL: client.user.displayAvatarURL() })
                    .setDescription(
                        '```\n"Este arquivo é meu. Você não tem autorização."\n```\n' +
                        '🩸 O sistema de Blacklist é **exclusivo dos donos do bot**.\n' +
                        'Nenhum staff de servidor possui acesso a este protocolo.'
                    )
                    .setFooter({ text: `Tentativa registrada • ${msg.author.tag}`, iconURL: msg.author.displayAvatarURL({ dynamic: true }) })
                    .setTimestamp()
                ]
            });
        }

        const acao = (args[0] || '').toLowerCase();
        const bl   = lerBlacklist();

        const botAvatar   = client.user.displayAvatarURL({ size: 256 });
        const execAvatar  = msg.author.displayAvatarURL({ dynamic: true, size: 256 });

        // ─────────────────────────────────────────────────────
        // ── USO / HELP ──
        // ─────────────────────────────────────────────────────
        if (!acao || acao === 'help') {
            return msg.channel.send({
                embeds: [new EmbedBuilder()
                    .setColor('#8B0000')
                    .setAuthor({ name: 'RETH MORGAN — BLACKLIST GLOBAL', iconURL: botAvatar })
                    .setTitle('🩸 SISTEMA DE BLACKLIST — CENTRAL DE CONTROLE')
                    .setDescription(
                        '```\n"Uma lista de alvos. Cada nome aqui é uma sentença."\n```\n' +
                        'Usuários na blacklist são **bloqueados de usar qualquer comando** do bot em qualquer servidor.'
                    )
                    .addFields(
                        { name: '📌 COMANDOS', value:
                            '`r!bl add @user [motivo]` — Adicionar à blacklist\n' +
                            '`r!bl remove @user` — Remover da blacklist\n' +
                            '`r!bl list` — Listar todos os banidos\n' +
                            '`r!bl info @user` — Ver detalhes de um registro\n' +
                            '`r!bl wipe` — ⚠️ Apagar toda a blacklist',
                            inline: false
                        },
                        { name: '📊 REGISTROS ATIVOS', value: `\`${Object.keys(bl).length}\` usuários na lista negra`, inline: true },
                        { name: '👑 ACESSO', value: '`Donos do Bot apenas`', inline: true },
                    )
                    .setFooter({ text: `Reth Morgan Shield V8 • Operador: ${msg.author.tag}`, iconURL: execAvatar })
                    .setTimestamp()
                ]
            });
        }

        // ─────────────────────────────────────────────────────
        // ── ADD ──
        // ─────────────────────────────────────────────────────
        if (acao === 'add') {
            const alvo = msg.mentions.users.first() || await client.users.fetch(args[1]).catch(() => null);
            if (!alvo) {
                return msg.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#8B0000')
                        .setDescription('❌ **Alvo não encontrado.**\nUse `r!bl add @usuário [motivo]` ou forneça um ID válido.')
                        .setTimestamp()
                    ]
                });
            }

            // Travas de segurança
            if (OWNER_IDS.includes(alvo.id)) {
                return msg.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#8B0000')
                        .setAuthor({ name: 'RETH MORGAN — TRAVA DE SEGURANÇA', iconURL: botAvatar })
                        .setDescription('🔒 **Você não pode adicionar um dono do bot na blacklist.**\nO sistema reconhece este ID como autoridade máxima.')
                        .setTimestamp()
                    ]
                });
            }
            if (alvo.id === client.user.id) {
                return msg.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#8B0000')
                        .setDescription('🤖 **Sério mesmo?** Não posso me adicionar na minha própria lista negra.')
                        .setTimestamp()
                    ]
                });
            }
            if (bl[alvo.id]) {
                return msg.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#8B0000')
                        .setAuthor({ name: 'RETH MORGAN — JÁ REGISTRADO', iconURL: botAvatar })
                        .setDescription(`⚠️ <@${alvo.id}> já consta na lista negra.\nUse \`r!bl info @${alvo.username}\` para ver o registro.`)
                        .setTimestamp()
                    ]
                });
            }

            const motivo = args.slice(msg.mentions.users.size > 0 ? 2 : 2).join(' ') || 'Sem motivo registrado.';

            // Confirmação
            const confirmEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setAuthor({ name: 'RETH MORGAN — CONFIRMAÇÃO NECESSÁRIA', iconURL: botAvatar })
                .setThumbnail(alvo.displayAvatarURL({ dynamic: true, size: 256 }))
                .setTitle('🩸 ADICIONAR À LISTA NEGRA')
                .setDescription(
                    '```\n"Confirme a sentença. Uma vez inscrito, sem retorno fácil."\n```'
                )
                .addFields(
                    { name: '🎯 Alvo',       value: `<@${alvo.id}>\n\`${alvo.tag}\`\nID: \`${alvo.id}\``, inline: true },
                    { name: '👑 Operador',   value: `<@${msg.author.id}>\n\`${msg.author.tag}\``, inline: true },
                    { name: '📋 Motivo',     value: motivo, inline: false },
                    { name: '⚠️ Efeito',     value: '`Bloqueado de usar qualquer comando do bot em TODOS os servidores`', inline: false },
                )
                .setFooter({ text: 'Confirme em 20 segundos ou a ação será cancelada.', iconURL: execAvatar })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('bl_confirm_add').setLabel('🩸 CONFIRMAR BLACKLIST').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('bl_cancel').setLabel('CANCELAR').setStyle(ButtonStyle.Secondary),
            );

            const confirmMsg = await msg.channel.send({ embeds: [confirmEmbed], components: [row] });

            const collector = confirmMsg.createMessageComponentCollector({
                filter: i => i.user.id === msg.author.id,
                max: 1, time: 20_000
            });

            collector.on('collect', async (i) => {
                if (i.customId === 'bl_cancel') {
                    await confirmMsg.edit({
                        embeds: [new EmbedBuilder()
                            .setColor('#2a2a2a')
                            .setDescription('🚫 Operação cancelada pelo operador.')
                            .setTimestamp()
                        ],
                        components: []
                    });
                    return;
                }

                // Executa
                const blAtual = lerBlacklist();
                blAtual[alvo.id] = {
                    tag:       alvo.tag,
                    addedAt:   new Date().toISOString(),
                    addedBy:   msg.author.id,
                    addedByTag:msg.author.tag,
                    motivo,
                    guildId:   msg.guild?.id  || null,
                    guildName: msg.guild?.name || null,
                };
                salvarBlacklist(blAtual);

                // DM pro alvo (tenta)
                try {
                    await alvo.send({
                        embeds: [new EmbedBuilder()
                            .setColor('#8B0000')
                            .setAuthor({ name: 'RETH MORGAN — SISTEMA DE BLACKLIST', iconURL: botAvatar })
                            .setTitle('🩸 VOCÊ FOI ADICIONADO À LISTA NEGRA')
                            .setDescription(
                                'Seu acesso ao bot **Reth Morgan** foi revogado globalmente.\n' +
                                'Você não poderá usar nenhum comando em nenhum servidor onde o bot esteja presente.'
                            )
                            .addFields({ name: '📋 Motivo registrado', value: motivo })
                            .setFooter({ text: 'Para recorrer, entre em contato com o desenvolvedor.' })
                            .setTimestamp()
                        ]
                    });
                } catch (_) {}

                const logEmbed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setAuthor({ name: 'RETH MORGAN — BLACKLIST GLOBAL', iconURL: botAvatar })
                    .setThumbnail(alvo.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setTitle('🩸 ALVO INSCRITO NA LISTA NEGRA')
                    .setDescription('```\n"O nome está na lista. O caso está encerrado."\n```')
                    .addFields(
                        { name: '🎯 Alvo',         value: `<@${alvo.id}>\n\`${alvo.tag}\`\nID: \`${alvo.id}\``,    inline: true },
                        { name: '👑 Operador',      value: `<@${msg.author.id}>\n\`${msg.author.tag}\``,             inline: true },
                        { name: '🏠 Servidor',      value: msg.guild ? `\`${msg.guild.name}\`` : '`DM`',            inline: true },
                        { name: '📋 Motivo',        value: motivo,                                                   inline: false },
                        { name: '📊 Total na lista',value: `\`${Object.keys(lerBlacklist()).length}\` registros`,    inline: true },
                        { name: '🕐 Inscrito em',   value: `<t:${Math.floor(Date.now()/1000)}:F>`,                  inline: true },
                    )
                    .setFooter({ text: `Shield System V8 • Blacklist Global`, iconURL: execAvatar })
                    .setTimestamp();

                await i.update({ embeds: [logEmbed], components: [] });
            });

            collector.on('end', (col) => {
                if (col.size === 0) {
                    confirmMsg.edit({ components: [] }).catch(() => {});
                }
            });

            return;
        }

        // ─────────────────────────────────────────────────────
        // ── REMOVE ──
        // ─────────────────────────────────────────────────────
        if (acao === 'remove' || acao === 'rm') {
            const alvo = msg.mentions.users.first() || await client.users.fetch(args[1]).catch(() => null);
            if (!alvo) {
                return msg.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#8B0000')
                        .setDescription('❌ **Alvo não encontrado.**\nUse `r!bl remove @usuário` ou forneça um ID válido.')
                        .setTimestamp()
                    ]
                });
            }
            if (!bl[alvo.id]) {
                return msg.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#8B0000')
                        .setDescription(`⚠️ **<@${alvo.id}> não está na lista negra.**\nNada a remover.`)
                        .setTimestamp()
                    ]
                });
            }

            const registro = bl[alvo.id];
            delete bl[alvo.id];
            salvarBlacklist(bl);

            // DM ao solto (tenta)
            try {
                await alvo.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#27ae60')
                        .setAuthor({ name: 'RETH MORGAN — BLACKLIST', iconURL: botAvatar })
                        .setTitle('✅ BLACKLIST REMOVIDA')
                        .setDescription('Seu acesso ao bot **Reth Morgan** foi **restaurado**.\nVocê pode usar os comandos normalmente.')
                        .setTimestamp()
                    ]
                });
            } catch (_) {}

            return msg.channel.send({
                embeds: [new EmbedBuilder()
                    .setColor('#27ae60')
                    .setAuthor({ name: 'RETH MORGAN — REGISTRO REMOVIDO', iconURL: botAvatar })
                    .setThumbnail(alvo.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setTitle('✅ ALVO LIBERADO DA LISTA NEGRA')
                    .addFields(
                        { name: '🎯 Usuário',       value: `<@${alvo.id}>\n\`${alvo.tag}\``,              inline: true },
                        { name: '👑 Liberado por',  value: `<@${msg.author.id}>\n\`${msg.author.tag}\``,  inline: true },
                        { name: '📋 Motivo original',value: registro.motivo || 'Não registrado.',          inline: false },
                        { name: '📅 Inscrito em',   value: formatarData(registro.addedAt),                 inline: true },
                        { name: '📊 Restantes',     value: `\`${Object.keys(bl).length}\` na lista`,       inline: true },
                    )
                    .setFooter({ text: `Shield System V8 • Operador: ${msg.author.tag}`, iconURL: execAvatar })
                    .setTimestamp()
                ]
            });
        }

        // ─────────────────────────────────────────────────────
        // ── INFO ──
        // ─────────────────────────────────────────────────────
        if (acao === 'info' || acao === 'check') {
            const alvo = msg.mentions.users.first() || await client.users.fetch(args[1]).catch(() => null);
            if (!alvo) {
                return msg.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#8B0000')
                        .setDescription('❌ **Alvo não encontrado.**\nUse `r!bl info @usuário` ou forneça um ID válido.')
                        .setTimestamp()
                    ]
                });
            }

            if (!bl[alvo.id]) {
                return msg.channel.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#27ae60')
                        .setAuthor({ name: 'RETH MORGAN — BLACKLIST CHECK', iconURL: botAvatar })
                        .setThumbnail(alvo.displayAvatarURL({ dynamic: true, size: 256 }))
                        .setTitle('✅ ALVO LIMPO — SEM REGISTRO')
                        .setDescription(`\`${alvo.tag}\` **não consta na lista negra.**\nAcesso ao bot liberado.`)
                        .setFooter({ text: `Shield System V8 • Operador: ${msg.author.tag}`, iconURL: execAvatar })
                        .setTimestamp()
                    ]
                });
            }

            const r = bl[alvo.id];
            const addedByUser = await client.users.fetch(r.addedBy).catch(() => null);

            return msg.channel.send({
                embeds: [new EmbedBuilder()
                    .setColor('#8B0000')
                    .setAuthor({ name: 'RETH MORGAN — FICHA DA LISTA NEGRA', iconURL: botAvatar })
                    .setThumbnail(alvo.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setTitle('🩸 FICHA DE REGISTRO — LISTA NEGRA')
                    .setDescription('```\n"Cada nome aqui tem uma história. Esta é a dele."\n```')
                    .addFields(
                        { name: '🎯 Alvo',           value: `<@${alvo.id}>\n\`${alvo.tag}\`\nID: \`${alvo.id}\``,                              inline: true },
                        { name: '👑 Inscrito por',   value: addedByUser ? `<@${addedByUser.id}>\n\`${addedByUser.tag}\`` : `\`${r.addedBy}\``, inline: true },
                        { name: '🏠 Servidor',       value: r.guildName ? `\`${r.guildName}\`` : '`Não registrado`',                           inline: true },
                        { name: '📋 Motivo',         value: r.motivo || 'Não registrado.',                                                     inline: false },
                        { name: '📅 Inscrito em',    value: `${formatarData(r.addedAt)} (${formatarDataR(r.addedAt)})`,                         inline: false },
                        { name: '🚫 Status',         value: '`BLOQUEADO GLOBALMENTE`',                                                          inline: true },
                    )
                    .setFooter({ text: `Shield System V8 • Operador: ${msg.author.tag}`, iconURL: execAvatar })
                    .setTimestamp()
                ]
            });
        }

        // ─────────────────────────────────────────────────────
        // ── LIST ──
        // ─────────────────────────────────────────────────────
        if (acao === 'list' || acao === 'ls') {
            const ids    = Object.keys(bl);
            const total  = ids.length;

            if (total === 0) {
                return msg.channel.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#8B0000')
                        .setAuthor({ name: 'RETH MORGAN — BLACKLIST GLOBAL', iconURL: botAvatar })
                        .setTitle('📋 LISTA NEGRA — VAZIA')
                        .setDescription('```\n"Nenhum alvo registrado. A sala de provas está limpa."\n```\nNenhum usuário banido globalmente no momento.')
                        .setFooter({ text: `Shield System V8 • Operador: ${msg.author.tag}`, iconURL: execAvatar })
                        .setTimestamp()
                    ]
                });
            }

            // Paginação: 10 por página
            const POR_PAGINA = 10;
            const totalPags  = Math.ceil(total / POR_PAGINA);
            let pagAtual     = 0;

            function gerarEmbedLista(pag) {
                const inicio = pag * POR_PAGINA;
                const slice  = ids.slice(inicio, inicio + POR_PAGINA);
                const linhas = slice.map((id, i) => {
                    const r   = bl[id];
                    const num = String(inicio + i + 1).padStart(2, '0');
                    return `\`${num}\` <@${id}> — \`${r.tag || id}\`\n↳ ${r.motivo?.slice(0, 50) || 'Sem motivo'} • ${formatarDataR(r.addedAt)}`;
                }).join('\n\n');

                return new EmbedBuilder()
                    .setColor('#8B0000')
                    .setAuthor({ name: 'RETH MORGAN — BLACKLIST GLOBAL', iconURL: botAvatar })
                    .setTitle(`🩸 LISTA NEGRA — ${total} REGISTRO${total !== 1 ? 'S' : ''}`)
                    .setDescription('```\n"Esses nomes escolheram o lado errado."\n```\n' + linhas)
                    .setFooter({ text: `Página ${pag + 1}/${totalPags} • Shield System V8 • Operador: ${msg.author.tag}`, iconURL: execAvatar })
                    .setTimestamp();
            }

            function gerarBotoes(pag) {
                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('bl_prev').setLabel('◀ Anterior').setStyle(ButtonStyle.Secondary).setDisabled(pag === 0),
                    new ButtonBuilder().setCustomId('bl_page').setLabel(`${pag + 1} / ${totalPags}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
                    new ButtonBuilder().setCustomId('bl_next').setLabel('Próxima ▶').setStyle(ButtonStyle.Secondary).setDisabled(pag >= totalPags - 1),
                );
            }

            const listaMsg = await msg.channel.send({
                embeds: [gerarEmbedLista(0)],
                components: totalPags > 1 ? [gerarBotoes(0)] : []
            });

            if (totalPags <= 1) return;

            const colLista = listaMsg.createMessageComponentCollector({
                filter: i => i.user.id === msg.author.id,
                time: 2 * 60_000
            });

            colLista.on('collect', async (i) => {
                if (i.customId === 'bl_next' && pagAtual < totalPags - 1) pagAtual++;
                if (i.customId === 'bl_prev' && pagAtual > 0) pagAtual--;
                await i.update({ embeds: [gerarEmbedLista(pagAtual)], components: [gerarBotoes(pagAtual)] });
            });
            colLista.on('end', () => { listaMsg.edit({ components: [] }).catch(() => {}); });

            return;
        }

        // ─────────────────────────────────────────────────────
        // ── WIPE ──
        // ─────────────────────────────────────────────────────
        if (acao === 'wipe') {
            const total = Object.keys(bl).length;
            if (total === 0) {
                return msg.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('#8B0000')
                        .setDescription('📋 A lista negra já está vazia. Nada a apagar.')
                        .setTimestamp()
                    ]
                });
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('wipe_confirm').setLabel(`🗑️ APAGAR ${total} REGISTROS`).setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('wipe_cancel').setLabel('CANCELAR').setStyle(ButtonStyle.Secondary),
            );

            const wipeMsg = await msg.channel.send({
                embeds: [new EmbedBuilder()
                    .setColor('#8B0000')
                    .setAuthor({ name: 'RETH MORGAN — OPERAÇÃO DESTRUTIVA', iconURL: botAvatar })
                    .setTitle('⚠️ WIPE DA BLACKLIST')
                    .setDescription(
                        '```\n"Limpar os registros é uma decisão irreversível."\n```\n' +
                        `Isso irá apagar **${total} registro${total !== 1 ? 's'  : ''}** permanentemente.\n\n` +
                        '**Esta ação não pode ser desfeita.** Confirme apenas se tiver certeza.'
                    )
                    .setFooter({ text: 'Confirme em 20 segundos.', iconURL: execAvatar })
                    .setTimestamp()
                ],
                components: [row]
            });

            const colWipe = wipeMsg.createMessageComponentCollector({
                filter: i => i.user.id === msg.author.id,
                max: 1, time: 20_000
            });

            colWipe.on('collect', async (i) => {
                if (i.customId === 'wipe_cancel') {
                    await i.update({ embeds: [new EmbedBuilder().setColor('#2a2a2a').setDescription('🚫 Wipe cancelado.').setTimestamp()], components: [] });
                    return;
                }
                salvarBlacklist({});
                await i.update({
                    embeds: [new EmbedBuilder()
                        .setColor('#27ae60')
                        .setAuthor({ name: 'RETH MORGAN — BLACKLIST', iconURL: botAvatar })
                        .setTitle('🗑️ BLACKLIST APAGADA COM SUCESSO')
                        .setDescription(`**${total} registro${total !== 1 ? 's' : ''}** foram removidos permanentemente.\nA lista negra está vazia.`)
                        .setFooter({ text: `Operação realizada por ${msg.author.tag}`, iconURL: execAvatar })
                        .setTimestamp()
                    ],
                    components: []
                });
            });

            colWipe.on('end', (col) => {
                if (col.size === 0) wipeMsg.edit({ components: [] }).catch(() => {});
            });

            return;
        }

        // ─────────────────────────────────────────────────────
        // ── AÇÃO DESCONHECIDA ──
        // ─────────────────────────────────────────────────────
        return msg.reply({
            embeds: [new EmbedBuilder()
                .setColor('#8B0000')
                .setDescription(
                    `❌ **Ação \`${acao}\` desconhecida.**\n\n` +
                    'Use `r!bl help` para ver todos os comandos disponíveis.'
                )
                .setTimestamp()
            ]
        });
    }
};
