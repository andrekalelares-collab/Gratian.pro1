const { Events, EmbedBuilder, InteractionType } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {

        // --- COMANDOS DE BARRA (/)
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error(`Erro ao executar o comando ${interaction.commandName}`, error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'Ocorreu um erro!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'Ocorreu um erro!', ephemeral: true });
                }
            }
        }

        // --- AUTOCOMPLETE
        else if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (!command || !command.autocomplete) return;

            try {
                await command.autocomplete(interaction, client);
            } catch (error) {
                console.error('Erro no autocompletar:', error);
            }
        }

        // --- MODAIS
        else if (interaction.isModalSubmit()) {
            if (interaction.customId === 'embed_creator_modal') {
                await interaction.deferReply({ ephemeral: true });
                const title = interaction.fields.getTextInputValue('embed_title');
                const description = interaction.fields.getTextInputValue('embed_description');
                const color = interaction.fields.getTextInputValue('embed_color') || client.config.colors.default;

                if (!/^#[0-9A-F]{6}$/i.test(color)) {
                    return interaction.editReply({
                        content: `${client.config.emojis.error} O formato da cor é inválido. Use um código hexadecimal (ex: #FFFFFF).`,
                        ephemeral: true
                    });
                }

                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(description.replace(/\\n/g, '\n'))
                    .setColor(color)
                    .setTimestamp();

                try {
                    await interaction.channel.send({ embeds: [embed] });
                    await interaction.editReply({
                        content: `${client.config.emojis.success} Embed enviado com sucesso!`,
                        ephemeral: true
                    });
                } catch (err) {
                    await interaction.editReply({
                        content: `${client.config.emojis.error} Não foi possível enviar a embed neste canal. Verifique minhas permissões.`,
                        ephemeral: true
                    });
                }
            }
        }

        // --- COMPONENTES (BOTÕES / MENUS)
        else if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isAnySelectMenu()) {
            try {
                const customId = interaction.customId ?? '';
                const prefix = customId.split(/[:_-]/)[0];
                const handlerCmd = client.commands.get(prefix);

                if (handlerCmd && typeof handlerCmd.componentHandler === 'function') {
                    try {
                        await handlerCmd.componentHandler(interaction, client);
                    } catch (err) {
                        console.error('Erro em componentHandler do comando', prefix, err);
                        try { await interaction.reply({ content: 'Erro no componente.', ephemeral: true }); } catch {}
                    }
                    return;
                }

                // Sem handler global — permite que collectors locais funcionem
                return;
            } catch (err) {
                console.error('[COMPONENT HANDLER ERROR]', err);
                return;
            }
        }

    },
};
