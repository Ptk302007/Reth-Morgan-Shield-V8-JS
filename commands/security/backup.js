// Arquivo: commands/security/backup.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');

module.exports = {
    name: 'backup',
    aliases: ['bkp'],
    execute: async (msg, args, client, OWNER_ID) => {
        if (msg.author.id !== OWNER_ID && msg.author.id !== msg.guild.ownerId) {
            return msg.reply('👑 Apenas a alta cúpula gerencia o cofre de backups.');
        }

        // Interface Principal
        const painelBkp = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('🗄️ COFRE DE BACKUPS — RETH MORGAN')
            .setDescription(
                'Selecione uma das diretrizes mecânicas abaixo utilizando as interações:\n\n' +
                '💾 **[Salvar Backup]:** Tira um snapshot completo de cargos, canais e permissões.\n' +
                '🔄 **[Restaurar Backup]:** Executa o reset linear e reconstrói o servidor.\n' +
                '⏱️ **[Backup Automático]:** Ativa/Desativa o ciclo automático de salvamento (12h).'
            );

        const botoesPrincipal = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bkp_salvar').setLabel('Salvar').setEmoji('💾').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('bkp_restaurar').setLabel('Restaurar').setEmoji('🔄').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('bkp_auto').setLabel('Auto (12h)').setEmoji('⏱️').setStyle(ButtonStyle.Primary)
        );

        const resposta = await msg.reply({ embeds: [painelBkp], components: [botoesPrincipal] });
        const coletor = resposta.createMessageComponentCollector({ time: 120000 }); // 2 minutos ativo

        coletor.on('collect', async (i) => {
            if (i.user.id !== msg.author.id) {
                return i.reply({ content: '❌ Você não iniciou esta sessão de segurança.', ephemeral: true });
            }

            let backups = {};
            try {
                const conteudo = fs.readFileSync('./database/backups.json', 'utf-8');
                if (conteudo.trim()) backups = JSON.parse(conteudo);
            } catch (e) { backups = {}; }

            // --- FUNÇÃO: SALVAR BACKUP ---
            if (i.customId === 'bkp_salvar') {
                await i.deferUpdate();
                
                const cargosMapeados = msg.guild.roles.cache.filter(r => r.id !== msg.guild.id && !r.managed).map(r => ({
                    id: r.id, name: r.name, color: r.color, hoist: r.hoist, mentionable: r.mentionable, permissions: r.permissions.bitfield.toString(), position: r.position
                }));
                const canaisMapeados = msg.guild.channels.cache.map(c => ({
                    name: c.name, type: c.type, parentId: c.parentId, position: c.position, topic: c.topic || null, nsfw: c.nsfw || false,
                    overwrites: c.permissionOverwrites.cache.map(o => ({ id: o.id, type: o.type, allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString() }))
                }));

                backups[msg.guild.id] = { nome: msg.guild.name, data: new Date().toLocaleDateString('pt-BR'), cargos: cargosMapeados, canais: canaisMapeados };
                fs.writeFileSync('./database/backups.json', JSON.stringify(backups, null, 2));

                const msgSucesso = await msg.channel.send('🟩 **SISTEMA:** Ponto de restauração manual criado com sucesso.');
                setTimeout(() => msgSucesso.delete().catch(() => {}), 5000);
                return;
            }

            // --- FUNÇÃO: INTERFACE DE CONFIRMAÇÃO DO RESET (BOTÕES) ---
            if (i.customId === 'bkp_restaurar') {
                await i.deferUpdate();

                const embedConfirmar = new EmbedBuilder()
                    .setColor('#f53b57')
                    .setTitle('⚠️ PROTOCOLO DE ALTA INFRAESTRUTURA')
                    .setDescription(
                        '**ATENÇÃO MÁXIMA:** Você escolheu restaurar o servidor.\n' +
                        'Isso vai **APAGAR TODOS OS CANAIS E CARGOS ATUAIS** para reinjetar o backup.\n\n' +
                        'Deseja prosseguir com a formatação e reconstrução automática?'
                    )
                    .setFooter({ text: 'Esta ação é irreversível.' });

                const botoesConfirmar = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('bkp_confirmar_true').setLabel('Sim, Executar Reset').setEmoji('🟩').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('bkp_confirmar_false').setLabel('Cancelar Protocolo').setEmoji('🟥').setStyle(ButtonStyle.Secondary)
                );

                // Troca a interface principal pelos botões de sim/não
                await resposta.edit({ embeds: [embedConfirmar], components: [botoesConfirmar] });
                return;
            }

            // --- CANCELAR RESET ---
            if (i.customId === 'bkp_confirmar_false') {
                await i.deferUpdate();
                // Devolve o painel para o estado inicial estável
                await resposta.edit({ embeds: [painelBkp], components: [botoesPrincipal] });
                return;
            }

            // --- EXECUTAR RESET BRUTAL CONFIRMADO VIA BOTÃO ---
            if (i.customId === 'bkp_confirmar_true') {
                await i.deferUpdate();
                const backupServer = backups[msg.guild.id];
                if (!backupServer) return msg.channel.send('❌ Nenhum snapshot de segurança encontrado para este servidor no JSON.');

                // Apaga a mensagem do painel para não bugar durante o processo de deleção de salas
                await resposta.delete().catch(() => {});

                // 1. Deleta Canais
                const canaisAtuais = msg.guild.channels.cache;
                for (const [, canal] of canaisAtuais) {
                    await canal.delete().catch(() => {});
                }

                // 2. Deleta Cargos (Abaixo da hierarquia do Bot)
                const cargosAtuais = msg.guild.roles.cache;
                for (const [, cargo] of cargosAtuais) {
                    if (cargo.id !== msg.guild.id && !cargo.managed && cargo.position < msg.guild.members.me.roles.highest.position) {
                        await cargo.delete().catch(() => {});
                    }
                }

                const tabelaCargos = {};
                const tabelaCategorias = {};

                // 3. Recriar Cargos Ordenados
                const cargosOrdenados = backupServer.cargos.sort((a, b) => a.position - b.position);
                for (const cOld of cargosOrdenados) {
                    const novoCargo = await msg.guild.roles.create({
                        name: cOld.name, color: cOld.color, hoist: cOld.hoist, mentionable: cOld.mentionable, permissions: BigInt(cOld.permissions), position: cOld.position
                    }).catch(() => {});

                    if (novoCargo) {
                        tabelaCargos[cOld.id] = novoCargo.id;
                        await new Promise(res => setTimeout(res, 350));
                    }
                }

                // 4. Recriar Categorias
                const categoriasBackup = backupServer.canais.filter(c => c.type === 4).sort((a, b) => a.position - b.position);
                for (const cat of categoriasBackup) {
                    const overwritesNovos = cat.overwrites ? cat.overwrites.map(ov => ({ id: tabelaCargos[ov.id] || ov.id, type: ov.type, allow: BigInt(ov.allow), deny: BigInt(ov.deny) })) : [];
                    const novaCat = await msg.guild.channels.create({
                        name: cat.name, type: 4, position: cat.position, permissionOverwrites: overwritesNovos
                    }).catch(() => {});

                    if (novaCat) {
                        tabelaCategorias[cat.name] = novaCat.id;
                        await new Promise(res => setTimeout(res, 400));
                    }
                }

                // 5. Recriar Canais Normais amarrados nas categorias
                const canaisNormais = backupServer.canais.filter(c => c.type !== 4).sort((a, b) => a.position - b.position);
                for (const ch of canaisNormais) {
                    const categoriaAntiga = backupServer.canais.find(o => o.type === 4 && o.id === ch.parentId);
                    const novoParentId = categoriaAntiga ? tabelaCategorias[categoriaAntiga.name] : null;
                    const overwritesNovos = ch.overwrites ? ch.overwrites.map(ov => ({ id: tabelaCargos[ov.id] || ov.id, type: ov.type, allow: BigInt(ov.allow), deny: BigInt(ov.deny) })) : [];

                    await msg.guild.channels.create({
                        name: ch.name, type: ch.type, parent: novoParentId, position: ch.position, topic: ch.topic, nsfw: ch.nsfw, permissionOverwrites: overwritesNovos
                    }).catch(() => {});

                    await new Promise(res => setTimeout(res, 400));
                }

                return;
            }

            // --- FUNÇÃO: BACKUP AUTOMÁTICO (12H) ---
            if (i.customId === 'bkp_auto') {
                await i.deferUpdate();
                if (global.bkpIntervals?.[msg.guild.id]) {
                    clearInterval(global.bkpIntervals[msg.guild.id]);
                    delete global.bkpIntervals[msg.guild.id];
                    const msgOff = await msg.channel.send('⏱️ **MÓDULO:** Backup automático desativado.');
                    setTimeout(() => msgOff.delete().catch(() => {}), 5000);
                } else {
                    if (!global.bkpIntervals) global.bkpIntervals = {};
                    global.bkpIntervals[msg.guild.id] = setInterval(() => {
                        let bkpAt = JSON.parse(fs.readFileSync('./database/backups.json', 'utf-8') || '{}');
                        const crg = msg.guild.roles.cache.filter(r => r.id !== msg.guild.id && !r.managed).map(r => ({ id: r.id, name: r.name, color: r.color, permissions: r.permissions.bitfield.toString(), position: r.position }));
                        const cna = msg.guild.channels.cache.map(c => ({ name: c.name, type: c.type, parentId: c.parentId, position: c.position }));
                        bkpAt[msg.guild.id] = { nome: msg.guild.name, data: `AUTO - ${new Date().toLocaleDateString('pt-BR')}`, cargos: crg, canais: cna };
                        fs.writeFileSync('./database/backups.json', JSON.stringify(bkpAt, null, 2));
                    }, 12 * 60 * 60 * 1000);

                    const msgOn = await msg.channel.send('🟩 **MÓDULO:** Cronômetro armado! Salvamento automático configurado a cada 12 horas.');
                    setTimeout(() => msgOn.delete().catch(() => {}), 5000);
                }
                return;
            }
        });

        coletor.on('end', () => {
            // Remove os botões se o dono ficar mais de 2 minutos sem clicar em nada
            resposta.edit({ components: [] }).catch(() => {});
        });
    }
};