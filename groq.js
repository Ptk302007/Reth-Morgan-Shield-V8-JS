// ============================================================
//  RETH MORGAN — GROQ AI MODULE
//  groq.js — Integração com a API da Groq (com suporte a visão)
// ============================================================
const Groq = require("groq-sdk");

const apiKey = process.env.GROQ_API_KEY || "";
if (!apiKey) {
    console.warn("⚠️  [Groq] Nenhuma chave de API encontrada! Defina GROQ_API_KEY no .env ou cole diretamente em groq.js.");
}

const groq = new Groq({ apiKey });

// ── MODELOS ──
const MODELO_TEXTO  = "llama-3.3-70b-versatile";         // texto puro (Discord + chat sem imagem)
const MODELO_VISAO  = "meta-llama/llama-4-scout-17b-16e-instruct"; // suporta imagem (vision)

// ── HISTÓRICO DE CONTEXTO ──
const historicoCanais = new Map();
const MAX_HISTORICO   = 10;

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

        const chatCompletion = await groq.chat.completions.create({
            model:       modelo,
            messages,
            temperature: 0.7,
            max_tokens:  1024,
        });

        const resposta = chatCompletion.choices[0]?.message?.content || "";

        // ── Salva histórico (para imagem, salva só o texto da resposta, não a imagem) ──
if (canalId && resposta) {
    const hist = historicoCanais.get(canalId) || [];
    // Para imagem, registra só que havia uma imagem (não o base64)
    const userContent = temImagem
        ? `[usuário enviou uma imagem] ${pergunta}`
        : pergunta;
    hist.push({ role: "user",      content: userContent });
    hist.push({ role: "assistant", content: resposta });
    while (hist.length > MAX_HISTORICO * 2) hist.splice(0, 2);
    historicoCanais.set(canalId, hist);
}

        return resposta;
    } catch (error) {
        console.error("🚨 [Groq] Erro na requisição:", error.message);
        if (error.status === 401 || error.message?.includes("401"))
            return "❌ Chave de API inválida. Verifique GROQ_API_KEY no seu `.env`.";
        if (error.status === 429 || error.message?.includes("429"))
            return "⏳ Limite de requisições atingido. Aguarde alguns segundos e tente novamente.";
        if (error.status === 503 || error.message?.includes("503"))
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
