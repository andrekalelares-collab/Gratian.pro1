// index.js aprimorado — sincroniza globalmente, hot-reload básico e robustez
require('dotenv').config();

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { QuickDB } = require('quick.db');

// Banco de dados
const db = new QuickDB();

// Criação do client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  failIfNotExists: false,
});

// Exports e coleções compartilhadas
client.db = db;
client.config = require('./config.json');
client.commands = new Collection();
client.cooldowns = new Collection();

// Logger simples
function info(...args) { console.log('[INFO]', ...args); }
function warn(...args) { console.warn('[WARN]', ...args); }
function error(...args) { console.error('[ERROR]', ...args); }

info('Inicializando bot...');
info('Banco quick.db iniciado.');

// Helpers para carregar arquivos
function loadCommands() {
  const commandsPath = path.join(__dirname, 'src', 'commands');
  if (!fs.existsSync(commandsPath)) return warn('Pasta src/commands não encontrada.');

  const folders = fs.readdirSync(commandsPath).filter(f => fs.lstatSync(path.join(commandsPath, f)).isDirectory());
  let loaded = 0;
  for (const folder of folders) {
    const folderPath = path.join(commandsPath, folder);
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
    for (const file of files) {
      try {
        const full = path.join(folderPath, file);
        delete require.cache[require.resolve(full)];
        const cmd = require(full);
        if (cmd?.data && cmd?.execute) {
          client.commands.set(cmd.data.name, cmd);
          loaded++;
        } else {
          warn('Comando inválido:', full);
        }
      } catch (err) {
        error('Falha ao carregar comando', file, err);
      }
    }
  }
  info(`${loaded} comandos carregados.`);
}

function loadEvents() {
  const eventsPath = path.join(__dirname, 'src', 'events');
  if (!fs.existsSync(eventsPath)) return warn('Pasta src/events não encontrada.');

  const files = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const full = path.join(eventsPath, file);
      delete require.cache[require.resolve(full)];
      const ev = require(full);
      if (ev.once) client.once(ev.name, (...args) => ev.execute(...args, client));
      else client.on(ev.name, (...args) => ev.execute(...args, client));
    } catch (err) {
      error('Falha ao carregar evento', file, err);
    }
  }
  info(`${files.length} eventos registrados.`);
}

// Carrega inicialmente
loadCommands();
loadEvents();

// Hot-reload básico (opcional). Habilite em DEV=true no .env
if (process.env.DEV === 'true') {
  const watchPath = path.join(__dirname, 'src');
  info('Dev mode ativo. Observando src/ para hot-reload.');
  fs.watch(watchPath, { recursive: true }, (evt, filename) => {
    if (!filename) return;
    const full = path.join(watchPath, filename);
    if (full.endsWith('.js')) {
      try {
        info('Arquivo alterado, recarregando:', filename);
        // reload commands and events fully
        client.commands.clear();
        client.removeAllListeners();
        loadCommands();
        loadEvents();
      } catch (err) {
        error('Erro no hot-reload:', err);
      }
    }
  });
}

// Deploy flexível: GLOBAL por padrão. Use DEPLOY_SCOPE=guild e GUILD_ID para testar.
async function deployCommands() {
  try {
    const commandsArray = Array.from(client.commands.values()).map(c => c.data.toJSON());
    if (!commandsArray.length) return info('Nenhum comando para deploy.');

    const scope = (process.env.DEPLOY_SCOPE || 'global').toLowerCase();
    if (scope === 'guild' && process.env.GUILD_ID) {
      await client.application.commands.set([], process.env.GUILD_ID); // clear previous
      await client.application.commands.set(commandsArray, process.env.GUILD_ID);
      info(`Comandos registrados no guild ${process.env.GUILD_ID} (${commandsArray.length}).`);
    } else {
      // GLOBAL deploy
      await client.application.commands.set(commandsArray);
      info(`Comandos registrados globalmente (${commandsArray.length}). Pode levar até 1 hora para propagar.`);
    }
  } catch (err) {
    error('Falha no deploy de comandos:', err);
  }
}

// Ready
client.once('ready', async () => {
  info(`${client.user.tag} pronto.`);
  // deploy automático em ready
  await deployCommands();
});

// Proteção contra erros que encerram o processo
process.on('unhandledRejection', (reason) => {
  error('[UNHANDLED REJECTION]', reason);
});
process.on('uncaughtException', (err) => {
  error('[UNCAUGHT EXCEPTION]', err);
  // NÃO chamar process.exit aqui. Logamos e deixamos o bot rodar.
});
process.on('uncaughtExceptionMonitor', (err) => error('[UNCAUGHT EXCEPTION MONITOR]', err));

client.on('error', (err) => error('[CLIENT ERROR]', err));
client.on('shardError', (err) => error('[SHARD ERROR]', err));

// Graceful shutdown
async function shutdown() {
  warn('Shutdown iniciado... desconectando client.');
  try { await client.destroy(); } catch (e) { error('Erro no client.destroy:', e); }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Login
(async () => {
  try {
    await client.login(process.env.BOT_TOKEN);
  } catch (err) {
    error('Falha ao logar. Verifique BOT_TOKEN:', err);
    // não encerra automaticamente
  }
})();

module.exports = client;
