'use strict';
// commands/fun/missao.js
const { EmbedBuilder } = require('discord.js');
const bonus = require('../../lib/bonus');

const MISSOES = [
    { nome: '💬 Comunicador',  desc: 'Envie mensagens no servidor hoje',       recompensa: 150 },
    { nome: '🔍 Explorador',   desc: 'Use 5 comandos diferentes',              recompensa: 175 },
    { nome: '❤️ Apoiador',     desc: 'Reaja em mensagens dos outros',          recompensa: 120 },
    { nome: '🤝 Social',       desc: 'Mencione 3 pessoas diferentes',          recompensa: 200 },
    { nome: '⏰ Veterano',     desc: 'Fique online por 30 minutos',            recompensa: 250 },
    { nome: '🎯 Caçador',      desc: 'Encontre o número secreto (1–10)',       recompensa: 300 },
    { nome: '🌟 Destaque',     desc: 'Receba 3 reações positivas hoje',        recompensa: 220 },
    { nome: '🧠 Curioso',      desc: 'Faça uma pergunta no canal de dúvidas',  recompensa: 180 },
    { nome: '🎮 Jogador',      desc: 'Use d!apostas ou d!leilao hoje',         recompensa: 200 },
    { nome: '💰 Investidor',   desc: 'Deposite coins no banco hoje',           recompensa: 160 },
];

module.exports = {
    name: 'missao',
    aliases: ['missoes', 'daily', 'tarefa'],
    execute: async (msg) => {
        const gid = msg.guild.id;
        const uid = msg.author.id;

        const dados = bonus.ler();
        bonus.garantir(dados, gid, uid);
        const u = dados[gid][uid];

        const agora   = Date.now();
        const umDia   = 24 * 60 * 60 * 1000;
        const ultima  = u.ultimaMissao ?? 0;

        if (agora - ultima < umDia) {
            const restante = umDia - (agora - ultima);
            const h = Math.floor(restante / 3_600_000);
            const m = Math.floor((restante % 3_600_000) / 60_000);
            return msg.reply(`⏳ Você já completou sua missão diária! Próxima em: \`${h}h ${m}min\``);
        }

        const missao   = MISSOES[Math.floor(Math.random() * MISSOES.length)];
        const bonusAle = Math.floor(Math.random() * 100);
        const base     = missao.recompensa + bonusAle;

        // Aplica multiplicador de XP ativo (bônus da loja)
        const multXP   = bonus.getMultXP(gid, uid);
        const xpGanho  = Math.floor(50 * multXP);   // XP fixo por missão × mult

        u.coins      += base;
        u.xp         += xpGanho;
        u.ultimaMissao = agora;

        // Level up
        let levelUp = false;
        const xpProximo = u.nivel * 100;
        if (u.xp >= u.nivel * 100 + xpProximo) {
            u.nivel++;
            levelUp = true;
        }

        bonus.salvar(dados);

        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('🎯 MISSÃO DIÁRIA COMPLETADA!')
            .addFields(
                { name: '📋 Missão',      value: `**${missao.nome}** — ${missao.desc}`, inline: false },
                { name: '💰 Recompensa',  value: `\`${missao.recompensa} 🪙\``,          inline: true  },
                { name: '🎁 Bônus',       value: `\`+${bonusAle} 🪙\``,                  inline: true  },
                { name: '✨ Total',        value: `\`${base} 🪙\``,                       inline: true  },
                {
                    name: `⚡ XP Ganho${multXP > 1 ? ` (×${multXP})` : ''}`,
                    value: `\`+${xpGanho} XP\``,
                    inline: true,
                },
                { name: '👛 Saldo Atual', value: `\`${u.coins} 🪙\``,                    inline: true  },
            )
            .setFooter({ text: 'Volte amanhã para uma nova missão!' })
            .setTimestamp();

        if (levelUp) {
            embed.addFields({ name: '🎉 LEVEL UP!', value: `Você chegou ao nível **${u.nivel}**!`, inline: false });
        }

        return msg.reply({ embeds: [embed] });
    },
};