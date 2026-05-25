const { GoogleGenerativeAI } = require("@google/generative-ai");

// COLA A CHAVE NOVA GERADA NO AI STUDIO DA CONTA NOVA AQUI
// Certifique-se de que não haja espaços extras no início ou no fim.
const apiKey = "AIzaSyCS5dGhHnTUlYyMq-nqYrUcJJzeNHzRzcE"; 

const genAI = new GoogleGenerativeAI(apiKey);

async function perguntarParaIA(pergunta, systemInstruction) {
    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: systemInstruction
        });

        const result = await model.generateContent(pergunta);
        const response = await result.response;
        return response.text();
    } catch (error) {
        // Log detalhado para identificar falhas de permissão (403) ou modelo não encontrado (404)
        console.error("🚨 ERRO 403/404 DETECTADO:", error.message);
        
        if (error.message.includes("403")) {
            return "Erro de permissão: A sua chave de API não tem acesso a este modelo ou está bloqueada no projeto atual.";
        }
        if (error.message.includes("404")) {
            return "Erro: O modelo especificado não foi encontrado. Verifique se a Generative Language API está ativa no Google Cloud.";
        }
        
        return "Erro ao processar a IA. Certifique-te que a chave é nova e gerada neste projeto novo.";
    }
}

module.exports = { perguntarParaIA };