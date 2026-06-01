'use strict';
// ============================================================
//  RETH MORGAN — GROQ AI MODULE
//  groq.js — Integração com a API da Groq (com suporte a visão)
//  ✅ Múltiplas chaves API com fallback automático
//  ✅ Retry com backoff exponencial no erro 429
//  ✅ Modelo 70b para melhor obediência às ordens do dono
//  FIX: max_tokens aumentado para evitar respostas truncadas
//  FIX: detecção de truncamento para comandos [CRIAR_COMANDO]
// ============================================================
const Groq = require("groq-sdk");

// ── CHAVES DE API ──
const CHAVES_API = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
].filter(Boolean);

if (CHAVES_API.length === 0) {
    console.error("❌ [Groq] Nenhuma chave de API encontrada! Defina GROQ_API_KEY no .env");
} else {
    console.log(`✅ [Groq] ${CHAVES_API.length} chave(s) de API carregada(s).`);
}

// ── ESTADO DAS CHAVES ──
const estadoChaves = CHAVES_API.map(key => ({
    client:     new Groq({ apiKey: key }),
    esgotada:   false,
    resetaEm:   null,
    keyPreview: key.slice(0, 8) + '...'
}));

// ── MODELOS ──
const MODELO_TEXTO = "llama-3.3-70b-versatile";
const MODELO_VISAO = "meta-llama/llama-4-scout-17b-16e-instruct";

// ── LIMITES DE TOKENS ──
// 2048 truncava respostas longas (ex: [CRIAR_COMANDO] com código JS)
// 8192 é o máximo seguro para o llama-3.3-70b-versatile na Groq
const MAX_TOKENS_TEXTO = 8192;
const MAX_TOKENS_VISAO = 2048; // visão não precisa de tanto

// ── HISTÓRICO DE CONTEXTO ──
const historicoCanais = new Map();
const MAX_HISTORICO   = 10;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function obterClienteDisponivel() {
    const agora = Date.now();
    for (const estado of estadoChaves) {
        if (estado.esgotada && estado.resetaEm && agora >= estado.resetaEm) {
            estado.esgotada = false;
            estado.resetaEm = null;
            console.log(`[Groq] Chave ${estado.keyPreview} liberada novamente.`);
        }
        if (!estado.esgotada) return estado;
    }
    return null;
}

function marcarChaveEsgotada(estado, retryAfterSegundos = null) {
    estado.esgotada = true;
    if (retryAfterSegundos) {
        estado.resetaEm = Date.now() + (retryAfterSegundos * 1000);
        console.warn(`[Groq] Chave ${estado.keyPreview} esgotada. Reseta em ${retryAfterSegundos}s.`);
    } else {
        estado.resetaEm = Date.now() + 60_000;
        console.warn(`[Groq] Chave ${estado.keyPreview} esgotada. Bloqueada por 60s.`);
    }
}

async function chamarGroqComFallback(payload) {
    const MAX_TENTATIVAS_GLOBAIS = CHAVES_API.length * 2;
    let tentativasGlobais = 0;

    while (tentativasGlobais < MAX_TENTATIVAS_GLOBAIS) {
        tentativasGlobais++;

        const estado = obterClienteDisponivel();

        if (!estado) {
            const proximoReset = Math.min(...estadoChaves.map(e => e.resetaEm || Infinity));
            const esperaMs     = Math.max(proximoReset - Date.now(), 1000);
            console.warn(`[Groq] Todas as chaves esgotadas. Aguardando ${Math.round(esperaMs / 1000)}s...`);
            await sleep(esperaMs);
            continue;
        }

        try {
            const chatCompletion = await estado.client.chat.completions.create(payload);

            const escolha    = chatCompletion.choices[0];
            const conteudo   = escolha?.message?.content || "";
            const stopReason = escolha?.finish_reason || "";

            // FIX: detecta se a resposta foi cortada pelo limite de tokens
            if (stopReason === "length") {
                console.warn(`[Groq] ⚠️ Resposta truncada (finish_reason=length). Considere reduzir o prompt ou aumentar max_tokens.`);
                // Retorna o que veio + marcador de truncamento para o chamador tratar
                return conteudo + "\n[RESPOSTA_TRUNCADA]";
            }

            return conteudo;

        } catch (error) {
            const status = error.status || 0;
            const msg    = error.message || "";

            if (status === 429 || msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
                const retryAfter = error.headers?.['retry-after'] || error.response?.headers?.['retry-after'];
                const segundos   = retryAfter ? parseFloat(retryAfter) : null;
                marcarChaveEsgotada(estado, segundos);
                console.warn(`[Groq] Tentando próxima chave disponível...`);
                continue;
            }

            if (status === 503 || msg.includes("503")) {
                console.warn(`[Groq] Serviço 503 — aguardando 3s...`);
                await sleep(3000);
                continue;
            }

            throw error;
        }
    }

    throw new Error("[Groq] Todas as chaves de API estão esgotadas no momento.");
}

