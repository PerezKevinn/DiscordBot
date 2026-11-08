import dotenv from 'dotenv';
dotenv.config();

import { Client, Events, GatewayIntentBits, OAuth2Scopes, PermissionFlagsBits, REST, Routes } from 'discord.js';
import { ownerCommands, publicCommands } from './commands/definitions';
import { handleInteraction } from './handlers/interactionHandler';
import { ConfigManager } from './utils/configManager';
import { botBrandName } from './utils/plans';
import { startPingSweeper } from './utils/pingSweeper';
import { startDataRetention } from './utils/dataRetention';
import { startPanel } from './panel/server';

/** Permisos mínimos que necesita el bot (nada de Administrador en un bot público). */
const BOT_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.ManageThreads, // Borrar el hilo del ping al terminar
  PermissionFlagsBits.ManageChannels, // Crear/borrar las voces temporales
  PermissionFlagsBits.MentionEveryone, // Mencionar roles no mencionables / @here si el Caller puede
];

/**
 * Registro de comandos:
 * - Producción: comandos públicos globales (tardan hasta ~1h en aparecer la primera vez) y
 *   /plan-admin solo en GUILD_ID (tu servidor).
 * - DEV_MODE=true: todo solo en GUILD_ID (aparece al instante) y se limpian los globales para no ver duplicados.
 */
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

  // Migrar la config antigua de un solo servidor (data/config.json) si existe
  ConfigManager.migrateLegacy(ownerGuildId);

  console.log(`⚔️ Iniciando ${botBrandName()}...`);

  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`✅ Conectado como ${readyClient.user.tag} en ${readyClient.guilds.cache.size} servidores.`);
    const invite = readyClient.generateInvite({
      scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
      permissions: BOT_PERMISSIONS,
    });
    console.log(`🔗 Enlace de invitación: ${invite}`);
    startPingSweeper(readyClient);
    startDataRetention(readyClient);
    startPanel(readyClient).catch((err) => console.error('❌ No se pudo arrancar el panel web:', err));
    try {
      await registerSlashCommands(token, clientId, ownerGuildId);
    } catch (err) {
      console.error('❌ Error registrando comandos:', err);
    }
  });

  client.on(Events.GuildCreate, (guild) => {
    // Si el bot vuelve antes del plazo de retención, se conservan sus datos
    ConfigManager.clearGuildLeft(guild.id);
    // Crea la config por defecto del servidor nuevo
    ConfigManager.syncGuildIcon(ConfigManager.getConfig(guild.id, guild.name), guild);
    console.log(`🎉 Añadido a ${guild.name} (${guild.id}). Total: ${client.guilds.cache.size}`);
  });

  client.on(Events.GuildUpdate, (_old, guild) => {
    ConfigManager.syncGuildIcon(ConfigManager.getConfig(guild.id, guild.name), guild);
  });

  client.on(Events.GuildDelete, (guild) => {
    // Un corte de Discord no es una expulsión: solo se marca si el servidor sigue disponible
    if (guild.available === false) return;
    ConfigManager.markGuildLeft(guild.id);
    console.log(`👋 Expulsado de ${guild.name ?? guild.id}. Total: ${client.guilds.cache.size}`);
  });

  client.on(Events.InteractionCreate, (interaction) => {
    void handleInteraction(interaction);
  });

  await client.login(token);
}

main();
