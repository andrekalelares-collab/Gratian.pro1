const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed-criar')
    .setDescription('📝 Criador avançado de embed (menu + modal + preview)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    // resposta inicial com menu
    const menu = new StringSelectMenuBuilder()
      .setCustomId('embed_menu')
      .setPlaceholder('Escolha o que deseja editar na embed')
      .addOptions([
        { label: 'Título', value: 'title', emoji: '📝', description: 'Definir título' },
        { label: 'Descrição', value: 'description', emoji: '📜', description: 'Definir descrição' },
        { label: 'Cor', value: 'color', emoji: '🎨', description: 'Cor em HEX' },
        { label: 'Footer', value: 'footer', emoji: '🔖', description: 'Texto do rodapé' },
        { label: 'Adicionar campo', value: 'field', emoji: '➕', description: 'Adicionar um campo (name|value)' },
        { label: 'Enviar embed', value: 'send', emoji: '✅', description: 'Enviar a embed pronta' }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    const replyMessage = await interaction.reply({
      content: 'Use o menu abaixo para configurar sua embed. Depois confirme para enviar.',
      components: [row],
      ephemeral: true,
      fetchReply: true
    });

    // estado do builder (local à execução)
    const state = {
      title: null,
      description: null,
      color: '#000000', // padrão preto
      footer: null,
      fields: [] // { name, value, inline }
    };

    // collector para selecionar opções (apenas autor)
    const menuCollector = replyMessage.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 5 * 60 * 1000,
      filter: i => i.user.id === interaction.user.id
    });

    // botões de confirmação (serão usados quando formos mostrar preview)
    const btnConfirm = new ButtonBuilder().setCustomId('embed_confirm').setLabel('Enviar').setStyle(ButtonStyle.Success).setEmoji('📤');
    const btnCancel = new ButtonBuilder().setCustomId('embed_cancel').setLabel('Cancelar').setStyle(ButtonStyle.Danger).setEmoji('⛔');
    const btnPreview = new ButtonBuilder().setCustomId('embed_preview').setLabel('Pré-visualizar').setStyle(ButtonStyle.Secondary).setEmoji('🔎');

    async function buildEmbedFromState() {
      const e = new EmbedBuilder();
      if (state.title) e.setTitle(state.title);
      if (state.description) e.setDescription(state.description);
      if (state.color) {
        try { e.setColor(state.color); } catch { e.setColor('#000000'); }
      }
      if (state.footer) e.setFooter({ text: state.footer });
      if (state.fields?.length) e.addFields(...state.fields.slice(0, 25));
      e.setTimestamp();
      return e;
    }

    menuCollector.on('collect', async selectInteraction => {
      // showModal responde a interaction; não defira aqui
      const choice = selectInteraction.values[0];

      // se escolher enviar direto -> abre preview confirm modal flow
      if (choice === 'send') {
        const embedToSend = await buildEmbedFromState();
        const previewRow = new ActionRowBuilder().addComponents(btnPreview, btnConfirm, btnCancel);
        // atualiza mensagem ephemeral do usuário com preview e botões
        await selectInteraction.update({ content: 'Preview abaixo. Confirme para enviar.', embeds: [embedToSend], components: [previewRow], ephemeral: true });
        return;
      }

      // modal id único para esta execução
      const modalId = `embed_modal:${choice}:${interaction.user.id}:${Date.now()}`;
      const modal = new ModalBuilder().setCustomId(modalId).setTitle(`Editar: ${choice}`);

      // constrói campos do modal por escolha
      if (choice === 'title') {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('embed_title')
              .setLabel('Título')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder('Digite o título...')
          )
        );
      } else if (choice === 'description') {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('embed_description')
              .setLabel('Descrição')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setPlaceholder('Digite a descrição...')
          )
        );
      } else if (choice === 'color') {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('embed_color')
              .setLabel('Cor HEX (ex: #000000)')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder('#000000')
          )
        );
      } else if (choice === 'footer') {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('embed_footer')
              .setLabel('Footer (texto)')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setPlaceholder('Texto do rodapé...')
          )
        );
      } else if (choice === 'field') {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('embed_field_name')
              .setLabel('Nome do campo')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder('Ex: Regras')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('embed_field_value')
              .setLabel('Valor do campo')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setPlaceholder('Conteúdo do campo...')
          )
        );
      } else {
        return selectInteraction.update({ content: 'Opção desconhecida.', components: [], ephemeral: true });
      }

      // mostra modal ao usuário (responde à interação)
      try {
        await selectInteraction.showModal(modal);
      } catch (err) {
        console.error('Erro ao chamar showModal:', err);
        return selectInteraction.update({ content: 'Erro ao abrir o modal. Tente novamente.', components: [], ephemeral: true });
      }

      // aguarda submissão do modal usando o próprio selectInteraction
      let submitted;
      try {
        submitted = await selectInteraction.awaitModalSubmit({
          time: 120000,
          filter: (m) => m.customId === modalId && m.user.id === interaction.user.id
        });
      } catch {
        // timeout
        try { await interaction.followUp({ content: 'Tempo esgotado no modal.', ephemeral: true }); } catch {}
        return;
      }

      // processa valores do modal e atualiza state
      try {
        if (choice === 'title') {
          const v = submitted.fields.getTextInputValue('embed_title')?.trim();
          if (!v) return submitted.reply({ content: 'Título inválido.', ephemeral: true });
          state.title = v;
        } else if (choice === 'description') {
          const v = submitted.fields.getTextInputValue('embed_description')?.trim();
          if (!v) return submitted.reply({ content: 'Descrição inválida.', ephemeral: true });
          state.description = v;
        } else if (choice === 'color') {
          const v = submitted.fields.getTextInputValue('embed_color')?.trim();
          if (!/^#([0-9A-F]{6})$/i.test(v)) return submitted.reply({ content: 'Cor inválida. Use HEX como #000000', ephemeral: true });
          state.color = v;
        } else if (choice === 'footer') {
          const v = submitted.fields.getTextInputValue('embed_footer')?.trim() || null;
          state.footer = v;
        } else if (choice === 'field') {
          const name = submitted.fields.getTextInputValue('embed_field_name')?.trim();
          const value = submitted.fields.getTextInputValue('embed_field_value')?.trim();
          if (!name || !value) return submitted.reply({ content: 'Campo inválido.', ephemeral: true });
          state.fields.push({ name, value, inline: false });
        }
      } catch (err) {
        console.error('Erro processando modal:', err);
        try { await submitted.reply({ content: 'Erro ao processar o formulário.', ephemeral: true }); } catch {}
        return;
      }

      // depois do submit, mostra preview atualizado (edita a mesma mensagem ephemeral)
      const updatedEmbed = await buildEmbedFromState();
      try {
        await submitted.reply({ content: 'Alteração aplicada. Veja a pré-visualização atualizada abaixo.', embeds: [updatedEmbed], ephemeral: true });
      } catch (err) {
        console.error('Erro ao enviar preview:', err);
      }
    }); // end menuCollector.on collect

    // collector de botões para confirmação (criado sobre a própria replyMessage)
    const btnCollector = replyMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 5 * 60 * 1000,
      filter: i => i.user.id === interaction.user.id
    });

    btnCollector.on('collect', async btn => {
      try {
        if (btn.customId === 'embed_cancel') {
          await btn.update({ content: 'Operação cancelada.', embeds: [], components: [], ephemeral: true });
          menuCollector.stop();
          btnCollector.stop();
          return;
        }

        if (btn.customId === 'embed_preview') {
          const preview = await buildEmbedFromState();
          return await btn.update({ content: 'Pré-visualização atualizada.', embeds: [preview], components: [], ephemeral: true });
        }

        if (btn.customId === 'embed_confirm') {
          const final = await buildEmbedFromState();
          // envia no canal onde o comando foi usado (não ephemeral)
          await interaction.channel.send({ embeds: [final] });
          await btn.update({ content: '✅ Embed enviada no canal.', embeds: [], components: [], ephemeral: true });
          menuCollector.stop();
          btnCollector.stop();
          return;
        }

      } catch (err) {
        console.error('Erro no botão:', err);
        try { await btn.reply({ content: 'Erro interno.', ephemeral: true }); } catch {}
      }
    });

    // cleanup quando collectors terminam
    menuCollector.on('end', () => {
      try { replyMessage.edit?.({ components: [] }).catch(() => {}); } catch {}
    });
    btnCollector.on('end', () => {
      try { replyMessage.edit?.({ components: [] }).catch(() => {}); } catch {}
    });
  }
};
