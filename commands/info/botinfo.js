module.exports = {
    name: 'botinfo',
    aliases: ['bi', 'status'],
    execute: async (msg, args, client) => {
        // Calcula o consumo de RAM do processo em Megabytes (MB)
        const usoMemoria = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        
        // Pega a versão do Node instalada na máquina
        const versaoNode = process.version;
        
        // Conta em quantos servidores o bot está ativado
        const totalServidores = client.guilds.cache.size;

        msg.reply(
            `🤖 **STATUS DO SISTEMA RETH MORGAN**\n\n` +
            `• **Servidores Conectados:** \`${totalServidores}\`\n` +
            `• **Consumo de Memória RAM:** \`${usoMemoria} MB\`\n` +
            `• **Versão do Node.js:** \`${versaoNode}\`\n` +
            `• **Biblioteca:** \`Discord.js v14\`\n` +
            `• **Ping da API:** \`${Math.round(client.ws.ping)}ms\``
        );
    }
};