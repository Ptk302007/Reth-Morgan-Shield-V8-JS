'use strict';
// commands/fun/loja.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const bonus = require('../../lib/bonus');

const categorias = {
    status: {
        emoji: '👑', nome: 'Status & Tags',
        itens: [
            { id: 'vip',      nome: '👑 VIP Tag',        preco: 500,   desc: 'Tag especial de VIP no perfil' },
            { id: 'mvp',      nome: '🌟 MVP Tag',         preco: 1000,  desc: 'Tag exclusiva de MVP no perfil' },
            { id: 'lenda',    nome: '🔱 Lenda Tag',        preco: 2500,  desc: 'Tag rara de Lenda — prestígio máximo' },
            { id: 'og',       nome: '💎 OG Tag',           preco: 5000,  desc: 'Tag de veterano para os mais antigos' },
            { id: 'streamer', nome: '🎮 Streamer Tag',     preco: 800,   desc: 'Tag de streamer no seu perfil' },
        ],
    },
    boost: {
        emoji: '⚡', nome: 'Boosts de XP',
        itens: [
            { id: 'xp2x_1h',  nome: '⚡ XP 2x (1h)',      preco: 300,   desc: 'Dobra XP ganho por 1 hora' },
            { id: 'xp2x_6h',  nome: '⚡ XP 2x (6h)',      preco: 1200,  desc: 'Dobra XP ganho por 6 horas' },
            { id: 'xp2x_24h', nome: '⚡ XP 2x (24h)',     preco: 4000,  desc: 'Dobra XP ganho por 24 horas' },
            { id: 'xp3x_1h',  nome: '🔥 XP 3x (1h)',      preco: 700,   desc: 'Triplica XP por 1 hora' },
            { id: 'xp5x_30m', nome: '💥 XP 5x (30min)',   preco: 900,   desc: 'XP x5 por 30 minutos' },
        ],
    },
    protecao: {
        emoji: '🛡️', nome: 'Proteção & Defesa',
        itens: [
            { id: 'escudo',       nome: '🛡️ Escudo',          preco: 200,   desc: 'Bloqueia 1 roubo (uso único)' },
            { id: 'escudo_plus',  nome: '🔰 Escudo Plus',      preco: 500,   desc: 'Protege de roubos por 24h' },
            { id: 'cofre',        nome: '🏦 Cofre',            preco: 1500,  desc: 'Guarda até 5000 coins intocáveis por 7d' },
            { id: 'invisivel',    nome: '👻 Capa Invisível',   preco: 800,   desc: 'Invisível para roubos por 12h' },
            { id: 'armadura',     nome: '⚔️ Armadura Completa',preco: 2000,  desc: 'Imunidade total a roubos por 6h' },
        ],
    },
    sorte: {
        emoji: '🍀', nome: 'Sorte & Bônus',
        itens: [
            { id: 'amuleto',    nome: '🍀 Amuleto',          preco: 150,   desc: '+25% chance no roubo por 30min' },
            { id: 'ferradura',  nome: '🐴 Ferradura',        preco: 350,   desc: '+40% de sorte geral por 1h' },
            { id: 'trevo4',     nome: '☘️ Trevo 4 Folhas',   preco: 600,   desc: '+75% de sorte no roubo por 2h' },
            { id: 'dado_ouro',  nome: '🎲 Dado de Ouro',     preco: 400,   desc: '+50% ganho em apostas por 1h' },
            { id: 'estrela_cad',nome: '⭐ Estrela Cadente',  preco: 750,   desc: 'Evento imediato: 100-1000 coins' },
        ],
    },
    cosmeticos: {
        emoji: '🎨', nome: 'Cosméticos',
        itens: [
            { id: 'cor_nome',    nome: '🎨 Cor Personalizada', preco: 1000,  desc: 'Cor única no embed do seu perfil' },
            { id: 'banner',      nome: '🖼️ Banner de Perfil',  preco: 1500,  desc: 'Banner animado no perfil' },
            { id: 'titulo',      nome: '📛 Título Customizado',preco: 2000,  desc: 'Crie seu próprio título único' },
            { id: 'emoji_custom',nome: '😎 Emoji Exclusivo',   preco: 800,   desc: 'Acesso a emojis exclusivos' },
            { id: 'moldura',     nome: '🖌️ Moldura de Avatar', preco: 1200,  desc: 'Moldura especial no avatar' },
        ],
    },
    utilidade: {
        emoji: '🔧', nome: 'Utilidades',
        itens: [
            { id: 'reset_cd',   nome: '⏰ Reset Cooldown',   preco: 250,   desc: 'Reseta cooldown de qualquer comando' },
            { id: 'slot_extra', nome: '🎰 Slot Extra',       preco: 450,   desc: 'Slot extra no inventário' },
            { id: 'renomear',   nome: '✏️ Renomear',         preco: 300,   desc: 'Muda seu apelido no servidor' },
            { id: 'xp_bonus',   nome: '📈 Bônus de Nível',   preco: 3000,  desc: 'Ganha XP equivalente a 1 nível inteiro' },
            { id: 'coins_bag',  nome: '💰 Bolsa de Coins',   preco: 100,   desc: 'Abre uma bolsa com 100-500 coins' },
        ],
    },
    premium: {
        emoji: '💎', nome: 'Premium & Raros',
        itens: [
            { id: 'deus',           nome: '⚡ Modo Deus (1h)',       preco: 5000,  desc: 'XP x10 + Escudo + Sorte Max por 1h' },
            { id: 'jackpot',        nome: '🎯 Jackpot Token',         preco: 2500,  desc: 'Tente o jackpot do servidor' },
            { id: 'roubo_perfeito', nome: '🦊 Kit Ladrão Elite',      preco: 1800,  desc: '100% de sucesso no próximo roubo' },
            { id: 'loot_box',       nome: '📦 Loot Box Lendária',     preco: 1000,  desc: 'Item aleatório raro garantido' },
            { id: 'assinatura',     nome: '🏆 Assinatura Premium',    preco: 10000, desc: 'Todos os bônus por 7 dias' },
        ],
    },
};

