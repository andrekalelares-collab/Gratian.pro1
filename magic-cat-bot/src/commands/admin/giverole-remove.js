const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { setTimeout: wait } = require('node:timers/promises');

// Configurações de retry/backoff
const MAX_RETRIES = 6;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giverole-remove')
    .setDescription('👑 Remove um cargo de TODOS os membros do servidor. Profissional 2024/2025 - pt-BR')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(option => option.setName('cargo').setDescription('Cargo a ser removido').setRequired(true))
    .addIntegerOption(option => option.setName('delay').setDescription('Delay entre cada remoção em ms (mín: 250, padrão: 250)').setMinValue(250).setRequired(false)),

  async execute(interaction, client) {
    try {
      if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });

      const role = interaction.options.getRole('cargo');
      const requestedDelay = interaction.options.getInteger('delay') || 250;
      let delay = Math.max(250, requestedDelay);
      const { guild, user } = interaction;
      const botMember = guild.members.me;

      // validações
      if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.editReply({ content: `${client.config.emojis?.error || '❌'} Eu não tenho permissão de **Gerenciar Cargos**.`, ephemeral: true });
      }
      if (role.position >= botMember.roles.highest.position) {
        return interaction.editReply({ content: `${client.config.emojis?.error || '❌'} Não posso gerenciar este cargo. Ele está em posição igual ou superior à minha.`, ephemeral: true });
      }
      if (role.managed) {
        return interaction.editReply({ content: `${client.config.emojis?.error || '❌'} Este cargo é gerenciado por integração e não pode ser removido manualmente.`, ephemeral: true });
      }
      if (role.id === guild.roles.everyone.id) {
        return interaction.editReply({ content: `${client.config.emojis?.error || '❌'} Não é permitido remover o cargo @everyone.`, ephemeral: true });
      }

      await interaction.editReply({ content: `${client.config.emojis?.loading || '⏳'} Buscando membros...` });

      let members;
      try {
        members = await guild.members.fetch();
      } catch (err) {
        console.error('Erro ao buscar membros:', err);
        return interaction.followUp({ content: `${client.config.emojis?.error || '❌'} Falha ao buscar membros do servidor.`, ephemeral: true });
      }

      try {
        await interaction.channel.send({ content: `${client.config.emojis?.loading || '⏳'} Iniciando remoção do cargo **${role.name}** de **${members.size}** membros. Delay: **${delay}ms**. Solicitado por <@${user.id}>.` });
      } catch (err) {
        console.error('Falha ao enviar mensagem pública de início:', err);
      }

      const removed = [];
      const skipped = [];
      const failed = [];

      const startedAt = Date.now();

      async function removeRoleWithBackoff(member, role, reason) {
        let attempt = 0;
        while (attempt <= MAX_RETRIES) {
          try {
            await member.roles.remove(role, reason);
            return { ok: true };
          } catch (err) {
            const status = err?.status || err?.httpStatus || err?.code || (err?.rawError && err.rawError.code);
            const retryAfter = (err?.rawError && err.rawError.retry_after) || (err?.retry_after) || null;
            if (status === 429 || retryAfter) {
              attempt++;
              const waitMs = Math.min(MAX_BACKOFF_MS, retryAfter ? retryAfter * 1000 : BASE_BACKOFF_MS * Math.pow(2, attempt));
              console.warn(`Rate limited ao remover ${member.user.tag}. Tentativa ${attempt}. Esperando ${waitMs}ms.`);
              await wait(waitMs);
              delay = Math.max(delay, Math.ceil(waitMs / 2));
              continue;
            }
            return { ok: false, error: err?.message || String(err) };
          }
        }
        return { ok: false, error: 'Rate limit persistente após várias tentativas' };
      }

      for (const member of members.values()) {
        try {
          if (member.user.bot) {
            skipped.push({ tag: member.user.tag, reason: 'bot' });
            continue;
          }
          if (!member.roles.cache.has(role.id)) {
            skipped.push({ tag: member.user.tag, reason: 'não tinha' });
            continue;
          }

          const res = await removeRoleWithBackoff(member, role, `Removido por ${user.tag} via giverole-remove`);
          if (res.ok) removed.push(member.user.tag);
          else failed.push({ tag: member.user.tag, error: res.error });

        } catch (err) {
          console.error(`Erro inesperado ao processar ${member.user.tag}:`, err);
          failed.push({ tag: member.user.tag, error: err?.message || String(err) });
        }

        await wait(delay);
      }

      const finishedAt = Date.now();
      const durationMs = finishedAt - startedAt;
      const hours = Math.floor(durationMs / 3600000);
      const minutes = Math.floor((durationMs % 3600000) / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);

      const summary = new EmbedBuilder()
        .setTitle(`${client.config.emojis?.success || '✅'} Operação concluída`)
        .setDescription(`Cargo removido: **${role.name}** • Servidor: **${guild.name}**`)
        .addFields(
          { name: 'Total de membros', value: `\`${members.size}\``, inline: true },
          { name: 'Removidos', value: `\`${removed.length}\``, inline: true },
          { name: 'Ignorados', value: `\`${skipped.length}\``, inline: true },
          { name: 'Falhas', value: `\`${failed.length}\``, inline: true },
          { name: 'Tempo gasto', value: `\`${hours}h ${minutes}m ${seconds}s\``, inline: true },
          { name: 'Delay usado', value: `\`${delay}ms\``, inline: true }
        )
        .setColor(0x000000)
        .setTimestamp()
        .setFooter({ text: `Solicitado por ${user.tag}` });

      const maxRows = 2000;
      const removedRows = removed.slice(0, maxRows);
      const skippedRows = skipped.slice(0, maxRows);
      const failedRows = failed.slice(0, maxRows);

      const html = generateHtmlLogRemove({ guild, role, user, startedAt, finishedAt, delay, removedRows, skippedRows, failedRows, durationMs });
      const attachment = new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: `giverole-remove-log-${guild.id}-${Date.now()}.html` });

      let dmOk = true;
      try {
        await user.send({ embeds: [summary], files: [attachment] });
      } catch (err) {
        console.error('Falha ao enviar DM com log:', err);
        dmOk = false;
      }

      try {
        if (dmOk) {
          await interaction.followUp({ content: `${client.config.emojis?.success || '✅'} Concluído. Verifique sua DM para o log detalhado.`, embeds: [summary], ephemeral: true });
        } else {
          await interaction.followUp({ content: `${client.config.emojis?.warning || '⚠️'} Concluído, mas não foi possível enviar DM. O log está anexo.`, embeds: [summary], files: [attachment], ephemeral: true });
        }
      } catch (err) {
        console.error('Falha ao enviar followUp:', err);
      }

    } catch (err) {
      console.error('Erro no giverole-remove:', err);
      try {
        if (interaction.replied || interaction.deferred) await interaction.followUp({ content: `${client.config.emojis?.error || '❌'} Ocorreu um erro ao processar o comando.`, ephemeral: true });
        else await interaction.reply({ content: `${client.config.emojis?.error || '❌'} Ocorreu um erro ao processar o comando.`, ephemeral: true });
      } catch (inner) { console.error('Fallback reply falhou:', inner); }
    }
  }
};

