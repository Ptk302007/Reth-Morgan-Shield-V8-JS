// Arquivo: index.js

// --- TRAVAS DE SEGURANÇA CONTRA CRASHES DE CONEXÃO E CANAL DE VOZ ---
process.emitWarning = () => {}; 
process.env.NODE_NO_WARNINGS = '1';

// Impede que erros de rede ou socket de voz derrubem o terminal
process.on('unhandledRejection', (reason, promise) => {
    if (reason?.message?.includes('IP discovery') || reason?.message?.includes('socket closed')) {
        return; 
    }
    console.error('⚠️ Rejeição não tratada:', reason);
});

process.on('uncaughtException', (err, origin) => {
    if (err?.message?.includes('IP discovery') || err?.message?.includes('socket closed')) {
        return;
    }
    console.error('⚠️ Exceção não capturada:', err);
});
// ------------------------------------------------------------------

const { Client, GatewayIntentBits, Collection, EmbedBuilder, AuditLogEvent } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Ajustado para CommonJS para não quebrar com seus requires abaixo
const { perguntarParaIA } = require("./gemini.js"); 

const PREFIX = 'r!';
const OWNER_ID = '1507543140800921610'; // ID PT

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,     
        GatewayIntentBits.GuildVoiceStates  
    ]
});

client.commands = new Collection();
const floodMap = new Map(); 
const deletarCanaisMap = new Map(); 

// --- CARREGADOR DE COMANDOS MECÂNICO ---
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        const command = require(filePath);
        if ('name' in command && 'execute' in command) {
            
            // 🟩 INJETOR DE CATEGORIA (Essencial para os botões do help funcionarem)
            command.category = folder.toLowerCase();
            
            client.commands.set(command.name, command);
        }
    }
}

const palavrasProibidas = ["macaco", "crioulo", "viadinho", "infame", "verme", "traveco"]; 

// --- ROTEAÇÃO AVANÇADA DE LOGS POR SERVIDOR ---
async function enviarLog(guild, tipoLog, embed) {
    try {
        const configs = JSON.parse(fs.readFileSync('./database/config.json', 'utf-8'));
        const serverConfig = configs[guild.id];
        if (!serverConfig) return;

        const canalId = serverConfig[tipoLog];
        if (!canalId) return;

        const canalLog = guild.channels.cache.get(canalId);
        if (canalLog && canalLog.permissionsFor(guild.members.me).has('SendMessages')) {
            canalLog.send({ embeds: [embed] }).catch(() => {});
        }
    } catch (e) {}
}

function registrarInfracao(guildId, userId, tipo, motivo) {
    let dados = JSON.parse(fs.readFileSync('./database/punicoes.json', 'utf-8'));
    if (!dados[guildId]) dados[guildId] = {};
    if (!dados[guildId][userId]) dados[guildId][userId] = { warns: 0, mutes: 0, bans: 0, historico: [] };
    dados[guildId][userId][tipo]++;
    dados[guildId][userId].historico.push({
        tipo: tipo.toUpperCase(), motivo: motivo, data: new Date().toLocaleDateString('pt-BR')
    });
    fs.writeFileSync('./database/punicoes.json', JSON.stringify(dados, null, 2));
}

// TIMEOUT CHECKER AUTOMÁTICO
setInterval(() => {
    try {
        let dados = JSON.parse(fs.readFileSync('./database/punicoes.json', 'utf-8'));
        const agora = Date.now();
        let mudou = false;
        for (const guildId in dados) {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) continue;
            for (const userId in dados[guildId]) {
                const muteData = dados[guildId][userId].muteAtivo;
                if (muteData && agora > muteData.expiresAt) {
                    const member = guild.members.cache.get(userId);
                    if (member) member.timeout(null).catch(() => {});
                    delete dados[guildId][userId].muteAtivo;
                    mudou = true;
                }
            }
        }
        if (mudou) fs.writeFileSync('./database/punicoes.json', JSON.stringify(dados, null, 2));
    } catch (e) {}
}, 10000);

// --- EVENTO: REINICIALIZAÇÃO COM STATUS ROTATIVO DINÂMICO ---
client.once('ready', () => {
    console.clear(); 
    console.log('==================================================');
    console.log(`🛡️   RETH MORGAN SHIELD SYSTEM V8 ONLINE`);
    console.log(`🔗 Logado como: ${client.user.tag}`);
    console.log('==================================================');

    const statusList = [
        { name: 'r!painel | Proteger Servidores 🛡️', type: 3 },
        { name: `Segurança Máxima em ${client.guilds.cache.size} servidores! 🏢`, type: 0 },
        { name: 'Protocolo Anti-Nuke Ativo ☢️', type: 2 },
        { name: 'Desenvolvido por PT 👑', type: 0 },
        { name: 'RETH MORGAN: Executando o caos. Codificando a ordem."', type: 2 },
        { name: 'Use r!help para ver meus comandos 🚀', type: 0 }
    ];

    let index = 0;
    setInterval(() => {
        const currentStatus = statusList[index];
        client.user.setPresence({
            activities: [{ name: currentStatus.name, type: currentStatus.type }],
            status: 'dnd' 
        });
        index = (index + 1) % statusList.length;
    }, 15000);
});

