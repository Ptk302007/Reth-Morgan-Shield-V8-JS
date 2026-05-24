// File: commands/admin/bl.js
const fs = require('fs');

module.exports = {
    name: 'bl',
    aliases: ['blacklist'],
    ownerOnly: true, // Só você roda
    execute: async (msg, args) => {
        const acao = args[0];
        const target = msg.mentions.users.first() || (args[1] ? { id: args[1] } : null);

        if (!acao || !['add', 'remove', 'list'].includes(acao)) {
            return msg.reply('📌 Uso correto: `!bl add [@user/ID]`, `!bl remove [@user/ID]` ou `!bl list`');
        }

        let blacklist = JSON.parse(fs.readFileSync('./database/blacklist.json', 'utf-8'));

        if (acao === 'list') {
            if (blacklist.length === 0) return msg.reply('ℹ️ Nenhum usuário está na Blacklist.');
            return msg.reply(`🚫 **Usuários na Blacklist (IDs):**\n\`\`\`\n${blacklist.join('\n')}\n\`\`\``);
        }

        if (!target) return msg.reply('❌ Você precisa mencionar alguém ou digitar um ID válido.');

        if (acao === 'add') {
            // TRAVA DE SEGURANÇA: Evita banir você mesmo (Dono)
            if (target.id === msg.author.id) {
                return msg.reply('❌ Você não pode adicionar a si mesmo na Blacklist!');
            }
            // TRAVA DE SEGURANÇA: Evita banir o próprio bot
            if (target.id === client.user.id) {
                return msg.reply('❌ Você não pode adicionar o próprio bot na Blacklist!');
            }
            
            if (blacklist.includes(target.id)) return msg.reply('❌ Esse usuário já está na Blacklist.');
            
            blacklist.push(target.id);
            fs.writeFileSync('./database/blacklist.json', JSON.stringify(blacklist, null, 2));
            return msg.reply(`🚫 Usuário <@${target.id}> adicionado à Blacklist com sucesso.`);
        }

        if (acao === 'remove') {
            if (!blacklist.includes(target.id)) return msg.reply('❌ Esse usuário não está na Blacklist.');
            blacklist = blacklist.filter(id => id !== target.id);
            fs.writeFileSync('./database/blacklist.json', JSON.stringify(blacklist, null, 2));
            return msg.reply(`✅ Usuário <@${target.id}> removido da Blacklist.`);
        }
    }
};