const todosItens = Object.values(categorias).flatMap(c => c.itens);
const COR = {
    status: '#f1c40f', boost: '#e74c3c', protecao: '#3498db',
    sorte: '#2ecc71', cosmeticos: '#9b59b6', utilidade: '#1abc9c', premium: '#e67e22',
};

function embedCategoria(catKey, saldo) {
    const cat  = categorias[catKey];
    const keys = Object.keys(categorias);
    const idx  = keys.indexOf(catKey) + 1;
    const lista = cat.itens.map(i => `**${i.nome}** — \`${i.preco} coins\`\n↳ ${i.desc}`).join('\n\n');
    return new EmbedBuilder()
        .setColor(COR[catKey])
        .setTitle(`${cat.emoji} Loja — ${cat.nome}`)
        .setDescription(`💰 Saldo: **${saldo} 🪙**\n\n${lista}`)
        .setFooter({ text: `Categoria ${idx}/${keys.length} · Use o menu abaixo para comprar` });
}

function selectCompra(catKey) {
    const cat = categorias[catKey];
    return new StringSelectMenuBuilder()
        .setCustomId(`loja_comprar_${catKey}`)
        .setPlaceholder(`Comprar em ${cat.nome}...`)
        .addOptions(cat.itens.map(i => ({
            label: i.nome.replace(/\p{Emoji}/gu, '').trim() || i.id,
            description: `${i.preco} coins — ${i.desc.slice(0, 50)}`,
            value: i.id,
            emoji: i.nome.match(/(\p{Emoji})/u)?.[1] ?? undefined,
        })));
}

function navRow(catKey) {
    const keys = Object.keys(categorias);
    const idx  = keys.indexOf(catKey);
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`loja_prev_${catKey}`)
            .setLabel('◀')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(idx === 0),
        new ButtonBuilder()
            .setCustomId('loja_home')
            .setLabel('🏪 Menu')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`loja_next_${catKey}`)
            .setLabel('▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(idx === keys.length - 1),
    );
}

