// ============================================================
//  RETH MORGAN — GROQ AI MODULE
//  groq.js — Integração com a API da Groq (com suporte a visão)
//  ✅ Múltiplas chaves API com fallback automático
//  ✅ Retry com backoff exponencial no erro 429
// ============================================================
const Groq = require("groq-sdk");

// ── CHAVES DE API ──
// Adicione quantas quiser. O bot usa a primeira, e se esgotar passa pra próxima.
// No .env defina: GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3 ...
const CHAVES_API = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
].filter(Boolean); // remove as que não foram definidas

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
const MODELO_TEXTO = "llama-3.1-8b-instant";
const MODELO_VISAO = "meta-llama/llama-4-scout-17b-16e-instruct";

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
            return chatCompletion.choices[0]?.message?.content || "";

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
        const temImagem = !!imagemBase64;
        const modelo    = temImagem ? MODELO_VISAO : MODELO_TEXTO;

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
            max_tokens:  1024,
        };

        const resposta = await chamarGroqComFallback(payload);

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
