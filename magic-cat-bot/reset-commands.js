// reset-commands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
    try {
        console.log('[RESET] Iniciando reset de comandos...');

        // --- Apagar comandos globais ---
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] });
        console.log('[RESET] ✅ Todos os comandos globais foram apagados.');

        // --- Apagar comandos de guild (se tiver GUILD_ID no .env) ---
        if (process.env.GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: [] }
            );
            console.log(`[RESET] ✅ Todos os comandos da guild ${process.env.GUILD_ID} foram apagados.`);
        }

        console.log('[RESET] 🚀 Reset concluído.');
    } catch (err) {
        console.error('[RESET] ❌ Erro ao resetar comandos:');
        console.error(err);
    }
})();
