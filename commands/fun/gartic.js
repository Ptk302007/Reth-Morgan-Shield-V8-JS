// Arquivo: commands/diversao/gartic.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ══════════════════════════════════════════════
//  BANCO DE PALAVRAS DO GARTIC
// ══════════════════════════════════════════════
const palavrasBanco = [
    // Animais
    'gato', 'cachorro', 'elefante', 'girafa', 'leao', 'tigre', 'cobra', 'papagaio',
    'tartaruga', 'peixe', 'tubarao', 'baleia', 'golfinho', 'macaco', 'urso',
    // Objetos
    'cadeira', 'mesa', 'televisao', 'geladeira', 'computador', 'celular', 'oculos',
    'carro', 'bicicleta', 'aviao', 'navio', 'helicoptero', 'trem', 'moto',
    // Comidas
    'pizza', 'hamburguer', 'sorvete', 'chocolate', 'bolo', 'sushi', 'macarrao',
    'frango', 'arroz', 'feijao', 'batata', 'cenoura', 'melancia', 'banana',
    // Lugares
    'praia', 'montanha', 'floresta', 'cidade', 'escola', 'hospital', 'aeroporto',
    'castelo', 'piramide', 'farol', 'ponte', 'estadio',
    // Profissões
    'medico', 'professor', 'policial', 'bombeiro', 'cozinheiro', 'piloto',
    'astronauta', 'cientista', 'musico', 'pintor',
    // Outros
    'arco-iris', 'tempestade', 'vulcao', 'tesouro', 'fantasma', 'robo',
    'espada', 'escudo', 'coroa', 'mapa', 'relogio', 'lupa'
];

// Partidas ativas (chave = channelId)
const partidasAtivas = new Map();