async function perguntarParaIA(pergunta, systemInstruction, canalId = null, imagemBase64 = null, mimeType = "image/jpeg") {
    try {
        const temImagem  = !!imagemBase64;
        const modelo     = temImagem ? MODELO_VISAO : MODELO_TEXTO;
        const maxTokens  = temImagem ? MAX_TOKENS_VISAO : MAX_TOKENS_TEXTO;

        let mensagensHistorico = [];
        if (canalId && !temImagem) {
            if (!historicoCanais.has(canalId)) historicoCanais.set(canalId, []);
            mensagensHistorico = historicoCanais.get(canalId);
        }

        let userContent;
        if (temImagem) {
            userContent = [
                {
                    type: "image_url",
                    image_url: { url: `data:${mimeType};base64,${imagemBase64}` }
                },
                {
                    type: "text",
                    text: pergunta || "Descreva esta imagem."
                }
            ];
        } else {
            userContent = pergunta;
        }

        const messages = [
            {
                role: "system",
                content: systemInstruction || "Você é um assistente útil."
            },
            ...mensagensHistorico,
            {
                role: "user",
                content: userContent
            }
        ];

        const payload = {
            model:       modelo,
            messages,
            temperature: 0.7,
            max_tokens:  maxTokens,
        };

        let resposta = await chamarGroqComFallback(payload);

        // FIX: se veio truncada, avisa e não salva no histórico (resposta inválida)
        if (resposta.includes("[RESPOSTA_TRUNCADA]")) {
            resposta = resposta.replace("[RESPOSTA_TRUNCADA]", "").trim();
            console.warn("[Groq] Resposta entregue truncada ao chamador.");
            // Não salva no histórico para não contaminar contexto futuro
            return resposta;
        }

        // Salva no histórico só se a resposta foi completa
        if (canalId && resposta) {
            const hist = historicoCanais.get(canalId) || [];
            const conteudoUsuario = temImagem
                ? `[usuário enviou uma imagem] ${pergunta}`
                : pergunta;
            hist.push({ role: "user",      content: conteudoUsuario });
            hist.push({ role: "assistant", content: resposta });
            while (hist.length > MAX_HISTORICO * 2) hist.splice(0, 2);
            historicoCanais.set(canalId, hist);
        }

        return resposta;

    } catch (error) {
        const status = error.status || 0;
        const msg    = error.message || "";

        console.error("🚨 [Groq] Erro final:", msg);

        if (status === 401 || msg.includes("401"))
            return "❌ Chave de API inválida. Verifique as variáveis GROQ_API_KEY no `.env`.";
        if (msg.includes("Todas as chaves"))
            return "⏳ Limite diário atingido em todas as chaves. Tente novamente mais tarde.";
        if (status === 429 || msg.includes("429"))
            return "⏳ Limite de requisições atingido. Tente novamente em alguns segundos.";
        if (status === 503 || msg.includes("503"))
            return "⚠️ Serviço da Groq temporariamente indisponível. Tente em instantes.";

        return "❌ Erro ao processar a IA. Verifique os logs do console para detalhes.";
    }
}

function limparHistoricoCanal(canalId) {
    historicoCanais.delete(canalId);
}

module.exports = { perguntarParaIA, limparHistoricoCanal };