// --- EVENTO CENTRAL: ENTRADA DE MEMBROS ---
client.on('guildMemberAdd', async (member) => {
    const guild = member.guild;
    let configs = {};
    try {
        configs = JSON.parse(fs.readFileSync('./database/config.json', 'utf-8'));
    } catch (e) { return; }
    
    const serverConfig = configs[guild.id] || {};

    // 1. AUTO-ROLE AUTOMÁTICO
    if (serverConfig.autorole) {
        const cargoAlvo = guild.roles.cache.get(serverConfig.autorole);
        if (cargoAlvo) await member.roles.add(cargoAlvo).catch(() => {});
    }

    // 2. MENSAGEM DE BOAS-VINDAS PÚBLICA
    if (serverConfig.msg_join) {
        const canalPublico = guild.channels.cache.get(serverConfig.msg_join);
        if (canalPublico) {
            canalPublico.send(`👋 Bem-vindo(a) <@${member.id}> ao servidor **${guild.name}**! Aproveite o chat!`).catch(() => {});
        }
    }

    // 3. LOGS DE ENTRADA INDEPENDENTE (LOG-JOIN)
    if (serverConfig.logs_join) {
        const joinEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setAuthor({ name: `${member.user.tag} entrou`, iconURL: member.user.displayAvatarURL() })
            .setDescription(`• Conta criada em: <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n• ID do Usuário: \`${member.id}\``)
            .setTimestamp();
        enviarLog(guild, 'logs_join', joinEmbed);
    }

    // 4. BANIMENTO DE BOTS INVASORES E PUNÇÃO DE CHAVAL QUE INJETOU
    if (member.user.bot && serverConfig.antibot) {
        try {
            await new Promise(res => setTimeout(res, 1000));
            const logsAuditoria = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.BotAdd }); 
            const logAdicao = logsAuditoria.entries.first();
            
            if (logAdicao) {
                const executor = logAdicao.executor;
                if (executor.id === OWNER_ID || executor.id === guild.ownerId) return;

                await member.ban({ reason: 'Reth Morgan: Entrada de bots não autorizada pelo Proprietário.' }).catch(() => {});
                
                const staffer = await guild.members.fetch(executor.id).catch(() => {});
                if (staffer) {
                    await staffer.ban({ reason: 'Reth Morgan Anti-Raid: Autor de injeção ilícita de bot invasor.' }).catch(() => {
                        const cargosRemoviveis = staffer.roles.cache.filter(r => r.id !== guild.id && !r.managed);
                        staffer.roles.remove(cargosRemoviveis).catch(() => {});
                    });
                }

                const logBotEmbed = new EmbedBuilder()
                    .setColor('#f53b57')
                    .setTitle('🚨 ALERTA GERAL: ATAQUE DE BOT REPELIDO')
                    .setDescription(`O administrador <@${executor.id}> quebrou as regras e tentou injetar um bot no servidor.`)
                    .addFields(
                        { name: '🤖 Bot Invasor Eliminado', value: `\`${member.user.tag}\` (${member.id})`, inline: true },
                        { name: '🔨 Punição ao Infrator', value: `\`Banido do Servidor / Permissões Cassadas\``, inline: true }
                    )
                    .setTimestamp();
                
                return enviarLog(guild, 'logs_seguranca', logBotEmbed);
            }
        } catch (error) {}
    }

    // 5. ANTI-CONTA FAKE
    if (serverConfig.antifake && !member.user.bot) {
        const contaCriadaHa = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24); 
        const limiteDias = serverConfig.diasFake || 7;

        if (contaCriadaHa < limiteDias) {
            await member.kick(`Reth Morgan System: Conta menor que ${limiteDias} dias.`).catch(() => {});
            
            const logFakeEmbed = new EmbedBuilder()
                .setColor('#f53b57')
                .setTitle('🚨 SEGURANÇA: CONTA FAKE EXPULSADA')
                .setDescription(`A conta suspeita **${member.user.tag}** foi removida por não atingir a idade mínima.`)
                .addFields(
                    { name: '⏳ Idade da Conta', value: `\`${Math.floor(contaCriadaHa)} dias\``, inline: true },
                    { name: '🔒 Mínimo Exigido', value: `\`${limiteDias} dias\``, inline: true }
                )
                .setTimestamp();

            return enviarLog(guild, 'logs_seguranca', logFakeEmbed);
        }
    }
});

