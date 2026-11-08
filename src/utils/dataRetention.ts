import { Client } from 'discord.js';
import { ConfigManager } from './configManager';

/**
 * Retención de datos: cuando un servidor expulsa al bot, sus datos (config, pings con
 * nombres de jugadores y logo) se borran pasados RETENTION_DAYS días. Si el bot vuelve
 * antes, no se pierde nada.
 *
 * Esto es lo que debe indicar la política de privacidad del bot.
 */
export const RETENTION_DAYS = 30;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

/**
 * Revisa todos los servidores guardados:
 * - Si el bot ya no está en uno y no estaba marcado (lo expulsaron con el bot apagado), lo marca.
 * - Si lleva más del plazo fuera, borra sus datos.
 */
export function runRetention(client: Client, now = Date.now()): { marked: number; purged: number } {
  let marked = 0;
  let purged = 0;
  // Si Discord no ha entregado la lista de servidores (fallo al arrancar), no tocar nada
  if (client.guilds.cache.size === 0) return { marked, purged };

  for (const guildId of ConfigManager.listStoredGuildIds()) {
    if (client.guilds.cache.has(guildId)) {
      // Está dentro: si quedó marcado por error, se desmarca
      if (ConfigManager.peekConfig(guildId)?.leftAt) ConfigManager.clearGuildLeft(guildId);
      continue;
    }

    const config = ConfigManager.peekConfig(guildId);
    if (!config?.leftAt) {
      ConfigManager.markGuildLeft(guildId, now);
      marked++;
      continue;
    }
    if (now - config.leftAt >= RETENTION_MS) {
      ConfigManager.purgeGuild(guildId);
      purged++;
      console.log(`🗑️ Datos del servidor ${guildId} borrados (${RETENTION_DAYS} días sin el bot).`);
    }
  }
  return { marked, purged };
}

export function startDataRetention(client: Client) {
  const run = () => {
    try {
      const { marked, purged } = runRetention(client);
      if (marked || purged) console.log(`🔒 Retención: ${marked} servidores marcados, ${purged} borrados.`);
    } catch (err) {
      console.error('Error en la retención de datos:', err);
    }
  };
  run();
  setInterval(run, CHECK_EVERY_MS).unref();
}
