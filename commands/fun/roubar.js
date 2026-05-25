'use strict';
// commands/fun/roubar.js
const { EmbedBuilder } = require('discord.js');
const bonus = require('../../lib/bonus');

const cooldowns = new Map();
const CD = 30 * 60 * 1000; // 30 minutos

module.exports = {
    name: 'roubar',
    aliases: ['steal', 'furtar'],
    execute: async (msg) => {
        const alvo = msg.mentions.users.first();
        if (!alvo)
            return msg.reply('💰 Mencione quem quer roubar! Ex: `d!roubar @usuario`');
        if (alvo.id === msg.author.id)
            return msg.reply('😂 Você não pode se roubar!');
        if (alvo.bot)
            return msg.reply('🤖 Bots não têm coins pra roubar!');

        const agora = Date.now();
        const cd    = cooldowns.get(msg.author.id);
        if (cd && agora - cd < CD) {
            const restante = Math.ceil((CD - (agora - cd)) / 60_000);
            return msg.reply(`⏰ Você está sendo monitorado! Espere **${restante} minuto(s)**.`);
        }

        const gid = msg.guild.id;
        const uid = msg.author.id;

        const dados = bonus.ler();
        bonus.garantir(dados, gid, uid);
        bonus.garantir(dados, gid, alvo.id);

        const uAlvo    = dados[gid][alvo.id];
        const uLadrao  = dados[gid][uid];

        // ── Defesas do alvo ──────────────────────────────────────────────────

        // Invisível: ladrao nem sabe que ele existe
        if (bonus.estaInvisivel(gid, alvo.id)) {
            cooldowns.set(uid, agora);
            const embed = new EmbedBuilder()
                .setColor('#95a5a6')
                .setTitle('👻 Alvo Invisível!')
                .setDescription(`**${alvo.username}** está usando uma Capa Invisível — você não conseguiu nem encontrá-lo!`);
            return msg.reply({ embeds: [embed] });
        }

        // Armadura: bloqueio total
        if (bonus.temArmadura(gid, alvo.id)) {
            cooldowns.set(uid, agora);
            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('⚔️ Armadura Completa!')
                .setDescription(`**${alvo.username}** está usando uma Armadura Completa — seu ataque foi completamente bloqueado!`);
            return msg.reply({ embeds: [embed] });
        }

        const saldoAlvo = uAlvo.coins ?? 0;
        if (saldoAlvo < 10)
            return msg.reply(`💸 **${alvo.username}** está na miséria, não tem nada pra roubar!`);

        cooldowns.set(uid, agora);

        // ── Chance de sucesso ────────────────────────────────────────────────
        // Base 45% + bônus de sorte do ladrão
        const multSorte  = bonus.getMultSorte(gid, uid);
        const chanceBase = 0.45 * multSorte;
        const chance     = Math.min(chanceBase, 0.90); // cap 90%

        // Roubo perfeito: garante sucesso
        const perfeito = bonus.temRouboPerfeito(gid, uid);
        const sucesso  = perfeito || Math.random() < chance;

        if (sucesso) {
            // Calcula valor roubado
            let roubado = Math.floor(Math.random() * Math.min(saldoAlvo * 0.3, 500)) + 10;

            // Escudo do alvo: reduz o roubo à metade e consome o escudo
            let escudoAtivado = false;
            if (bonus.temEscudo(gid, alvo.id)) {
                roubado = Math.floor(roubado / 2);
                escudoAtivado = true;
            }

            // Cofre: protege até X coins
            const limiteCofre = bonus.getLimiteCofre(gid, alvo.id);
            if (limiteCofre !== null) {
                const protegido  = Math.min(saldoAlvo, limiteCofre);
                const disponivel = Math.max(0, saldoAlvo - protegido);
                if (disponivel < 10) {
                    const embed = new EmbedBuilder()
                        .setColor('#e67e22')
                        .setTitle('🏦 Cofre Blindado!')
                        .setDescription(`Os coins de **${alvo.username}** estão protegidos pelo Cofre — não sobrou nada acessível!`);
                    return msg.reply({ embeds: [embed] });
                }
                roubado = Math.min(roubado, disponivel);
            }

            uAlvo.coins   -= roubado;
            uLadrao.coins += roubado;
            bonus.salvar(dados);

            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle(`🦹 Roubo ${perfeito ? 'Perfeito! 🦊' : 'Bem-sucedido!'}`)
                .setDescription(
                    `Você roubou **${roubado} coins** de **${alvo.username}**! 💰` +
                    (escudoAtivado ? '\n🛡️ O escudo dele reduziu o valor pela metade!' : '') +
                    (perfeito ? '\n🦊 Kit Ladrão Elite usado — sucesso garantido!' : `\n📊 Chance de sucesso: \`${Math.floor(chance * 100)}%\``)
                )
                .addFields(
                    { name: '💰 Seu novo saldo', value: `\`${uLadrao.coins} 🪙\``, inline: true },
                );
            return msg.reply({ embeds: [embed] });

        } else {
            const multa = Math.floor(Math.random() * 150) + 20;
            uLadrao.coins = Math.max(0, (uLadrao.coins ?? 0) - multa);
            bonus.salvar(dados);

            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('👮 Você foi pego!')
                .setDescription(
                    `Você foi detido tentando roubar **${alvo.username}** e pagou **${multa} coins** de multa!\n` +
                    `📊 Chance de sucesso era: \`${Math.floor(chance * 100)}%\``
                )
                .addFields(
                    { name: '👛 Seu saldo', value: `\`${uLadrao.coins} 🪙\``, inline: true },
                );
            return msg.reply({ embeds: [embed] });
        }
    },
};