// --- EVENTO: SAÍDA DE MEMBROS (LOGS_JOIN) ---
client.on('guildMemberRemove', async (member) => {
    const guild = member.guild;
    let configs = {};
    try { configs = JSON.parse(fs.readFileSync('./database/config.json', 'utf-8')); } catch (e) { return; }
    
    const serverConfig = configs[guild.id] || {};
    if (serverConfig.logs_join) {
        const leaveEmbed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setAuthor({ name: `${member.user.tag} saiu`, iconURL: member.user.displayAvatarURL() })
            .setDescription(`🚪 O usuário deixou o servidor.\nID: \`${member.id}\``)
            .setTimestamp();
        enviarLog(guild, 'logs_join', leaveEmbed);
    }
});

// --- ANTI-MASS CHANNEL DELETE (ANTI-NUKE) ---
client.on('channelDelete', async (channel) => {
    const guild = channel.guild;
    let configs = {}; try { configs = JSON.parse(fs.readFileSync('./database/config.json', 'utf-8')); } catch (e) { return; }
    const serverConfig = configs[guild.id] || {};

    if (!serverConfig.antinuke) return;

    try {
        const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete });
        const entry = auditLogs.entries.first();
        if (!entry) return;

        const executor = entry.executor;
        if (executor.id === OWNER_ID || executor.id === guild.ownerId || executor.id === client.user.id) return;

        const agora = Date.now();
        if (!deletarCanaisMap.has(executor.id)) deletarCanaisMap.set(executor.id, []);
        
        const timestamps = deletarCanaisMap.get(executor.id);
        timestamps.push(agora);
        
        const exclusoesRecentes = timestamps.filter(time => agora - time < 10000);
        deletarCanaisMap.set(executor.id, exclusoesRecentes);

        if (exclusoesRecentes.length >= 3) {
            const member = await guild.members.fetch(executor.id).catch(() => {});
            if (member) {
                const cargosRemoviveis = member.roles.cache.filter(role => role.id !== guild.id && role.managed === false);
                await member.roles.remove(cargosRemoviveis).catch(() => {});
            }

            const embedAlerta = new EmbedBuilder()
                .setColor('#f53b57')
                .setTitle('🚨 ANTI-NUKE ACIONADO: PROTEÇÃO DE CANAIS')
                .setDescription(`O staffer <@${executor.id}> tentou deletar múltiplos canais. Privilégios revogados.`)
                .setTimestamp();
            enviarLog(guild, 'logs_seguranca', embedAlerta);
        }
    } catch (err) {}
});

// --- SISTEMA INTEGRAÇÃO COM MENSAGENS (COMANDOS & IA DE DEFESA) ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // Sistema de Filtro de Palavras Proibidas básico existente
    const contemPalavraProibida = palavrasProibidas.some(palavra => message.content.toLowerCase().includes(palavra));
    if (contemPalavraProibida) {
        await message.delete().catch(() => {});
        return message.channel.send(`⚠️ <@${message.author.id}>, mantenha o chat limpo e evite termos ofensivos!`);
    }

    // Execução normal de comandos com prefixo (Ex: r!help)
    if (message.content.startsWith(PREFIX)) {
        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = client.commands.get(commandName);
        if (command) {
            try {
                await command.execute(message, args, client);
            } catch (error) {
                console.error(error);
                message.reply('❌ Ocorreu um erro ao tentar executar esse comando!');
            }
            return;
        }
    }

// 🤖 CHAT DA IA: Defesa Inteligente, Criação de Comandos, Limpeza de Chat e Interação (Rápida e Direta)
const ehO_Dono = message.author.id === OWNER_ID;
const contemMorgan = message.content.toLowerCase().includes('morgan');
const comecaComMorgan = message.content.toLowerCase().trim().startsWith('morgan');
const marcouOBot = message.mentions.has(client.user);

// O dono só precisa citar "morgan" em qualquer lugar da frase. Outros precisam marcar ou começar com o nome.
const deveAtivarIA = marcouOBot || comecaComMorgan || (ehO_Dono && contemMorgan);

