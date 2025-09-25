const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avisouser')
    .setDescription('📨 Envia um aviso privado para um usuário. Fluxo moderno e profissional.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption(o => o.setName('usuario').setDescription('Usuário a ser avisado').setRequired(true))
    .addStringOption(o => o.setName('mensagem').setDescription('Mensagem do aviso').setRequired(true))
    .addStringOption(o => o.setName('motivo').setDescription('Motivo curto (opcional)').setRequired(false)),

  async execute(interaction, client) {
    // Responda rápido para manter token válido
    try {
      if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });

      const alvo = interaction.options.getUser('usuario');
      const mensagem = interaction.options.getString('mensagem');
      const motivo = interaction.options.getString('motivo') ?? 'Nenhum motivo fornecido';
      const autor = interaction.user;
      const { guild } = interaction;

      if (alvo.bot) return interaction.editReply({ content: `${client.config.emojis?.error || '❌'} Não é permitido avisar bots.`, ephemeral: true });

      const safeMensagem = mensagem.length > 3000 ? `${mensagem.slice(0, 2997)}...` : mensagem;

      // Embed de preview
      const preview = new EmbedBuilder()
        .setTitle('🔎 Pré-visualização do aviso')
        .setDescription(safeMensagem.length > 1024 ? `${safeMensagem.slice(0, 1021)}...` : safeMensagem)
        .addFields(
          { name: 'Para', value: `${alvo.tag} (${alvo.id})`, inline: true },
          { name: 'Motivo', value: motivo, inline: true }
        )
        .setFooter({ text: `Emitido por ${autor.tag}` })
        .setTimestamp()
        .setColor(client.config.colors?.primary || '#5865F2');

      // Select menu com opções avançadas
      const select = new StringSelectMenuBuilder()
        .setCustomId(`avisouser_select:${autor.id}`)
        .setPlaceholder('Escolha opções adicionais')
        .addOptions([
          { label: 'Severidade: Leve', value: 'sev_leve', description: 'Aviso leve. Registro simples.' },
          { label: 'Severidade: Médio', value: 'sev_medio', description: 'Aviso médio. Recomenda atenção.' },
          { label: 'Severidade: Grave', value: 'sev_grave', description: 'Aviso grave. Considere ação disciplinar.' },
          { label: 'Anônimo: Sim', value: 'anon_sim', description: 'Envia o aviso sem revelar o autor.' },
          { label: 'Anônimo: Não', value: 'anon_nao', description: 'Envia o aviso mostrando o autor.' },
          { label: 'Encaminhar ao mod-log', value: 'log_sim', description: 'Envia um registro ao canal de moderação configurado.' },
          { label: 'Não encaminhar ao mod-log', value: 'log_nao', description: 'Não enviar registro ao canal de moderação.' }
        ]);

      const selectRow = new ActionRowBuilder().addComponents(select);

      // Botões de confirmar / cancelar
      const btnConfirmId = `avisouser_confirm:${autor.id}`;
      const btnCancelId = `avisouser_cancel:${autor.id}`;
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(btnConfirmId).setLabel('Confirmar').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(btnCancelId).setLabel('Cancelar').setStyle(ButtonStyle.Danger)
      );

      // Envia preview com menu e botões
      await interaction.editReply({ embeds: [preview], components: [selectRow, buttons] });

      // Coletores: primeiro coletar seleção (opcional)
      const filterSelect = i => i.customId === `avisouser_select:${autor.id}` && i.user.id === autor.id;
      let selected = [];
      try {
        const selInteraction = await interaction.channel.awaitMessageComponent({ filter: filterSelect, componentType: ComponentType.StringSelect, time: 30000 });
        selected = selInteraction.values; // array de strings
        await selInteraction.update({ content: 'Opções selecionadas. Confirme ou cancele abaixo.', components: [buttons] });
      } catch (e) {
        // timeout ou sem seleção. seguimos com defaults
      }

      // agora coletar clique em botão
      const filterButton = i => (i.customId === btnConfirmId || i.customId === btnCancelId) && i.user.id === autor.id;
      let buttonInteraction;
      try {
        buttonInteraction = await interaction.channel.awaitMessageComponent({ filter: filterButton, componentType: ComponentType.Button, time: 30000 });
      } catch (e) {
        // timeout
        return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('⌛ Expirado').setDescription('Tempo esgotado. Operação cancelada.').setColor(client.config.colors?.danger || '#E74C3C')], components: [] });
      }

      if (buttonInteraction.customId === btnCancelId) {
        await buttonInteraction.update({ content: `${client.config.emojis?.error || '❌'} Ação cancelada.`, embeds: [], components: [] });
        return;
      }

      // Confirmado
      await buttonInteraction.deferUpdate();

      // Interpreta seleções
      const severity = selected.includes('sev_grave') ? 'Grave' : selected.includes('sev_medio') ? 'Médio' : 'Leve';
      const anonymous = selected.includes('anon_sim');
      const sendLog = selected.includes('log_sim');

      // Embed DM ao alvo
      const dm = new EmbedBuilder()
        .setTitle('🔔 Aviso de moderação')
        .setDescription(safeMensagem)
        .addFields(
          { name: 'Severidade', value: severity, inline: true },
          { name: 'Motivo', value: motivo, inline: true },
          { name: 'Servidor', value: guild?.name ?? 'Desconhecido', inline: true }
        )
        .setTimestamp()
        .setColor(client.config.colors?.warning || '#FFA500');

      if (!anonymous) dm.addFields({ name: 'Aviso por', value: autor.tag });

      if (guild?.iconURL()) dm.setThumbnail(guild.iconURL({ size: 128 }));

      const dmRes = await alvo.send({ embeds: [dm] }).catch(err => ({ error: true, err }));

      if (dmRes && dmRes.error) {
        return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('❗ Falha ao enviar DM').setDescription('O usuário pode ter DMs bloqueadas.') .setColor(client.config.colors?.danger || '#E74C3C')], components: [] });
      }

      // Confirmação final
      const done = new EmbedBuilder()
        .setTitle('✅ Aviso enviado')
        .setDescription(`Aviso entregue a **${alvo.tag}**`)
        .addFields(
          { name: 'Severidade', value: severity, inline: true },
          { name: 'Anônimo', value: anonymous ? 'Sim' : 'Não', inline: true },
          { name: 'Motivo', value: motivo }
        )
        .setTimestamp()
        .setColor(client.config.colors?.success || '#00C853')
        .setFooter({ text: `Emitido por ${autor.tag}` });

      // envia registro ao canal de moderação se configurado e pedido
      if (sendLog && client.config?.modLogChannelId) {
        try {
          const ch = await client.channels.fetch(client.config.modLogChannelId).catch(() => null);
          if (ch) await ch.send({ embeds: [new EmbedBuilder().setTitle('📝 Registro de aviso').addFields({ name: 'Alvo', value: `${alvo.tag} (${alvo.id})` }, { name: 'Autor', value: anonymous ? 'Anônimo' : autor.tag }, { name: 'Severidade', value: severity }, { name: 'Motivo', value: motivo }).setTimestamp().setColor(client.config.colors?.primary || '#5865F2')] });
        } catch (logErr) {
          console.error('Falha ao enviar log:', logErr);
        }
      }

      return interaction.editReply({ embeds: [done], components: [] });

    } catch (err) {
      console.error('Erro em avisouser:', err);
      if (err?.code === 10062) {
        try { if (interaction.channel) await interaction.channel.send(`${client.config.emojis?.error || '❌'} Erro: interação expirada. Aviso pode ter sido enviado por DM.`); } catch (e) { console.error('Fallback falhou:', e); }
        return;
      }
      try {
        if (interaction.replied || interaction.deferred) await interaction.followUp({ content: `${client.config.emojis?.error || '❌'} Ocorreu um erro ao processar o comando.`, ephemeral: true });
        else await interaction.reply({ content: `${client.config.emojis?.error || '❌'} Ocorreu um erro ao processar o comando.`, ephemeral: true });
      } catch (inner) { console.error('Fallback reply falhou:', inner); }
    }
  }
};