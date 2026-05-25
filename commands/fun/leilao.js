'use strict';
// commands/fun/leilao.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const bonus = require('../../lib/bonus');

// Leilões ativos por servidor: Map<guildId, leilaoObj>
const leiloesAtivos = new Map();

function embedLeilao(leilao, restante) {
    return new EmbedBuilder()
        .setColor('#f1c40f')
        .setTitle(`🔨 LEILÃO — ${leilao.item}`)
        .addFields(
            { name: '🏷️ Item',          value: leilao.item,                                                  inline: true  },
            { name: '💰 Lance Atual',    value: `\`${leilao.lanceAtual} 🪙\``,                               inline: true  },
            { name: '👤 Liderando',      value: leilao.liderId ? `<@${leilao.liderId}>` : '`Nenhum ainda`',  inline: true  },
            { name: '⏳ Tempo',          value: `\`${restante}s restantes\``,                                 inline: true  },
            { name: '📊 Lance Mínimo',   value: `\`${leilao.lanceMinimo} 🪙\``,                              inline: true  },
            { name: '🔢 Total de Lances',value: `\`${leilao.totalLances ?? 0}\``,                            inline: true  },
        )
        .setFooter({ text: 'Use d!leilao dar <valor> para dar um lance!' })
        .setTimestamp();
}