function generateHtmlLogRemove({ guild, role, user, startedAt, finishedAt, delay, removedRows, skippedRows, failedRows, durationMs }) {
  const hours = Math.floor(durationMs / 3600000);
  const minutes = Math.floor((durationMs % 3600000) / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  const started = new Date(startedAt).toLocaleString('pt-BR');
  const finished = new Date(finishedAt).toLocaleString('pt-BR');
  const maxRows = Math.max(removedRows.length, skippedRows.length, failedRows.length, 1);

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Log giverole-remove - ${escapeHtml(guild.name)}</title>
<style>
  body{background:#000;color:#fff;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;margin:0;padding:24px}
  .container{max-width:1100px;margin:0 auto;background:#111;border:1px solid #222;padding:20px;border-radius:12px}
  h1{margin:0 0 8px;font-size:22px}
  p.meta{color:#bbb;margin:6px 0 16px}
  table{width:100%;border-collapse:collapse;margin-top:12px}
  th,td{padding:8px 10px;border-bottom:1px solid #222;text-align:left;font-size:13px}
  th{background:#0b0b0b;color:#fff}
  .small{font-size:12px;color:#999}
  .badge{display:inline-block;padding:6px 10px;border-radius:8px;background:#fff;color:#000;font-weight:700;font-size:12px}
  .section{margin-top:18px}
</style>
</head>
<body>
  <div class="container">
    <h1>Log de <span class="badge">giverole-remove</span></h1>
    <p class="meta">Servidor: <strong>${escapeHtml(guild.name)}</strong> (${guild.id}) • Cargo: <strong>${escapeHtml(role.name)}</strong> (${role.id})</p>
    <p class="meta">Autor: <strong>${escapeHtml(user.tag)}</strong> (${user.id}) • Início: <strong>${started}</strong> • Fim: <strong>${finished}</strong></p>
    <p class="meta">Duração: <strong>${hours}h ${minutes}m ${seconds}s</strong> • Delay: <strong>${delay}ms</strong></p>

    <div class="section">
      <h2>Resumo</h2>
      <table>
        <tr><th>Tipo</th><th>Quantidade</th></tr>
        <tr><td>Removidos</td><td>${removedRows.length}</td></tr>
        <tr><td>Ignorados (bots / não tinham)</td><td>${skippedRows.length}</td></tr>
        <tr><td>Falhas</td><td>${failedRows.length}</td></tr>
      </table>
    </div>

    <div class="section">
      <h2>Detalhes (exibindo até ${Math.max(removedRows.length,1)})</h2>
      <table>
        <tr><th>#</th><th>Removidos</th><th>Ignorados</th><th>Falhas</th></tr>
        ${Array.from({length:maxRows}).map((_,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(removedRows[i]||'')}</td><td>${escapeHtml(skippedRows[i]?.tag||'')}</td><td>${escapeHtml(failedRows[i]?.tag? failedRows[i].tag + ' - ' + failedRows[i].error : '')}</td></tr>`).join('')}
      </table>
    </div>

    <p class="small">Gerado automaticamente em ${new Date().toLocaleString('pt-BR')} • Script: giverole-remove • Geração: 2024/2025</p>
  </div>
</body>
</html>`;
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
