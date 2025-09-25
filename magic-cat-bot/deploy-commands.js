require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const clientId = process.env.CLIENT_ID; // Coloque o Client ID do seu bot no .env

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
        } else {
            console.log(`[AVISO] Comando inválido: ${filePath}`);
        }
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
    try {
        console.log(`[INFO] Iniciando registro de ${commands.length} comandos globais...`);
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands }
        );
        console.log('[INFO] Comandos globais registrados com sucesso!');
    } catch (error) {
        console.error('[ERRO] Falha ao registrar comandos globais:', error);
    }
})();