if (deveAtivarIA) {
    try {
        let perguntaLimpa = message.content;
        
        // Remove a menção do bot se ela existir
        if (marcouOBot) {
            perguntaLimpa = perguntaLimpa.split('<@' + client.user.id + '>').join('');
        }
        
        // Remove a palavra "morgan" de onde quer que ela esteja na frase para mandar a pergunta limpa para a IA
        const textoMinusculo = perguntaLimpa.toLowerCase();
        const posicaoMorgan = textoMinusculo.indexOf('morgan');
        if (posicaoMorgan !== -1) {
            perguntaLimpa = perguntaLimpa.slice(0, posicaoMorgan) + perguntaLimpa.slice(posicaoMorgan + 6);
        }
        
        perguntaLimpa = perguntaLimpa.trim();
        if (perguntaLimpa.startsWith(',')) {
            perguntaLimpa = perguntaLimpa.slice(1).trim();
        }

        if (!perguntaLimpa) {
            return message.reply("Opa! Como posso te ajudar com o servidor hoje? Só falar.");
        }

        // Mostra o efeito visual de "A digitar..." no Discord
        await message.channel.sendTyping();

        // Diretrizes totalmente reformuladas: adicionamos a ação "clear" de forma muito simples
        const diretrizesIA = `Você é a Reth Morgan, assistente pessoal de desenvolvimento e segurança do PT.
Sua personalidade é extremamente direta, rápida, sem enrolação e sem palavras difíceis. Fale de forma simples e prática.

CONDIÇÃO DE SEGURANÇA:
Quem está falando com você agora é o seu criador (PT)? Resposta: ${ehO_Dono ? "SIM, É O PT." : "NÃO, É UM USUÁRIO COMUM."}

Se o PT (e APENAS o PT) te der uma ordem direta, você pode executar três ações especiais respondendo rigorosamente em formato JSON simples:

1. ORDEM DE BANIMENTO: (Requer menção real do usuário)
{
  "acao": "ban",
  "alvo": "ID_OU_MENCAO_DO_ALVO",
  "motivo": "Motivo deduzido",
  "resposta_chat": "Pronto, PT. Usuário banido com sucesso."
}

2. ORDEM DE LIMPAR CHAT (CLEAR): (Ex: "morgan, apaga o chat", "morgan limpa 50 mensagens")
Deduza a quantidade de mensagens que o PT quer apagar (padrão é 100 se ele pedir para "limpar tudo" ou "apagar o chat todo"). Limite máximo de 100 por vez.
{
  "acao": "clear",
  "quantidade": 100,
  "resposta_chat": "Chat limpo com sucesso, PT!"
}

3. ORDEM DE CRIAR COMANDO: (Ex: "morgan, crie um comando chamado ping que responda pong")
ATENÇÃO: Sempre use 'EmbedBuilder' importado de 'discord.js' para criar embeds no Discord.js v14. Nunca use 'MessageEmbed'.
Se for essa ordem de criar comando, responda usando estritamente esta estrutura de tags de texto simples em vez de JSON:

[CRIAR_COMANDO]
<nome_arquivo>nome_do_comando.js</nome_arquivo>
<categoria_pasta>utilitarios</categoria_pasta>
<resposta_chat>Comando criado e ativado com sucesso, PT!</resposta_chat>
<codigo_js>
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'nome_do_comando',
    execute(message, args, client) {
        // Código JavaScript limpo e direto aqui
    }
};
</codigo_js>

Se quem falou NÃO for o PT, ou for apenas uma conversa comum, responda de forma muito curta, direta e simples, sem usar palavras difíceis.`;

        const respostaIA = await perguntarParaIA(perguntaLimpa, diretrizesIA);
        let textoResposta = respostaIA.trim();
        
        // Limpa blocos de formatação markdown se a IA os colocar por teimosia (Sem expressões regulares)
        const crasesMarkdown = '`' + '`' + '`'; 
        if (textoResposta.startsWith(crasesMarkdown)) {
            textoResposta = textoResposta.slice(3).trim();
            if (textoResposta.toLowerCase().startsWith('json')) {
                textoResposta = textoResposta.slice(4).trim();
            }
            if (textoResposta.endsWith(crasesMarkdown)) {
                textoResposta = textoResposta.slice(0, -3).trim();
            }
        }

        // 🛡️ SISTEMA DE CAPTURA 1: ORDENS EM JSON (Banimento e Clear)
        if (textoResposta.startsWith('{') && textoResposta.includes('"acao"')) {
            try {
                const ordem = JSON.parse(textoResposta);

                // --- FUNÇÃO: BANIMENTO ---
                if (ordem.acao === 'ban' && ehO_Dono) {
                    const membroAlvo = message.mentions.members.first();
                    if (!membroAlvo) {
                        return message.reply("⚠️ **Erro:** Você precisa marcar (@) quem quer banir.");
                    }
                    if (membroAlvo.id === OWNER_ID) {
                        return message.reply("⚠️ Não posso banir você, PT.");
                    }

                    await membroAlvo.ban({ reason: `Ordem verbal via IA: ${ordem.motivo}` });
                    registrarInfracao(message.guild.id, membroAlvo.id, 'bans', `IA Morgan: ${ordem.motivo}`);
                    return message.reply(`🔨 ${ordem.resposta_chat}`);
                }

                // --- FUNÇÃO: LIMPAR CHAT (CLEAR) ---
                if (ordem.acao === 'clear' && ehO_Dono) {
                    // Limita a quantidade entre 1 e 100 para evitar erros na API do Discord
                    let qtd = parseInt(ordem.quantidade) || 100;
                    if (qtd < 1) qtd = 1;
                    if (qtd > 100) qtd = 100;

                    // Deleta a mensagem original de ordem do dono para não atrapalhar a limpeza
                    await message.delete().catch(() => {});

                    // Faz a limpeza em lote das mensagens
                    const mensagensDeletadas = await message.channel.bulkDelete(qtd, true).catch(err => {
                        console.error("Erro no bulkDelete:", err);
                    });

                    if (!mensagensDeletadas) {
                        return message.channel.send("⚠️ **Erro:** Não consegui apagar as mensagens (mensagens com mais de 14 dias não podem ser limpas em massa pelo Discord).");
                    }

                    // Envia resposta de confirmação e apaga ela depois de 5 segundos para o chat ficar zerado
                    const respostaConfirmacao = await message.channel.send(`🧹 ${ordem.resposta_chat} (\`${mensagensDeletadas.size}\` mensagens limpas)`);
                    setTimeout(() => {
                        respostaConfirmacao.delete().catch(() => {});
                    }, 5000);
                    return;
                }

            } catch (errJson) {
                console.error("Erro ao decodificar JSON de ordem:", errJson);
            }
        }

        // ⚙️ SISTEMA DE CAPTURA 2: CRIAÇÃO DE COMANDOS (Formato por Tags)
        if (textoResposta.includes('[CRIAR_COMANDO]') && ehO_Dono) {
            try {
                const extrairTagTexto = (tag, texto) => {
                    const tagInicio = '<' + tag + '>';
                    const tagFim = '</' + tag + '>';
                    const indexInicio = texto.indexOf(tagInicio);
                    if (indexInicio === -1) return null;
                    const indexFim = texto.indexOf(tagFim, indexInicio + tagInicio.length);
                    if (indexFim === -1) return null;
                    return texto.slice(indexInicio + tagInicio.length, indexFim).trim();
                };

                const nomeArquivo = extrairTagTexto('nome_arquivo', textoResposta);
                const categoria = (extrairTagTexto('categoria_pasta', textoResposta) || 'utilitarios').toLowerCase().trim();
                const respostaChat = extrairTagTexto('resposta_chat', textoResposta) || 'Comando criado com sucesso, PT!';
                const codigoJs = extrairTagTexto('codigo_js', textoResposta);

                if (nomeArquivo && codigoJs) {
                    const nomeFinal = nomeArquivo.endsWith('.js') ? nomeArquivo : `${nomeArquivo}.js`;
                    const pastaDestino = path.join(__dirname, 'commands', categoria);
                    
                    if (!fs.existsSync(pastaDestino)) {
                        fs.mkdirSync(pastaDestino, { recursive: true });
                    }

                    const caminhoArquivo = path.join(pastaDestino, nomeFinal);

                    fs.writeFileSync(caminhoArquivo, codigoJs, 'utf-8');

                    delete require.cache[require.resolve(caminhoArquivo)];
                    const novoComando = require(caminhoArquivo);
                    novoComando.category = categoria;
                    client.commands.set(novoComando.name, novoComando);

                    return message.reply(`⚙️ **[Compilador]** ${respostaChat}\n\`Caminho: commands/${categoria}/${nomeFinal}\``);
                }
            } catch (errCriacao) {
                console.error("Erro no processamento do compilador por tags:", errCriacao);
                return message.reply("❌ **Erro:** Não consegui compilar o comando. Algo deu errado na escrita do arquivo.");
            }
        }

        // Retorna conversa padrão se nenhuma instrução especial for acionada
        return message.reply(textoResposta);

    } catch (err) {
        console.error("Erro no processamento da resposta da IA:", err);
    }
}
});

// --- LOGIN DO BOT ---
client.login('MTUwNzYyNjM0MDg5ODE4MTIxMA.Gk7slR.tImyfmmKVjspbVwx4aAsNgcn1R4W_2jnrF5sWw');