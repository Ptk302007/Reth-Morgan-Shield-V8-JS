// ============================================================
//  RETH MORGAN — GROQ AI MODULE
//  groq.js — Integração com a API da Groq (com suporte a visão)
//  ✅ Retry automático com backoff exponencial no erro 429
// ============================================================
const Groq = require("groq-sdk");

const apiKey = process.env.GROQ_API_KEY || "";
if (!apiKey) {
    console.warn("⚠️  [Groq] Nenhuma chave de API encontrada! Defina GROQ_API_KEY no .env ou cole diretamente em groq.js.");
}

const groq = new Groq({ apiKey });

// ── MODELOS ──
const MODELO_TEXTO = "llama-3.3-70b-versatile";                    // texto puro (Discord + chat sem imagem)
const MODELO_VISAO = "meta-llama/llama-4-scout-17b-16e-instruct";  // suporta imagem (vision)

// ── HISTÓRICO DE CONTEXTO ──
const historicoCanais = new Map();
const MAX_HISTORICO   = 10;

// ── FILA SIMPLES PARA EVITAR RAFAGAS ──
// Garante que só uma requisição por vez sai para a Groq por canal
const filaRequisicoes = new Map();

/**
 * sleep(ms) — pausa assíncrona
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * chamarGroqComRetry — faz a chamada à API com até maxTentativas retries
 * usando backoff exponencial quando bate rate limit (429).
 *
 * @param {object} payload        - Objeto passado para groq.chat.completions.create
 * @param {number} maxTentativas  - Máximo de tentativas (padrão: 4)
 * @returns {Promise<string>}     - Texto da resposta
 */
async function chamarGroqComRetry(payload, maxTentativas = 4) {
    let tentativa = 0;

    while (tentativa < maxTentativas) {
        try {
            const chatCompletion = await groq.chat.completions.create(payload);
            return chatCompletion.choices[0]?.message?.content || "";
        } catch (error) {
            const status = error.status || 0;
            const msg    = error.message || "";

            // ── 429: Rate Limit — espera e tenta de novo ──
            if (status === 429 || msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
                tentativa++;

                if (tentativa >= maxTentativas) {
                    console.warn(`[Groq] Rate limit atingido após ${maxTentativas} tentativas. Desistindo.`);
                    throw error; // deixa o handler externo tratar
                }

                // Tenta ler o header "retry-after" se disponível (em segundos)
                let espera = Math.pow(2, tentativa) * 1000; // 2s, 4s, 8s ...
                const retryAfter = error.headers?.['retry-after'] || error.response?.headers?.['retry-after'];
                if (retryAfter) {
                    const segundos = parseFloat(retryAfter);
                    if (!isNaN(segundos)) espera = (segundos + 0.5) * 1000;
                }

                console.warn(`[Groq] Rate limit 429 — aguardando ${Math.round(espera / 1000)}s antes de tentar novamente (tentativa ${tentativa}/${maxTentativas})...`);
                await sleep(espera);
                continue;
            }

            // ── 503: Serviço indisponível — tenta mais uma vez após pausa curta ──
            if (status === 503 || msg.includes("503")) {
                tentativa++;
                if (tentativa >= maxTentativas) throw error;
                const espera = 3000;
                console.warn(`[Groq] Serviço indisponível 503 — aguardando ${espera / 1000}s (tentativa ${tentativa}/${maxTentativas})...`);
                await sleep(espera);
                continue;
            }

            // Qualquer outro erro: não tenta de novo
            throw error;
        }
    }

    throw new Error("[Groq] Número máximo de tentativas atingido.");
}

/**
 * perguntarParaIA(pergunta, systemInstruction, canalId?, imagemBase64?, mimeType?)
 *
 * @param {string}  pergunta           - Mensagem do usuário
 * @param {string}  systemInstruction  - Prompt de sistema
 * @param {string}  [canalId]          - ID do canal (habilita contexto multi-turno)
 * @param {string}  [imagemBase64]     - Imagem em base64 (opcional)
 * @param {string}  [mimeType]         - MIME type da imagem (ex: "image/jpeg")
 * @returns {Promise<string>}
 */
async function perguntarParaIA(pergunta, systemInstruction, canalId = null, imagemBase64 = null, mimeType = "image/jpeg") {
    try {
        const temImagem = !!imagemBase64;
        const modelo    = temImagem ? MODELO_VISAO : MODELO_TEXTO;

        // ── Histórico (apenas para texto; visão não usa histórico pra evitar payload enorme) ──
        let mensagensHistorico = [];
        if (canalId && !temImagem) {
            if (!historicoCanais.has(canalId)) historicoCanais.set(canalId, []);
            mensagensHistorico = historicoCanais.get(canalId);
        }

        // ── Monta conteúdo da mensagem do usuário ──
        let userContent;
        if (temImagem) {
            userContent = [
                {
                    type: "image_url",
                    image_url: {
                        url: `data:${mimeType};base64,${imagemBase64}`
                    }
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

        // ── Chama com retry automático ──
        const resposta = await chamarGroqComRetry(payload);

        // ── Salva histórico ──
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

        console.error("🚨 [Groq] Erro na requisição:", msg);

        if (status === 401 || msg.includes("401"))
            return "❌ Chave de API inválida. Verifique GROQ_API_KEY no seu `.env`.";
        if (status === 429 || msg.includes("429") || msg.toLowerCase().includes("rate limit"))
            return "⏳ Muitas requisições simultâneas. A IA já vai responder — tente novamente em alguns segundos.";
        if (status === 503 || msg.includes("503"))
            return "⚠️ Serviço da Groq temporariamente indisponível. Tente em instantes.";

        return "❌ Erro ao processar a IA. Verifique os logs do console para detalhes.";
    }
}

/**
 * limparHistoricoCanal(canalId)
 */
function limparHistoricoCanal(canalId) {
    historicoCanais.delete(canalId);
}

module.exports = { perguntarParaIA, limparHistoricoCanal };
