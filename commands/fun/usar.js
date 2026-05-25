'use strict';
// commands/fun/usar.js
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const bonus = require('../../lib/bonus');

const NAO_ATIVAVEIS = new Set([
    'banner', 'emoji_custom', 'moldura', 'slot_extra', 'renomear',
    'jackpot', 'loot_box', 'reset_cd',
]);

const ITEM_LABELS = {
    vip: '👑 VIP Tag', mvp: '🌟 MVP Tag', lenda: '🔱 Lenda Tag',
    og: '💎 OG Tag', streamer: '🎮 Streamer Tag',
    xp2x_1h: '⚡ XP 2x (1h)', xp2x_6h: '⚡ XP 2x (6h)', xp2x_24h: '⚡ XP 2x (24h)',
    xp3x_1h: '🔥 XP 3x (1h)', xp5x_30m: '💥 XP 5x (30min)',
    escudo: '🛡️ Escudo', escudo_plus: '🔰 Escudo Plus', cofre: '🏦 Cofre',
    invisivel: '👻 Capa Invisível', armadura: '⚔️ Armadura Completa',
    amuleto: '🍀 Amuleto', ferradura: '🐴 Ferradura', trevo4: '☘️ Trevo 4 Folhas',
    dado_ouro: '🎲 Dado de Ouro', estrela_cad: '⭐ Estrela Cadente',
    cor_nome: '🎨 Cor Personalizada', titulo: '📛 Título Customizado',
    reset_cd: '⏰ Reset Cooldown', xp_bonus: '📈 Bônus de Nível',
    coins_bag: '💰 Bolsa de Coins', deus: '⚡ Modo Deus',
    jackpot: '🎯 Jackpot Token', roubo_perfeito: '🦊 Kit Ladrão Elite',
    loot_box: '📦 Loot Box Lendária', assinatura: '🏆 Assinatura Premium',
    banner: '🖼️ Banner de Perfil', emoji_custom: '😎 Emoji Exclusivo',
    moldura: '🖌️ Moldura de Avatar', slot_extra: '🎰 Slot Extra',
    renomear: '✏️ Renomear',
};

function resultadoEmbed(itemId, resultado) {
    const nome  = ITEM_LABELS[itemId] ?? itemId;
    const embed = new EmbedBuilder().setColor('#2ecc71').setTitle('✅ Item Ativado!');
    let desc    = `**${nome}** foi ativado com sucesso!`;

    if (resultado.efeito === 'estrela') {
        desc = `⭐ A estrela cadente te trouxe **+${resultado.premio} coins**!`;
        embed.setColor('#f1c40f');
    } else if (resultado.efeito === 'coins_bag') {
        desc = `💰 A bolsa continha **+${resultado.premio} coins**!`;
    } else if (resultado.efeito === 'xp_bonus') {
        desc = `📈 Você recebeu **+${resultado.premio} XP** instantaneamente!`;
    } else if (resultado.expira) {
        const restante = bonus._formatarTempo(resultado.expira - Date.now());
        desc += `\n⏱️ Expira em: \`${restante}\``;
    } else if (resultado.expira === null) {
        desc += '\n🔁 Uso único — será consumido quando acionado.';
    }

    if (['vip', 'mvp', 'lenda', 'og', 'streamer'].includes(itemId))
        desc = `🏷️ Tag **${nome}** adicionada ao seu perfil!`;
    if (itemId === 'cor_nome')
        desc = '🎨 Cor desbloqueada! Use `d!perfil cor #RRGGBB` para definir a cor.';
    if (itemId === 'titulo')
        desc = '📛 Título desbloqueado! Use `d!perfil titulo <texto>` para definir.';

    embed.setDescription(desc);
    return embed;
}

function embedInventario(todosItens, itensDisp) {
    const linhas = todosItens.map(([id, qtd]) => {
        const label    = ITEM_LABELS[id] ?? id;
        const passivo  = NAO_ATIVAVEIS.has(id);
        const status   = passivo ? '`passivo`' : '`ativável`';
        return `${label} ×**${qtd}** — ${status}`;
    });

    return new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('🎒 Inventário')
        .setDescription(linhas.join('\n'))
        .setFooter({
            text: itensDisp.length
                ? 'Selecione um item ativável abaixo · d!usar <item>'
                : 'Todos os seus itens são passivos/cosméticos — já estão aplicados no perfil',
        });
}

module.exports = {
    name: 'usar',
    aliases: ['use', 'ativar', 'equipar'],
    execute: async (msg, args) => {
        const gid = msg.guild.id;
        const uid = msg.author.id;

        const dados = bonus.ler();
        bonus.garantir(dados, gid, uid);
        const u = dados[gid][uid];

        const inv        = u.inventario ?? {};
        const todosItens = Object.entries(inv).filter(([, qtd]) => qtd > 0);
        const itensDisp  = todosItens.filter(([id]) => !NAO_ATIVAVEIS.has(id));

        // Inventário completamente vazio
        if (!todosItens.length)
            return msg.reply('🎒 Seu inventário está vazio! Compre itens em `d!loja`.');

        // Argumento direto: d!usar escudo
        if (args[0]) {
            const itemId = args[0].toLowerCase();
            const qtd    = inv[itemId] ?? 0;

            if (qtd <= 0)
                return msg.reply(`❌ Você não tem **${ITEM_LABELS[itemId] ?? itemId}** no inventário!`);

            if (NAO_ATIVAVEIS.has(itemId))
                return msg.reply(`❌ **${ITEM_LABELS[itemId] ?? itemId}** é um item passivo e já está aplicado no seu perfil.`);

            const resultado = bonus.ativar(gid, uid, itemId);
            if (!resultado.ok) return msg.reply(`❌ ${resultado.motivo}`);

            return msg.reply({ embeds: [resultadoEmbed(itemId, resultado)] });
        }

        // Só tem itens passivos — mostra inventário sem select
        if (!itensDisp.length)
            return msg.reply({ embeds: [embedInventario(todosItens, itensDisp)] });

        // Monta select com itens ativáveis
        const opcoes = itensDisp.slice(0, 25).map(([id, qtd]) => ({
            label: (ITEM_LABELS[id] ?? id).replace(/\p{Emoji}/gu, '').trim() || id,
            description: `${qtd}x no inventário`,
            value: id,
            emoji: (ITEM_LABELS[id] ?? '').match(/(\p{Emoji})/u)?.[1] ?? undefined,
        }));

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('usar_item')
                .setPlaceholder('Selecione um item para ativar...')
                .addOptions(opcoes),
        );

        const m = await msg.reply({
            embeds: [embedInventario(todosItens, itensDisp)],
            components: [row],
        });

        const collector = m.createMessageComponentCollector({
            filter: i => i.user.id === uid,
            time: 30_000,
        });

        collector.on('collect', async i => {
            const itemId    = i.values[0];
            const resultado = bonus.ativar(gid, uid, itemId);

            if (!resultado.ok) {
                await i.update({ content: `❌ ${resultado.motivo}`, embeds: [], components: [] });
                return;
            }

            await i.update({ embeds: [resultadoEmbed(itemId, resultado)], components: [] });
        });

        collector.on('end', () => m.edit({ components: [] }).catch(() => {}));
    },
};