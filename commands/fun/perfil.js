'use strict';
// commands/fun/perfil.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const bonus = require('../../lib/bonus');

const TAG_LABELS = {
    vip:      '👑 VIP',
    mvp:      '🌟 MVP',
    lenda:    '🔱 Lenda',
    og:       '💎 OG',
    streamer: '🎮 Streamer',
};

const ITEM_LABELS = {
    vip: '👑 VIP Tag', mvp: '🌟 MVP Tag', lenda: '🔱 Lenda Tag',
    og: '💎 OG Tag', streamer: '🎮 Streamer Tag',
    xp2x_1h: '⚡ XP 2x (1h)', xp2x_6h: '⚡ XP 2x (6h)', xp2x_24h: '⚡ XP 2x (24h)',
    xp3x_1h: '🔥 XP 3x (1h)', xp5x_30m: '💥 XP 5x (30min)',
    escudo: '🛡️ Escudo', escudo_plus: '🔰 Escudo Plus', cofre: '🏦 Cofre',
    invisivel: '👻 Capa Invisível', armadura: '⚔️ Armadura Completa',
    amuleto: '🍀 Amuleto', ferradura: '🐴 Ferradura', trevo4: '☘️ Trevo 4 Folhas',
    dado_ouro: '🎲 Dado de Ouro', estrela_cad: '⭐ Estrela Cadente',
    cor_nome: '🎨 Cor Personalizada', banner: '🖼️ Banner', titulo: '📛 Título',
    emoji_custom: '😎 Emoji Exclusivo', moldura: '🖌️ Moldura',
    reset_cd: '⏰ Reset CD', slot_extra: '🎰 Slot Extra', renomear: '✏️ Renomear',
    xp_bonus: '📈 Bônus de Nível', coins_bag: '💰 Bolsa de Coins',
    deus: '⚡ Modo Deus', jackpot: '🎯 Jackpot Token', roubo_perfeito: '🦊 Kit Ladrão',
    loot_box: '📦 Loot Box', assinatura: '🏆 Assinatura Premium',
};

function buildEmbedPerfil(alvo, member, u, gid) {
    const xpProximo = u.nivel * 100;
    const xpAtual   = u.xp % xpProximo;
    const progresso = Math.floor(xpAtual / xpProximo * 12);
    const barra     = '▰'.repeat(progresso) + '▱'.repeat(12 - progresso);

    // Tags e título
    const tags = bonus.getTags(gid, alvo.id);
    const cosm = bonus.getCosmeticos(gid, alvo.id);
    const tagStr  = tags.length ? tags.map(t => TAG_LABELS[t] ?? t).join(' · ') : '`Nenhuma`';
    const tituloStr = cosm.titulo ? `*"${cosm.titulo}"*` : null;

    // Bônus ativos
    const bonusAtivos = bonus.listarBonusAtivos(gid, alvo.id);
    const bonusStr = bonusAtivos.length
        ? bonusAtivos.join('\n')
        : '`Nenhum bônus ativo`';

    // Inventário
    const inv = u.inventario ?? {};
    const invEntradas = Object.entries(inv).filter(([, qtd]) => qtd > 0);
    const invStr = invEntradas.length
        ? invEntradas.map(([id, qtd]) => `${ITEM_LABELS[id] ?? id} ×${qtd}`).join('\n')
        : '`Inventário vazio`';

    // Cor do embed: cor_nome do usuário ou padrão por nível
    const corEmbed = cosm.cor_nome
        ?? (u.nivel >= 50 ? '#f1c40f' : u.nivel >= 20 ? '#9b59b6' : u.nivel >= 10 ? '#3498db' : '#2ecc71');

    const embed = new EmbedBuilder()
        .setColor(corEmbed)
        .setAuthor({
            name: tituloStr
                ? `${alvo.username} — ${cosm.titulo}`
                : alvo.username,
            iconURL: alvo.displayAvatarURL({ dynamic: true }),
        })
        .setThumbnail(alvo.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
            {
                name: '🏅 Tags',
                value: tagStr,
                inline: false,
            },
            {
                name: '⭐ Nível',
                value: `\`${u.nivel}\``,
                inline: true,
            },
            {
                name: '✨ XP',
                value: `\`${xpAtual} / ${xpProximo}\``,
                inline: true,
            },
            {
                name: '💰 Coins',
                value: `\`${u.coins ?? 0} 🪙\``,
                inline: true,
            },
            {
                name: '🏦 Banco',
                value: `\`${u.banco ?? 0} 🪙\``,
                inline: true,
            },
            {
                name: '📊 Progresso',
                value: `\`[${barra}]\` ${Math.floor(xpAtual / xpProximo * 100)}%`,
                inline: false,
            },
            {
                name: '⚡ Bônus Ativos',
                value: bonusStr,
                inline: false,
            },
            {
                name: `🎒 Inventário (${invEntradas.length} ${invEntradas.length === 1 ? 'item' : 'itens'})`,
                value: invStr,
                inline: false,
            },
        )
        .setFooter({
            text: `Membro desde ${member?.joinedAt?.toLocaleDateString('pt-BR') ?? '?'} · Use d!usar <item> para ativar bônus`,
        });

    return embed;
}

module.exports = {
    name: 'perfil',
    aliases: ['profile', 'rank', 'nivel'],
    execute: async (msg, args) => {
        const alvo = msg.mentions.users.first() || msg.author;
        const dados = bonus.ler();
        const gid   = msg.guild.id;
        bonus.garantir(dados, gid, alvo.id);
        const u = dados[gid][alvo.id];

        const member = await msg.guild.members.fetch(alvo.id).catch(() => null);

        // Subcomandos: d!perfil titulo <texto> | d!perfil cor #hex
        const sub = args[0]?.toLowerCase();

        if (sub === 'titulo' && alvo.id === msg.author.id) {
            const texto = args.slice(1).join(' ').trim();
            if (!texto) return msg.reply('❌ Use: `d!perfil titulo <seu título>`');
            const r = bonus.setTitulo(gid, msg.author.id, texto);
            return msg.reply(r.ok ? `✅ Título definido para: *"${texto}"*` : `❌ ${r.motivo}`);
        }

        if (sub === 'cor' && alvo.id === msg.author.id) {
            const hex = args[1];
            if (!hex) return msg.reply('❌ Use: `d!perfil cor #RRGGBB`');
            const r = bonus.setCor(gid, msg.author.id, hex);
            return msg.reply(r.ok ? `✅ Cor do perfil definida para \`${hex}\`!` : `❌ ${r.motivo}`);
        }

        const embed = buildEmbedPerfil(alvo, member, u, gid);

        // Botão de inventário rápido só pra dono do perfil
        const components = [];
        if (alvo.id === msg.author.id) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('perfil_atualizar')
                    .setLabel('🔄 Atualizar')
                    .setStyle(ButtonStyle.Secondary),
            );
            components.push(row);
        }

        const m = await msg.reply({ embeds: [embed], components });

        if (!components.length) return;

        const collector = m.createMessageComponentCollector({
            filter: i => i.user.id === msg.author.id && i.customId === 'perfil_atualizar',
            time: 60_000,
        });

        collector.on('collect', async i => {
            const dadosNovos = bonus.ler();
            bonus.garantir(dadosNovos, gid, alvo.id);
            const uNovo = dadosNovos[gid][alvo.id];
            await i.update({ embeds: [buildEmbedPerfil(alvo, member, uNovo, gid)] });
        });

        collector.on('end', () => m.edit({ components: [] }).catch(() => {}));
    },
};