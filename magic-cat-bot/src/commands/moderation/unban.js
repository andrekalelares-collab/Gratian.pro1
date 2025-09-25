const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

// CORRIGIDO: A linha abaixo estava com um erro de digitação.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('🛡️ Remove o banimento de um usuário.')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(option =>
            option.setName('usuario')
                .setDescription('O ID do usuário a ser desbanido.')
                .setRequired(true)
                .setAutocomplete(true)),
    
    async autocomplete(interaction, client) {
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.respond([]);
        }
        const focusedValue = interaction.options.getFocused();
        const bans = await interaction.guild.bans.fetch();
        const choices = bans
            .map(ban => ({ name: `${ban.user.tag} (${ban.user.id})`, value: ban.user.id }))
            .filter(choice => choice.name.toLowerCase().includes(focusedValue.toLowerCase()))
            .slice(0, 25); 

        await interaction.respond(choices);
    },

    async execute(interaction, client) {
        const userId = interaction.options.getString('usuario');
        const { guild } = interaction;

        if (!guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.reply({
                content: `${client.config.emojis.error} Eu não tenho a permissão de **Banir Membros** para executar esta ação.`,
                ephemeral: true,
            });
        }

        try {
            // Verifica se o usuário está realmente banido antes de tentar desbanir
            const banList = await guild.bans.fetch();
            const bannedUser = banList.get(userId);

            if (!bannedUser) {
                return interaction.reply({
                    content: `${client.config.emojis.error} Este usuário não está na lista de banidos. Verifique o ID.`,
                    ephemeral: true
                });
            }

            await guild.members.unban(bannedUser.user);

            const embed = new EmbedBuilder()
                .setTitle(`${client.config.emojis.success} Usuário Desbanido`)
                .setColor(client.config.colors.success)
                .setDescription(`O usuário **${bannedUser.user.tag}** (\`${userId}\`) foi desbanido com sucesso.`)
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[ERRO NO UNBAN]:', error);
            await interaction.reply({
                content: `${client.config.emojis.error} Não foi possível desbanir o usuário. Pode ser um ID inválido ou um erro interno.`,
                ephemeral: true
            });
        }
    },
};