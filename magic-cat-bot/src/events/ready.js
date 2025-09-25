const { Events, ActivityType } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    try {
      const tag = client.user?.tag ?? 'Unknown#0000';
      console.log(`[BOT] Logado como ${tag}. O Magic Cat está online.`);

      // pega contagem de guilds (cache rápido; fallback a fetch se necessário)
      let guildCount = client.guilds.cache.size;
      if (!guildCount) {
        try {
          const fetched = await client.guilds.fetch();
          guildCount = fetched?.size ?? guildCount;
        } catch (_) { /* ignore */ }
      }
      console.log(`[INFO] O bot está em ${guildCount} servidores.`);

      // mensagens de presença (preto e branco style não aplicável à presença, só texto)
      const statuses = [
        { name: `${guildCount} servidores • /help`, type: ActivityType.Watching },
        { name: 'Use /embed-criar para criar embeds', type: ActivityType.Playing }
      ];

      const setPresenceSafe = async (s) => {
        try {
          if (!client.user) return;
          await client.user.setPresence({
            activities: [{ name: s.name, type: s.type }],
            status: 'online'
          });
        } catch (err) {
          console.error('[PRESENCE ERROR]', err);
        }
      };

      // define presença inicial
      await setPresenceSafe(statuses[0]);

      // rotaciona status a cada 10 minutos e atualiza o contador dinâmico
      let idx = 1;
      setInterval(async () => {
        try {
          const currentGuilds = client.guilds.cache.size;
          statuses[0].name = `${currentGuilds} servidores • /help`;
          await setPresenceSafe(statuses[idx % statuses.length]);
          idx++;
        } catch (err) {
          console.error('[STATUS ROTATE ERROR]', err);
        }
      }, 10 * 60 * 1000);

    } catch (err) {
      console.error('[READY ERROR]', err);
    }
  },
};
