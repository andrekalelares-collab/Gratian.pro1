const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('🛡️ Remove o castigo (timeout) de um usuário.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('O usuário que terá o castigo removido.')
                .setRequired(true)),
    async execute(interaction, client) {
        const member = interaction.options.getMember('usuario');
        const { guild } = interaction;

        if (!member.isCommunicationDisabled()) {
            return interaction.reply({
                content: `${client.config.emojis.error} Este usuário não está de castigo.`,
                ephemeral: true
            });
        }

        try {
            await member.timeout(null); // Passar 'null' remove o timeout

            const embed = new EmbedBuilder()
                .setTitle(`${client.config.emojis.success} Castigo Removido`)
                .setColor(client.config.colors.success)
                .setDescription(`O castigo do usuário ${member} foi removido com sucesso.`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: `${client.config.emojis.error} Ocorreu um erro. Verifique se meu cargo é superior ao do membro que você está tentando gerenciar.`,
                ephemeral: true
            });
        }
    },
};
