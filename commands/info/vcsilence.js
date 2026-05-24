// Arquivo: commands/voice/vcsilence.js
module.exports = {
    name: 'vcsilence',
    execute: async (msg) => {
        const voiceChannel = msg.member.voice.channel;
        if (!voiceChannel) return msg.reply('❌ Você precisa estar logado em uma call para rodar esse comando.');

        for (const [, membro] of voiceChannel.members) {
            if (membro.id !== msg.author.id) {
                await membro.voice.setMute(true, 'Silenciamento Geral acionado pela Staff.').catch(() => {});
            }
        }
        return msg.reply(`🤫 **Modo Silêncio:** Todos os membros da call \`${voiceChannel.name}\` foram mutados.`);
    }
};