module.exports = {
    name: 'gartic',
    aliases: ['desenho', 'draw'],
    execute: async (msg, args, client) => {

        // ── SUBCOMANDO: PARAR ──────────────────────────
        if (args[0] === 'parar' || args[0] === 'stop') {
            if (!partidasAtivas.has(msg.channel.id)) return msg.reply('❌ Não há nenhum jogo ativo neste canal.');
            const partida = partidasAtivas.get(msg.channel.id);
            if (msg.author.id !== partida.dono && !msg.member.permissions.has('ManageMessages')) {
                return msg.reply('❌ Apenas quem iniciou o jogo ou um moderador pode parar.');
            }
            partida.collector?.stop('forcado');
            partida.timerHandle && clearTimeout(partida.timerHandle);
            partidasAtivas.delete(msg.channel.id);
            return msg.reply('🛑 Jogo do Gartic encerrado!');
        }

        // ── VERIFICAÇÃO: JÁ HÁ PARTIDA ATIVA ──────────
        if (partidasAtivas.has(msg.channel.id)) {
            return msg.reply('⚠️ Já existe um jogo de Gartic em andamento neste canal! Use `d!gartic parar` para encerrar.');
        }

        // ── CONFIGURAÇÃO DA PARTIDA ────────────────────
        const totalRodadas = Math.min(Math.max(parseInt(args[0]) || 3, 1), 10);
        const tempoPorRodada = 90; // segundos

        const partida = {
            dono: msg.author.id,
            rodadaAtual: 0,
            totalRodadas,
            pontuacao: {},
            jogadores: new Set(),
            ativa: true,
            collector: null,
            timerHandle: null
        };

        partidasAtivas.set(msg.channel.id, partida);

        // ── EMBED DE INÍCIO ────────────────────────────
        const embedInicio = new EmbedBuilder()
            .setColor('#e91e8c')
            .setTitle('🎨 GARTIC — Jogo de Desenho!')
            .setDescription(
                `**${msg.author.username}** iniciou uma partida de Gartic!\n\n` +
                `📋 **Rodadas:** ${totalRodadas}\n` +
                `⏱️ **Tempo por rodada:** ${tempoPorRodada}s\n\n` +
                `Clique em **Participar** para entrar! O jogo começa em **20 segundos**.`
            )
            .setFooter({ text: `d!gartic parar — para encerrar o jogo` });

        const rowEntrar = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('gartic_entrar').setLabel('Participar').setEmoji('🎨').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('gartic_cancelar').setLabel('Cancelar').setEmoji('🛑').setStyle(ButtonStyle.Danger)
        );

        const msgInicio = await msg.channel.send({ embeds: [embedInicio], components: [rowEntrar] });

        // ── COLETA DE JOGADORES (20s) ──────────────────
        const collectorEntrada = msgInicio.createMessageComponentCollector({ time: 20000 });

        collectorEntrada.on('collect', async i => {
            if (i.customId === 'gartic_cancelar') {
                if (i.user.id !== msg.author.id) return i.reply({ content: '❌ Apenas quem criou pode cancelar.', ephemeral: true });
                collectorEntrada.stop('cancelado');
                return;
            }
            if (i.customId === 'gartic_entrar') {
                partida.jogadores.add(i.user.id);
                partida.pontuacao[i.user.id] = 0;
                await i.reply({ content: `✅ Você entrou na partida, **${i.user.username}**!`, ephemeral: true });
            }
        });

        collectorEntrada.on('end', async (_, reason) => {
            await msgInicio.edit({ components: [] }).catch(() => {});

            if (reason === 'cancelado') {
                partidasAtivas.delete(msg.channel.id);
                return msg.channel.send('🛑 Partida de Gartic cancelada!');
            }

            // Garante que o criador está na partida
            partida.jogadores.add(msg.author.id);
            partida.pontuacao[msg.author.id] = partida.pontuacao[msg.author.id] || 0;

            if (partida.jogadores.size < 2) {
                partidasAtivas.delete(msg.channel.id);
                return msg.channel.send('❌ São necessários pelo menos **2 jogadores** para iniciar. Partida cancelada!');
            }

            // ── INICIAR RODADAS ────────────────────────
            await iniciarRodada(msg.channel, partida, client);
        });

        // ══════════════════════════════════════════════
        //  FUNÇÃO: INICIAR RODADA
        // ══════════════════════════════════════════════
        async function iniciarRodada(canal, partida, client) {
            if (!partida.ativa || !partidasAtivas.has(canal.id)) return;

            partida.rodadaAtual++;

            if (partida.rodadaAtual > partida.totalRodadas) {
                return encerrarJogo(canal, partida, client);
            }

            // Escolhe desenhista (rotaciona pelos jogadores)
            const jogadoresArr = [...partida.jogadores];
            const desenhistaId = jogadoresArr[(partida.rodadaAtual - 1) % jogadoresArr.length];

            // Sorteia 3 palavras para o desenhista escolher
            const opcoesPalavras = [];
            const bancoCopia = [...palavrasBanco].sort(() => Math.random() - 0.5);
            for (let i = 0; i < 3; i++) opcoesPalavras.push(bancoCopia[i]);

            // ── AVISA O DESENHISTA VIA DM ──────────────
            const desenhista = await client.users.fetch(desenhistaId).catch(() => null);
            if (!desenhista) {
                partida.jogadores.delete(desenhistaId);
                return iniciarRodada(canal, partida, client);
            }

            // Embed no canal público avisando quem vai desenhar
            const embedRodada = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle(`🎨 Rodada ${partida.rodadaAtual}/${partida.totalRodadas}`)
                .setDescription(
                    `✏️ **${desenhista.username}** vai desenhar!\n\n` +
                    `Aguarde enquanto o desenhista escolhe a palavra via **DM**.\n\n` +
                    `Dica: A palavra terá **${0} letras** *(revelado após a escolha)*\n\n` +
                    `⏱️ O desenho começa em breve...`
                );

            await canal.send({ embeds: [embedRodada] });

            // Envia opções de palavra para o desenhista via DM
            const rowEscolha = new ActionRowBuilder().addComponents(
                opcoesPalavras.map((p, i) =>
                    new ButtonBuilder().setCustomId(`palavra_${i}`).setLabel(p.toUpperCase()).setStyle(ButtonStyle.Primary)
                )
            );

            let msgDM;
            try {
                msgDM = await desenhista.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#e91e8c')
                        .setTitle('🎨 Escolha sua palavra!')
                        .setDescription('Você tem **20 segundos** para escolher uma palavra para desenhar.\nDepois, desenhe no chat do servidor!')
                    ],
                    components: [rowEscolha]
                });
            } catch {
                await canal.send(`⚠️ Não consegui enviar DM para **${desenhista.username}**. Habilite DMs e tente novamente. Pulando rodada...`);
                return setTimeout(() => iniciarRodada(canal, partida, client), 3000);
            }

            // ── COLETA ESCOLHA DA PALAVRA ──────────────
            let palavraEscolhida = null;
            const collectorDM = msgDM.createMessageComponentCollector({ time: 20000, max: 1 });

            collectorDM.on('collect', async i => {
                const idx = parseInt(i.customId.split('_')[1]);
                palavraEscolhida = opcoesPalavras[idx];
                await i.update({
                    embeds: [new EmbedBuilder().setColor('#2ecc71').setTitle('✅ Palavra escolhida!').setDescription(`Sua palavra é: **${palavraEscolhida.toUpperCase()}**\n\nAgora vá ao canal e descreva/desenhe para os outros adivinharem!\n\n⏱️ Você tem **${tempoPorRodada} segundos**!`)],
                    components: []
                });
            });

            collectorDM.on('end', async () => {
                // Se não escolheu, pega uma aleatória
                if (!palavraEscolhida) {
                    palavraEscolhida = opcoesPalavras[0];
                    desenhista.send(`⏰ Tempo esgotado! Sua palavra é: **${palavraEscolhida.toUpperCase()}**`).catch(() => {});
                }

                // ── FASE DE ADIVINHAÇÃO ──────────────────
                await executarFaseAdivinhacao(canal, partida, desenhista, palavraEscolhida, client);
            });
        }

        // ══════════════════════════════════════════════
        //  FUNÇÃO: FASE DE ADIVINHAÇÃO
        // ══════════════════════════════════════════════
        async function executarFaseAdivinhacao(canal, partida, desenhista, palavra, client) {
            if (!partida.ativa || !partidasAtivas.has(canal.id)) return;

            const letras = palavra.length;
            const dica = '\\_ '.repeat(letras).trim();
            let adivinhadores = new Set([...partida.jogadores].filter(id => id !== desenhista.id));
            let acertaram = [];
            let tempoRestante = tempoPorRodada;

            const embedAdivinha = new EmbedBuilder()
                .setColor('#9b59b6')
                .setTitle(`🎨 Adivinhe o Desenho! — Rodada ${partida.rodadaAtual}/${partida.totalRodadas}`)
                .setDescription(
                    `✏️ **${desenhista.username}** está desenhando!\n\n` +
                    `A palavra tem **${letras} letras**: \`${dica}\`\n\n` +
                    `Digite sua resposta no chat para adivinhar!\n` +
                    `⏱️ Tempo: **${tempoRestante}s**`
                )
                .setFooter({ text: `Desenhista: envia uma imagem ou descreva o desenho aqui!` });

            const msgAdivinha = await canal.send({ embeds: [embedAdivinha] });

            // Timer visual
            const timerInterval = setInterval(async () => {
                tempoRestante -= 15;
                if (tempoRestante <= 0 || !partida.ativa) { clearInterval(timerInterval); return; }
                const embedAtual = new EmbedBuilder()
                    .setColor(tempoRestante <= 30 ? '#e74c3c' : '#9b59b6')
                    .setTitle(`🎨 Adivinhe o Desenho! — Rodada ${partida.rodadaAtual}/${partida.totalRodadas}`)
                    .setDescription(
                        `✏️ **${desenhista.username}** está desenhando!\n\n` +
                        `A palavra tem **${letras} letras**: \`${dica}\`\n\n` +
                        `✅ Acertaram: ${acertaram.length > 0 ? acertaram.map(id => `<@${id}>`).join(', ') : 'ninguém ainda'}\n` +
                        `⏱️ Tempo restante: **${tempoRestante}s**`
                    );
                msgAdivinha.edit({ embeds: [embedAtual] }).catch(() => {});
            }, 15000);

            // Collector de mensagens para adivinhar
            const collectorChat = canal.createMessageCollector({
                filter: m => !m.author.bot && adivinhadores.has(m.author.id),
                time: tempoPorRodada * 1000
            });

            partida.collector = collectorChat;

            collectorChat.on('collect', async m => {
                if (!partida.ativa) return collectorChat.stop('encerrado');

                const tentativa = m.content.toLowerCase().trim()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const palavraNorm = palavra.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

                if (tentativa === palavraNorm) {
                    // ACERTOU!
                    adivinhadores.delete(m.author.id);
                    acertaram.push(m.author.id);

                    // Pontuação baseada no tempo restante
                    const pontos = Math.max(10, tempoRestante);
                    partida.pontuacao[m.author.id] = (partida.pontuacao[m.author.id] || 0) + pontos;
                    // Desenhista também ganha pontos por acerto
                    partida.pontuacao[desenhista.id] = (partida.pontuacao[desenhista.id] || 0) + 20;

                    await m.delete().catch(() => {});
                    await canal.send(`✅ **${m.author.username}** acertou! **+${pontos} pontos!** 🎉`);

                    if (adivinhadores.size === 0) collectorChat.stop('todos_acertaram');
                }
            });

            collectorChat.on('end', async (_, reason) => {
                clearInterval(timerInterval);
                if (!partida.ativa) return;

                const naoAcertaram = [...adivinhadores].map(id => `<@${id}>`).join(', ') || 'ninguém';
                const acertaramMencoes = acertaram.map(id => `<@${id}>`).join(', ') || 'ninguém';

                const embedFim = new EmbedBuilder()
                    .setColor('#f39c12')
                    .setTitle(`⏱️ Fim da Rodada ${partida.rodadaAtual}!`)
                    .setDescription(`A palavra era: **${palavra.toUpperCase()}**`)
                    .addFields(
                        { name: '✅ Acertaram', value: acertaramMencoes, inline: true },
                        { name: '❌ Não acertaram', value: naoAcertaram, inline: true }
                    );

                await canal.send({ embeds: [embedFim] });

                // Placar intermediário
                const placar = Object.entries(partida.pontuacao)
                    .sort((a, b) => b[1] - a[1])
                    .map(([id, pts], i) => `${i + 1}. <@${id}> — **${pts} pts**`)
                    .join('\n');

                await canal.send({
                    embeds: [new EmbedBuilder().setColor('#3498db').setTitle('📊 Placar Atual').setDescription(placar)]
                });

                // Aguarda 5s antes da próxima rodada
                partida.timerHandle = setTimeout(() => iniciarRodada(canal, partida, client), 5000);
            });
        }

        // ══════════════════════════════════════════════
        //  FUNÇÃO: ENCERRAR JOGO
        // ══════════════════════════════════════════════
        async function encerrarJogo(canal, partida, client) {
            partidasAtivas.delete(canal.id);
            partida.ativa = false;

            const sorted = Object.entries(partida.pontuacao).sort((a, b) => b[1] - a[1]);
            const medals = ['🥇', '🥈', '🥉'];

            const linhas = await Promise.all(sorted.map(async ([id, pts], i) => {
                const user = await client.users.fetch(id).catch(() => ({ username: 'Desconhecido' }));
                return `${medals[i] || `\`${i + 1}.\``} **${user.username}** — ${pts} pontos`;
            }));

            const vencedor = sorted[0];
            const vencedorUser = await client.users.fetch(vencedor[0]).catch(() => ({ username: 'Desconhecido' }));

            const embedFinal = new EmbedBuilder()
                .setColor('#f1c40f')
                .setTitle('🏆 FIM DO JOGO — Gartic!')
                .setDescription(`🎉 O vencedor é **${vencedorUser.username}** com **${vencedor[1]} pontos**!\n\n**Placar Final:**\n${linhas.join('\n')}`)
                .setFooter({ text: 'Obrigado por jogar! Use d!gartic para jogar novamente.' });

            await canal.send({ embeds: [embedFinal] });
        }
    }
};