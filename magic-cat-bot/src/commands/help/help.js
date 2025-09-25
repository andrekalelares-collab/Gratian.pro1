const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('📜 Mostra todos os comandos disponíveis do Magic Cat.'),

    async execute(interaction, client) {
        const prefix = '?'; // Ainda pode mostrar prefix para referência

        const embed = new EmbedBuilder()
            .setTitle('🪄 Magic Cat - Central de Comandos')
            .setDescription(`Olá, **${interaction.user.username}**! Aqui estão os comandos disponíveis:`)
            .setColor('#000000') // Preto
            .setFooter({ text: 'Magic Cat • Seu bot full brasileiro 2025/2024', iconURL: client.user.displayAvatarURL() })
            .setTimestamp()
            .addFields(
                { name: '⚙️ Administração', value: `
/giverole-all - Adiciona um cargo a todos os membros.
/giverole-remove - Remove um cargo de todos os membros.
/avisouser - Envia aviso privado para um usuário.
                `, inline: false },
                { name: '📝 Diversão e Utilitários', value: `
/embed-criar - Cria uma embed personalizada.
/bot-info - Mostra informações do Magic Cat.
                `, inline: false },
                { name: '💡 Como usar', value: `Use /comando para executar cada comando.` }
            );

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
