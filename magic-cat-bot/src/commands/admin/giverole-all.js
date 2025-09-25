const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { setTimeout: wait } = require('node:timers/promises');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giverole-all')
    .setDescription('👑 Adiciona um cargo a TODOS os membros do servidor. Profissional 2024/2025 - pt-BR')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(option => option.setName('cargo').setDescription('Cargo a ser adicionado').setRequired(true))
    .addIntegerOption(option => option.setName('delay').setDescription('Delay entre cada adição em ms (mín: 250, padrão: 250)').setMinValue(250).setRequired(false)),

  async execute(interaction, client) {
    // acknowledge fast
    try {
      if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });

      const role = interaction.options.getRole('cargo');
      const requestedDelay = interaction.options.getInteger('delay') || 250;
      const delay = Math.max(250, requestedDelay);
      const { guild, user } = interaction;
      const botMember = guild.members.me;

      // --- validações básicas ---
      if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.editReply({ content: `${client.config.emojis?.error || '❌'} Eu não tenho permissão de **Gerenciar Cargos**.`, ephemeral: true });
      }
      if (role.position >= botMember.roles.highest.position) {
        return interaction.editReply({ content: `${client.config.emojis?.error || '❌'} Não posso gerenciar este cargo. Ele está em posição igual ou superior à minha.`, ephemeral: true });
      }
      if (role.managed) {
        return interaction.editReply({ content: `${client.config.emojis?.error || '❌'} Este cargo é gerenciado por integração e não pode ser atribuído manualmente.`, ephemeral: true });
      }
      if (role.id === guild.roles.everyone.id) {
        return interaction.editReply({ content: `${client.config.emojis?.error || '❌'} Não é permitido atribuir o cargo @everyone.`, ephemeral: true });
      }

      // informa início
      await interaction.editReply({ content: `${client.config.emojis?.loading || '⏳'} Buscando membros...` });

      let members;
      try {
        members = await guild.members.fetch();
      } catch (err) {
        console.error('Erro ao buscar membros:', err);
        return interaction.followUp({ content: `${client.config.emojis?.error || '❌'} Falha ao buscar membros do servidor.`, ephemeral: true });
      }

      // envia aviso público no canal
      try {
        await interaction.channel.send({ content: `${client.config.emojis?.loading || '⏳'} Iniciando atribuição do cargo **${role.name}** a **${members.size}** membros. Delay: **${delay}ms**. Solicitado por <@${user.id}>.` });
      } catch (err) {
        console.error('Falha ao enviar mensagem pública de início:', err);
      }

      const added = [];
      const skipped = [];
      const failed = [];

      const startedAt = Date.now();

      for (const member of members.values()) {
        // skip bots and those who already have the role
        if (member.user.bot) {
          skipped.push({ tag: member.user.tag, reason: 'bot' });
          continue;
        }
        if (member.roles.cache.has(role.id)) {
          skipped.push({ tag: member.user.tag, reason: 'já tinha' });
          continue;
        }

        try {
          await member.roles.add(role, `Atribuído por ${user.tag} via giverole-all`);
          added.push(member.user.tag);
        } catch (err) {
          console.error(`Falha ao adicionar cargo a ${member.user.tag}:`, err?.message ?? err);
          failed.push({ tag: member.user.tag, error: err?.message ?? 'Erro desconhecido' });
        }

        // espera para evitar rate limit
        await wait(delay);
      }

      const finishedAt = Date.now();
      const durationMs = finishedAt - startedAt;
      const hours = Math.floor(durationMs / 3600000);
      const minutes = Math.floor((durationMs % 3600000) / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);

      // embed resumo (preto como cor principal, detalhes em branco no texto)
      const summary = new EmbedBuilder()
        .setTitle(`${client.config.emojis?.success || '✅'} Operação concluída`)
        .setDescription(`Cargo: **${role.name}** • Servidor: **${guild.name}**`)
        .addFields(
          { name: 'Total de membros', value: `\`${members.size}\``, inline: true },
          { name: 'Adicionados', value: `\`${added.length}\``, inline: true },
          { name: 'Ignorados', value: `\`${skipped.length}\``, inline: true },
          { name: 'Falhas', value: `\`${failed.length}\``, inline: true },
          { name: 'Tempo gasto', value: `\`${hours}h ${minutes}m ${seconds}s\``, inline: true },
          { name: 'Delay usado', value: `\`${delay}ms\``, inline: true }
        )
        .setColor(0x000000) // preto
        .setTimestamp()
        .setFooter({ text: `Solicitado por ${user.tag}` });

      // geração do HTML de log estilizado em preto e branco
      const maxRows = 1000; // evitar logs gigantes. já que DM suporta anexos
      const addedRows = added.slice(0, maxRows);
      const skippedRows = skipped.slice(0, maxRows);
      const failedRows = failed.slice(0, maxRows);

      const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Log giverole-all - ${guild.name}</title>