function embedHome(saldo) {
    return new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('🏪 Loja do Servidor')
        .setDescription(`💰 Seu saldo: **${saldo} 🪙**\n\nEscolha uma categoria:`)
        .addFields(
            Object.entries(categorias).map(([, cat]) => ({
                name: `${cat.emoji} ${cat.nome}`,
                value: `${cat.itens.length} itens`,
                inline: true,
            }))
        )
        .setFooter({ text: 'Use d!usar <item> para ativar itens do inventário' });
}

function selectHome() {
    return new StringSelectMenuBuilder()
        .setCustomId('loja_categoria')
        .setPlaceholder('Selecionar categoria...')
        .addOptions(
            Object.entries(categorias).map(([key, cat]) => ({
                label: cat.nome,
                description: `${cat.itens.length} itens disponíveis`,
                value: key,
                emoji: cat.emoji,
            }))
        );
}

module.exports = {
    name: 'loja',
    aliases: ['shop', 'comprar'],
    execute: async (msg) => {
        const gid = msg.guild.id;
        const uid = msg.author.id;

        const dados = bonus.ler();
        bonus.garantir(dados, gid, uid);

        const getSaldo = () => {
            const d = bonus.ler();
            return d[gid]?.[uid]?.coins ?? 0;
        };

        const m = await msg.reply({
            embeds: [embedHome(getSaldo())],
            components: [new ActionRowBuilder().addComponents(selectHome())],
        });

        let catAtual = null;

        const collector = m.createMessageComponentCollector({
            filter: i => i.user.id === uid,
            time: 90_000,
        });

        collector.on('collect', async i => {
            if (i.customId === 'loja_home') {
                catAtual = null;
                return i.update({
                    embeds: [embedHome(getSaldo())],
                    components: [new ActionRowBuilder().addComponents(selectHome())],
                });
            }

            if (i.customId === 'loja_categoria') {
                catAtual = i.values[0];
                return i.update({
                    embeds: [embedCategoria(catAtual, getSaldo())],
                    components: [
                        new ActionRowBuilder().addComponents(selectCompra(catAtual)),
                        navRow(catAtual),
                    ],
                });
            }

            if (i.customId.startsWith('loja_prev_') || i.customId.startsWith('loja_next_')) {
                const keys = Object.keys(categorias);
                const idx  = keys.indexOf(catAtual);
                catAtual   = i.customId.startsWith('loja_prev_') ? keys[idx - 1] : keys[idx + 1];
                return i.update({
                    embeds: [embedCategoria(catAtual, getSaldo())],
                    components: [
                        new ActionRowBuilder().addComponents(selectCompra(catAtual)),
                        navRow(catAtual),
                    ],
                });
            }

            if (i.customId.startsWith('loja_comprar_')) {
                const itemId = i.values[0];
                const item   = todosItens.find(it => it.id === itemId);
                if (!item) return;

                const d = bonus.ler();
                bonus.garantir(d, gid, uid);
                const u = d[gid][uid];

                if ((u.coins ?? 0) < item.preco) {
                    return i.reply({
                        content: `❌ Coins insuficientes! Você tem \`${u.coins ?? 0} 🪙\` e precisa de \`${item.preco} 🪙\`.`,
                        ephemeral: true,
                    });
                }

                d[gid][uid].coins -= item.preco;
                d[gid][uid].inventario ??= {};
                d[gid][uid].inventario[itemId] = (d[gid][uid].inventario[itemId] ?? 0) + 1;
                bonus.salvar(d);

                const novoSaldo = d[gid][uid].coins;

                await i.update({
                    embeds: [embedCategoria(catAtual, novoSaldo)],
                    components: [
                        new ActionRowBuilder().addComponents(selectCompra(catAtual)),
                        navRow(catAtual),
                    ],
                });

                await msg.channel.send(
                    `✅ <@${uid}> comprou **${item.nome}** por \`${item.preco} 🪙\`! ` +
                    `Saldo: \`${novoSaldo} 🪙\` · Use \`d!usar ${itemId}\` para ativar.`
                );
            }
        });

        collector.on('end', () => m.edit({ components: [] }).catch(() => {}));
    },
};