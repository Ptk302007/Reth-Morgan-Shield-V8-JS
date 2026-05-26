// ============================================================
//  RETH MORGAN — GROQ AI MODULE
//  groq.js — Integração com a API da Groq (substitui gemini.js)
// ============================================================

const Groq = require("groq-sdk");

// ── CHAVE DA API ──
// Coloque sua chave aqui OU defina a variável de ambiente GROQ_API_KEY no .env
const apiKey = process.env.GROQ_API_KEY || "";

if (!apiKey) {
    console.warn("⚠️  [Groq] Nenhuma chave de API encontrada! Defina GROQ_API_KEY no .env ou cole diretamente em groq.js.");
}

const groq = new Groq({ apiKey });

// ── HISTÓRICO DE CONTEXTO (para conversas multi-turno no Discord) ──
// Guarda até 10 trocas por canal para dar contexto à IA
const historicoCanais = new Map();
const MAX_HISTORICO   = 10; // pares usuário/assistente

/**
 * perguntarParaIA(pergunta, systemInstruction, canalId?)
 *
 * @param {string} pergunta          - Mensagem do usuário
 * @param {string} systemInstruction - Prompt de sistema (personalidade/diretrizes)
 * @param {string} [canalId]         - ID do canal Discord (opcional, habilita contexto multi-turno)
 * @returns {Promise<string>}        - Resposta em texto da IA
 */
async function perguntarParaIA(pergunta, systemInstruction, canalId = null) {
    try {
        // ── Monta histórico do canal (se fornecido) ──
        let mensagensHistorico = [];
        if (canalId) {
            if (!historicoCanais.has(canalId)) historicoCanais.set(canalId, []);
            mensagensHistorico = historicoCanais.get(canalId);
        }

        // ── Monta array de mensagens para a Groq ──
        const messages = [
            {
                role: "system",
                content: systemInstruction || "Você é um assistente útil."
            },
            ...mensagensHistorico,
            {
                role: "user",
                content: pergunta
            }
        ];

        const chatCompletion = await groq.chat.completions.create({
            model:       "llama-3.3-70b-versatile", // Melhor modelo gratuito da Groq (Jan/2025)
            messages,
            temperature: 0.7,
            max_tokens:  1024,
        });

        const resposta = chatCompletion.choices[0]?.message?.content || "";

        // ── Salva no histórico do canal ──
        if (canalId && resposta) {
            const hist = historicoCanais.get(canalId);
            hist.push({ role: "user",      content: pergunta  });
            hist.push({ role: "assistant", content: resposta  });

            // Mantém apenas os últimos MAX_HISTORICO pares
            while (hist.length > MAX_HISTORICO * 2) hist.splice(0, 2);
            historicoCanais.set(canalId, hist);
        }

        return resposta;

    } catch (error) {
        console.error("🚨 [Groq] Erro na requisição:", error.message);

        if (error.status === 401 || error.message?.includes("401")) {
            return "❌ Chave de API inválida. Verifique GROQ_API_KEY no seu `.env`.";
        }
        if (error.status === 429 || error.message?.includes("429")) {
            return "⏳ Limite de requisições atingido. Aguarde alguns segundos e tente novamente.";
        }
        if (error.status === 503 || error.message?.includes("503")) {
            return "⚠️ Serviço da Groq temporariamente indisponível. Tente em instantes.";
        }

        return "❌ Erro ao processar a IA. Verifique os logs do console para detalhes.";
    }
}

/**
 * limparHistoricoCanal(canalId)
 * Limpa o histórico de conversa de um canal específico.
 */
function limparHistoricoCanal(canalId) {
    historicoCanais.delete(canalId);
}

module.exports = { perguntarParaIA, limparHistoricoCanal };
