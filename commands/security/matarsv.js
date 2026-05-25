// commands/security/nuke.js
// Requer: discord.js v14+, Node 18+
'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const DELAY_DELETE = 300; // ms entre deleções de canal

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function tempMsg(channel, content, ms = 6000) {
    const m = await channel.send({ content }).catch(() => null);
    if (m) setTimeout(() => m.delete().catch(() => {}), ms);
}

module.exports = {
    name: 'nuke',
    aliases: ['destruir', 'clearserver', 'boom'],

    execute: async (msg, args, client, OWNER_ID) => {
        const { guild, author, channel } = msg;

        // ── Bloqueio de segurança ────────────────────────────────────────────
        if (author.id !== OWNER_ID) {
            const embedNegado = new EmbedBuilder()
                .setColor('#f53b57')
                .setTitle('🛑 ACESSO NEGADO')
                .setDescription('Este protocolo é de uso exclusivo do **Desenvolvedor Supremo**.\nSua tentativa foi registrada.')
                .setTimestamp();
            return msg.reply({ embeds: [embedNegado] });
        }

        // ── Painel de confirmação ────────────────────────────────────────────
        const embedAviso = new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle('☢️ PROTOCOLO NUKE — CONFIRMAÇÃO NECESSÁRIA')
            .setDescription(
                '> Você está prestes a **destruir toda a estrutura de canais** deste servidor.\n\n' +
                '**O que será executado:**\n' +
                '`1.` Notificação ao dono do servidor via DM\n' +
                '`2.` Deleção de todos os canais existentes\n' +
                '`3.` Criação do canal de operação pós-nuke\n\n' +
                '⚠️ **Esta ação é irreversível.** Use `d!backup restaurar` depois para reconstruir.'
            )
            .setFooter({ text: 'Aguardando confirmação · Expira em 30 segundos' })
            .setTimestamp();

        const botoesConfirm = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('nuke_confirmar')
                .setLabel('Executar Nuke')
                .setEmoji('💥')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('nuke_cancelar')
                .setLabel('Cancelar')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Secondary),
        );

        const painel = await msg.reply({ embeds: [embedAviso], components: [botoesConfirm] });

        // ── Coletor de botão ─────────────────────────────────────────────────
        let interacao;
        try {
            interacao = await painel.awaitMessageComponent({
                filter: (i) => i.user.id === author.id,
                time: 30_000,
            });
        } catch {
            // Timeout — desativa botões
            await painel.edit({ components: [] }).catch(() => {});
            return tempMsg(channel, '⏱️ **SISTEMA:** Protocolo expirado. Nenhuma ação foi tomada.');
        }

        // ── Cancelado ────────────────────────────────────────────────────────
        if (interacao.customId === 'nuke_cancelar') {
            await interacao.deferUpdate();
            await painel.delete().catch(() => {});
            return tempMsg(channel, '✅ **SISTEMA:** Protocolo Nuke cancelado. Servidor seguro.');
        }

        // ── Confirmado — executa ─────────────────────────────────────────────
        await interacao.deferUpdate();

        // 1. Notifica o dono do servidor (se não for o próprio OWNER_ID)
        if (guild.ownerId !== OWNER_ID) {
            try {
                const dono = await guild.members.fetch(guild.ownerId);
                await dono.send(
                    `⚠️ **ALERTA DE EMERGÊNCIA:** O Desenvolvedor Supremo ativou o protocolo **NUKE** no servidor **${guild.name}**.\n` +
                    `A estrutura de canais está sendo completamente resetada.`
                ).catch(() => {});
            } catch {}
        }

        console.log(`[💥 NUKE] Executado por ${author.tag} no servidor: ${guild.name} (${guild.id})`);

        // 2. Snapshot da quantidade de canais antes de deletar
        const totalCanais = guild.channels.cache.size;

        // 3. Deleta todos os canais (o painel some junto — sem problema)
        for (const [, canal] of guild.channels.cache) {
            await canal.delete('Protocolo Nuke — Desenvolvedor Supremo').catch(() => {});
            await delay(DELAY_DELETE);
        }

        // 4. Cria canal de operação pós-nuke
        let canalSobrevivente;
        try {
            canalSobrevivente = await guild.channels.create({
                name: '💥-nuke-executado',
                type: 0,
                topic: 'Canal criado após execução do Protocolo Nuke.',
                reason: 'Protocolo Nuke — canal de operação pós-reset',
            });
        } catch (e) {
            console.error('[nuke] Falha ao criar canal pós-nuke:', e.message);
            return;
        }

        // 5. Embed de resultado no canal sobrevivente
        const embedResultado = new EmbedBuilder()
            .setColor('#f53b57')
            .setTitle('☢️ PROTOCOLO NUKE — EXECUTADO COM SUCESSO')
            .setDescription(
                `Infraestrutura do servidor **${guild.name}** completamente expurgada\npor ordem direta de <@${OWNER_ID}>.`
            )
            .addFields(
                { name: '🧹 Canais Destruídos', value: `\`${totalCanais}\` canais eliminados`, inline: true },
                { name: '🕒 Executado em', value: `<t:${Math.floor(Date.now() / 1000)}:T>`, inline: true },
                { name: '🔄 Próximo Passo', value: 'Use `d!backup restaurar` para reinjetar a estrutura salva.', inline: false },
            )
            .setFooter({ text: `Servidor: ${guild.name} · ID: ${guild.id}` })
            .setTimestamp();

        await canalSobrevivente.send({ embeds: [embedResultado] });
    },
};