<style>
  body{background:#000;color:#fff;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;margin:0;padding:24px}
  .container{max-width:900px;margin:0 auto;background:#111;border:1px solid #222;padding:20px;border-radius:12px}
  h1{margin:0 0 8px;font-size:20px}
  p.meta{color:#bbb;margin:6px 0 16px}
  table{width:100%;border-collapse:collapse;margin-top:12px}
  th,td{padding:8px 10px;border-bottom:1px solid #222;text-align:left;font-size:13px}
  th{background:#0b0b0b;color:#fff}
  .small{font-size:12px;color:#999}
  .badge{display:inline-block;padding:4px 8px;border-radius:8px;background:#fff;color:#000;font-weight:600;font-size:12px}
  .section{margin-top:18px}
</style>
</head>
<body>
  <div class="container">
    <h1>Log de <span class="badge">giverole-all</span></h1>
    <p class="meta">Servidor: <strong>${escapeHtml(guild.name)}</strong> (${guild.id}) • Cargo: <strong>${escapeHtml(role.name)}</strong> (${role.id})</p>
    <p class="meta">Autor: <strong>${escapeHtml(user.tag)}</strong> (${user.id}) • Início: <strong>${new Date(startedAt).toLocaleString('pt-BR')}</strong> • Fim: <strong>${new Date(finishedAt).toLocaleString('pt-BR')}</strong></p>
    <p class="meta">Duração: <strong>${hours}h ${minutes}m ${seconds}s</strong> • Delay: <strong>${delay}ms</strong></p>

    <div class="section">
      <h2>Resumo</h2>
      <table>
        <tr><th>Tipo</th><th>Quantidade</th></tr>
        <tr><td>Adicionados</td><td>${added.length}</td></tr>
        <tr><td>Ignorados (bots / já tinham)</td><td>${skipped.length}</td></tr>
        <tr><td>Falhas</td><td>${failed.length}</td></tr>
      </table>
    </div>

    <div class="section">
      <h2>Adicionados (exibindo até ${maxRows})</h2>
      <table>
        <tr><th>#</th><th>Usuário</th></tr>
        ${addedRows.map((u,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(u)}</td></tr>`).join('') || '<tr><td colspan="2">Nenhum</td></tr>'}
      </table>
    </div>

    <div class="section">
      <h2>Ignorados (exibindo até ${maxRows})</h2>
      <table>
        <tr><th>#</th><th>Usuário</th><th>Motivo</th></tr>
        ${skippedRows.map((s,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(s.tag)}</td><td>${escapeHtml(s.reason)}</td></tr>`).join('') || '<tr><td colspan="3">Nenhum</td></tr>'}
      </table>
    </div>

    <div class="section">
      <h2>Falhas (exibindo até ${maxRows})</h2>
      <table>
        <tr><th>#</th><th>Usuário</th><th>Erro</th></tr>
        ${failedRows.map((f,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(f.tag)}</td><td>${escapeHtml(f.error)}</td></tr>`).join('') || '<tr><td colspan="3">Nenhum</td></tr>'}
      </table>

    </div>

    <p class="small">Gerado automaticamente em ${new Date().toLocaleString('pt-BR')} • Script: giverole-all • Geração: 2024/2025</p>
  </div>
</body>
</html>`;

      // cria attachment HTML
      const attachment = new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: `giverole-log-${guild.id}-${Date.now()}.html` });

      // tenta enviar DM com embed e HTML
      let dmOk = true;
      try {
        await user.send({ embeds: [summary], files: [attachment] });
      } catch (err) {
        console.error('Falha ao enviar DM com log:', err);
        dmOk = false;
      }

      // responde ao autor no Discord
      try {
        if (dmOk) {
          await interaction.followUp({ content: `${client.config.emojis?.success || '✅'} Concluído. Verifique sua DM para o log detalhado.`, embeds: [summary], ephemeral: true });
        } else {
          // se DM falhou, anexa o html no reply
          await interaction.followUp({ content: `${client.config.emojis?.warning || '⚠️'} Concluído, mas não foi possível enviar DM. O log está anexo.`, embeds: [summary], files: [attachment], ephemeral: true });
        }
      } catch (err) {
        console.error('Falha ao enviar followUp:', err);
      }

    } catch (err) {
      console.error('Erro no giverole-all:', err);
      try {
        if (interaction.replied || interaction.deferred) await interaction.followUp({ content: `${client.config.emojis?.error || '❌'} Ocorreu um erro ao processar o comando.`, ephemeral: true });
        else await interaction.reply({ content: `${client.config.emojis?.error || '❌'} Ocorreu um erro ao processar o comando.`, ephemeral: true });
      } catch (inner) { console.error('Fallback reply falhou:', inner); }
    }
  }
};

// utilitária para escapar strings antes de colocar no HTML
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}