module.exports = {
    name: 'leilao',
    aliases: ['auction'],
    execute: async (msg, args, client) => {
        const gid = msg.guild.id;
        const sub = (args[0] || '').toLowerCase();

        // ── Ver leilão ativo ─────────────────────────────────────────────────
        if (!sub || sub === 'ver') {
            const leilao = leiloesAtivos.get(gid);
            if (!leilao)
                return msg.reply('📭 Não há nenhum leilão ativo no momento.');

            const restante = Math.max(0, Math.ceil((leilao.termina - Date.now()) / 1000));
            return msg.reply({ embeds: [embedLeilao(leilao, restante)] });
        }

        // ── Criar leilão ─────────────────────────────────────────────────────
        if (sub === 'criar') {
            if (!msg.member.permissions.has('ManageMessages'))
                return msg.reply('❌ Apenas moderadores podem criar leilões!');
            if (leiloesAtivos.has(gid))
                return msg.reply('❌ Já há um leilão ativo! Aguarde terminar.');

            const lanceMin = parseInt(args[1]);
            const duracao  = parseInt(args[2]) || 60; // segundos, padrão 60
            const item     = args.slice(3).join(' ') || args.slice(2).join(' ');

            // Tenta detectar se o 2º arg é duração ou parte do nome
            const duracaoReal = isNaN(parseInt(args[2])) ? 60 : parseInt(args[2]);
            const itemNome    = isNaN(parseInt(args[2]))
                ? args.slice(2).join(' ')
                : args.slice(3).join(' ');

            if (isNaN(lanceMin) || lanceMin <= 0 || !itemNome)
                return msg.reply('❌ Use: `d!leilao criar <lance_mínimo> [duração_segundos] <nome do item>`');

            const termina = Date.now() + duracaoReal * 1000;
            const leilao  = {
                item: itemNome,
                lanceMinimo: lanceMin,
                lanceAtual:  lanceMin,
                liderId:     null,
                termina,
                totalLances: 0,
                criadorId:   msg.author.id,
            };
            leiloesAtivos.set(gid, leilao);

            const embed = new EmbedBuilder()
                .setColor('#e67e22')
                .setTitle(`🔨 LEILÃO INICIADO — ${itemNome}`)
                .setDescription(
                    `Lance mínimo: \`${lanceMin} 🪙\`\n` +
                    `Duração: \`${duracaoReal} segundos\`\n\n` +
                    `Use \`d!leilao dar <valor>\` para dar um lance!`
                )
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('leilao_ver')
                    .setLabel('👁️ Ver Leilão')
                    .setStyle(ButtonStyle.Secondary),
            );

            await msg.channel.send({ embeds: [embed], components: [row] });

            // Atualização a cada 15s
            const intervalo = setInterval(async () => {
                const l = leiloesAtivos.get(gid);
                if (!l) return clearInterval(intervalo);
                const restante = Math.max(0, Math.ceil((l.termina - Date.now()) / 1000));
                if (restante <= 0) clearInterval(intervalo);
            }, 15_000);

            // Finalizar após duração
            setTimeout(async () => {
                clearInterval(intervalo);
                const l = leiloesAtivos.get(gid);
                leiloesAtivos.delete(gid);

                if (!l?.liderId)
                    return msg.channel.send('📭 O leilão terminou sem nenhum lance válido!');

                // Deduz coins do vencedor
                const dados = bonus.ler();
                bonus.garantir(dados, gid, l.liderId);
                const u = dados[gid][l.liderId];

                if ((u.coins ?? 0) < l.lanceAtual) {
                    return msg.channel.send(
                        `❌ <@${l.liderId}> não tinha coins suficientes para pagar! Leilão cancelado.`
                    );
                }

                u.coins -= l.lanceAtual;
                bonus.salvar(dados);

                const embedFim = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('🏆 LEILÃO ENCERRADO!')
                    .setDescription(
                        `<@${l.liderId}> venceu o leilão de **${l.item}** com \`${l.lanceAtual} 🪙\`!\n` +
                        `Total de lances: \`${l.totalLances}\``
                    )
                    .setTimestamp();

                return msg.channel.send({ content: `<@${l.liderId}>`, embeds: [embedFim] });
            }, duracaoReal * 1000);

            return;
        }

        // ── Dar lance ────────────────────────────────────────────────────────
        if (sub === 'dar') {
            const leilao = leiloesAtivos.get(gid);
            if (!leilao) return msg.reply('📭 Não há nenhum leilão ativo!');

            const lance = parseInt(args[1]);
            if (isNaN(lance) || lance <= 0)
                return msg.reply('❌ Use: `d!leilao dar <valor>`');
            if (lance <= leilao.lanceAtual)
                return msg.reply(`❌ Seu lance precisa superar o atual: \`${leilao.lanceAtual} 🪙\``);
            if (msg.author.id === leilao.liderId)
                return msg.reply('❌ Você já lidera o leilão!');

            const dados = bonus.ler();
            bonus.garantir(dados, gid, msg.author.id);
            const u = dados[gid][msg.author.id];

            if ((u.coins ?? 0) < lance)
                return msg.reply(`❌ Você não tem \`${lance} 🪙\`! Saldo: \`${u.coins ?? 0} 🪙\``);

            const anteriorId = leilao.liderId;
            leilao.lanceAtual  = lance;
            leilao.liderId     = msg.author.id;
            leilao.totalLances = (leilao.totalLances ?? 0) + 1;
            leiloesAtivos.set(gid, leilao);

            const restante = Math.max(0, Math.ceil((leilao.termina - Date.now()) / 1000));

            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('💸 Novo Lance!')
                .setDescription(
                    `<@${msg.author.id}> deu um lance de \`${lance} 🪙\` em **${leilao.item}**!` +
                    (anteriorId ? `\n<@${anteriorId}> foi superado!` : '')
                )
                .addFields({ name: '⏳ Tempo Restante', value: `\`${restante}s\``, inline: true })
                .setTimestamp();

            return msg.channel.send({
                content: anteriorId ? `<@${anteriorId}>` : undefined,
                embeds: [embed],
            });
        }

        // ── Cancelar leilão ──────────────────────────────────────────────────
        if (sub === 'cancelar') {
            if (!msg.member.permissions.has('ManageMessages'))
                return msg.reply('❌ Apenas moderadores podem cancelar leilões!');
            if (!leiloesAtivos.has(gid))
                return msg.reply('📭 Não há nenhum leilão ativo!');

            leiloesAtivos.delete(gid);
            return msg.reply('✅ Leilão cancelado com sucesso.');
        }

        return msg.reply(
            '❌ Subcomandos disponíveis:\n' +
            '`d!leilao ver` — ver leilão ativo\n' +
            '`d!leilao criar <min> [duração] <item>` — criar leilão\n' +
            '`d!leilao dar <valor>` — dar lance\n' +
            '`d!leilao cancelar` — cancelar (mods)'
        );
    },
};