'use strict';
const { EmbedBuilder } = require('discord.js');
const bonus = require('../../lib/bonus');

const cooldowns = new Map();

module.exports = {
    name: 'trabalhar',
    aliases: ['work', 'trampo'],
    execute: async (msg) => {
        const agora = Date.now();
        const cd = cooldowns.get(msg.author.id);
        if (cd && agora - cd < 3_600_000) {
            const restante = Math.ceil((3_600_000 - (agora - cd)) / 60_000);
            return msg.reply(`⏰ Você precisa descansar! Volte em **${restante} minuto(s)**.`);
        }

        const empregos = [
            { nome: 'Programador', desc: 'Você codou o dia todo e recebeu', emoji: '💻' },
            { nome: 'Policial',    desc: 'Você patrulhou a cidade e recebeu', emoji: '👮' },
            { nome: 'Chef',        desc: 'Você cozinhou pratos incríveis e recebeu', emoji: '👨‍🍳' },
            { nome: 'Streamer',    desc: 'Sua live bombou e você recebeu', emoji: '🎮' },
            { nome: 'Médico',      desc: 'Você atendeu pacientes e recebeu', emoji: '🏥' },
            { nome: 'Mototaxista', desc: 'Você rodou o dia todo e recebeu', emoji: '🏍️' },
            { nome: 'Taxista',     desc: 'Você trabalhou o dia todo e recebeu', emoji: '🚕' },
        ];

        const emprego = empregos[Math.floor(Math.random() * empregos.length)];
        const ganho   = Math.floor(Math.random() * 451) + 50;

        const dados = bonus.ler();
        bonus.garantir(dados, msg.guild.id, msg.author.id);
        dados[msg.guild.id][msg.author.id].coins += ganho;
        bonus.salvar(dados);

        cooldowns.set(msg.author.id, agora);

        const saldo = dados[msg.guild.id][msg.author.id].coins;

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle(`${emprego.emoji} Trabalho: ${emprego.nome}`)
            .setDescription(`${emprego.desc} **${ganho} 🪙**!\nSeu saldo: **${saldo} 🪙** 💰`);

        return msg.reply({ embeds: [embed] });
    },
};