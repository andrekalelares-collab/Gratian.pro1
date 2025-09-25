const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const os = require('node:os');
const process = require('process');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bot-info')
        .setDescription('📊 Mostra informações detalhadas do Magic Cat!'),
    async execute(interaction, client) {
        // Memória usada pelo bot
        const memoryUsageMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const totalMemoryMB = (os.totalmem() / 1024 / 1024).toFixed(0);

        // Uptime em horas, minutos e segundos
        const uptimeSeconds = process.uptime();
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = Math.floor(uptimeSeconds % 60);

        // Cria o embed
        const embed = new EmbedBuilder()
            .setTitle(`🐱 Magic Cat - Informações do Bot`)
            .setColor('#000000') // Preto
            .setDescription('📌 Aqui estão os detalhes do bot Magic Cat!')
            .addFields(
                { name: '🤖 Nome do Bot', value: `${client.user.tag}`, inline: true },
                { name: '🖥 Hospedagem', value: 'Gratian.pro (em breve)', inline: true },
                { name: '⚡ Servidores', value: `${client.guilds.cache.size}`, inline: true },
                { name: '💾 Memória usada', value: `${memoryUsageMB} MB / ${totalMemoryMB} MB`, inline: true },
                { name: '⏱ Uptime', value: `${hours}h ${minutes}m ${seconds}s`, inline: true },
                { name: '💡 Comandos', value: `Use \`?help\` ou \`/help\` para ver todos os comandos disponíveis`, inline: false },
                { name: '🎨 Tema', value: 'Preto e Branco', inline: true },
            )
            .setFooter({ text: `Magic Cat | Desenvolvido para sua comunidade!` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: false });
    },
};
