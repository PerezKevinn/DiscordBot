/**
 * Punto de entrada del bot: carga el .env, registra los comandos, arranca las tareas periódicas
 * (limpieza de pings, retención de datos, membresías) y el panel web, y conecta los eventos de Discord.
 */
import dotenv from 'dotenv';
// Antes que el resto de imports: algunos módulos leen process.env al cargarse.
dotenv.config({ quiet: true });

import { Client, Events, GatewayIntentBits, OAuth2Scopes, PermissionFlagsBits, REST, Routes } from 'discord.js';
import { ownerCommands, publicCommands } from './commands/definitions';
import { handleInteraction } from './handlers/interactionHandler';
import { ConfigManager } from './utils/configManager';
import { botBrandName } from './utils/plans';
import { startPingSweeper } from './utils/pingSweeper';
import { startDataRetention } from './utils/dataRetention';
import { startMemberships } from './utils/memberships';
import { startPanel } from './panel/server';
import { installErrorHandlers, reportError, reportInfo } from './utils/alerts';

// Permisos mínimos que necesita el bot (nada de Administrador en un bot público).
const BOT_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.ManageThreads, // Borrar el hilo del ping al terminar.
  PermissionFlagsBits.ManageChannels, // Crear y borrar las voces temporales.
  PermissionFlagsBits.MentionEveryone, // Mencionar roles no mencionables y @here si el Caller puede.
];

// Registra los comandos de barra.
// - Producción: los comandos públicos son globales (tardan hasta ~1 h en aparecer la primera vez)
//   y /plan-admin se registra solo en GUILD_ID, el servidor del dueño.
// - DEV_MODE=true: todo se registra solo en GUILD_ID, donde aparece al instante, y se vacían los
//   globales para no ver los comandos duplicados.
async function registerSlashCommands(token: string, clientId: string, ownerGuildId?: string) {
  const rest = new REST({ version: '10' }).setToken(token);
  const devMode = process.env.DEV_MODE === 'true';

  if (devMode) {
    if (!ownerGuildId) throw new Error('DEV_MODE=true requiere GUILD_ID en .env');
    await rest.put(Routes.applicationGuildCommands(clientId, ownerGuildId), {
      body: [...publicCommands, ...ownerCommands],
    });
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    console.log(`🧪 DEV_MODE: comandos registrados solo en el servidor ${ownerGuildId}.`);
    return;
  }

  await rest.put(Routes.applicationCommands(clientId), { body: publicCommands });
  console.log(`✅ ${publicCommands.length} comandos públicos registrados globalmente.`);
  if (ownerGuildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, ownerGuildId), { body: ownerCommands });
    console.log(`🔑 /plan-admin registrado en tu servidor ${ownerGuildId}.`);
  }
}

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const ownerGuildId = process.env.GUILD_ID && /^\d+$/.test(process.env.GUILD_ID) ? process.env.GUILD_ID : undefined;

  if (!token || token === 'tu_token_aqui' || !clientId || clientId === 'tu_client_id_aqui') {
    console.error('❌ Falta DISCORD_TOKEN y CLIENT_ID en .env (copia .env.example a .env).');
    process.exit(1);
  }

  // Migra data/config.json de la versión de un solo servidor, si todavía existe.
  ConfigManager.migrateLegacy(ownerGuildId);

  console.log(`⚔️ Iniciando ${botBrandName()}...`);

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
  installErrorHandlers(client);

  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`✅ Conectado como ${readyClient.user.tag} en ${readyClient.guilds.cache.size} servidores.`);
    // Se avisa en el canal de alertas: un arranque inesperado suele indicar que el bot se cayó y pm2 lo reinició.
    void reportInfo(`✅ **${botBrandName()}** en marcha como ${readyClient.user.tag} en ${readyClient.guilds.cache.size} servidores.`);
    const invite = readyClient.generateInvite({
      scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
      permissions: BOT_PERMISSIONS,
    });
    console.log(`🔗 Enlace de invitación: ${invite}`);
    startPingSweeper(readyClient);
    startDataRetention(readyClient);
    startMemberships(readyClient);
    startPanel(readyClient).catch((err) => void reportError('No se pudo arrancar el panel web', err));
    try {
      await registerSlashCommands(token, clientId, ownerGuildId);
    } catch (err) {
      void reportError('Registro de comandos', err);
    }
  });

  client.on(Events.GuildCreate, (guild) => {
    // Si el bot vuelve antes de que venza el plazo de retención, se conservan sus datos.
    ConfigManager.clearGuildLeft(guild.id);
    // getConfig crea la config por defecto si el servidor es nuevo.
    ConfigManager.syncGuildIcon(ConfigManager.getConfig(guild.id, guild.name), guild);
    console.log(`🎉 Añadido a ${guild.name} (${guild.id}). Total: ${client.guilds.cache.size}`);
  });

  client.on(Events.GuildUpdate, (_old, guild) => {
    ConfigManager.syncGuildIcon(ConfigManager.getConfig(guild.id, guild.name), guild);
  });

  client.on(Events.GuildDelete, (guild) => {
    // Con una caída de Discord llega GuildDelete con available=false: no es una expulsión.
    if (guild.available === false) return;
    ConfigManager.markGuildLeft(guild.id);
    console.log(`👋 Expulsado de ${guild.name ?? guild.id}. Total: ${client.guilds.cache.size}`);
  });

  client.on(Events.InteractionCreate, (interaction) => {
    void handleInteraction(interaction);
  });

  await client.login(token);
}

main().catch(async (err) => {
  await reportError('Arranque del bot', err);
  process.exit(1);
});
