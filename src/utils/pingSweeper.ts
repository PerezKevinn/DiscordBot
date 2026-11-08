import { ChannelType, Client, Guild, TextChannel, VoiceState } from 'discord.js';
import { ActivePing, ContentTypeConfig } from '../types/ping';
import { ConfigManager } from './configManager';
import { buildPingMessagePayload } from './pingBuilder';

/** Ping abierto se cierra solo pasado este tiempo desde la hora de salida (red de seguridad). */
const STALE_AFTER_START_MS = 6 * 60 * 60 * 1000;
/** Si la voz se usó y queda vacía este tiempo, la actividad se da por terminada. */
const EMPTY_VOICE_END_MS = 10 * 60 * 1000;
/** Si nadie entró nunca a la voz, se borra (solo la voz) pasado este tiempo desde la salida. */
const UNUSED_VOICE_AFTER_START_MS = 30 * 60 * 1000;
const SWEEP_EVERY_MS = 2 * 60 * 1000;

// voiceChannelId -> momento en que quedó vacía (en memoria; se reinicia con el bot)
const emptySince = new Map<string, number>();

function fallbackContent(ping: ActivePing): ContentTypeConfig {
  return {
    id: ping.contentTypeId,
    name: ping.contentName,
    emoji: '⚔️',
    subtitle: 'LLAMADO DE CONTENIDO',
    accentColor: '#D4AF37',
    defaultGearTier: ping.gearTier,
    defaultMount: ping.mountRequired,
    defaultZone: ping.departureLocation,
    roles: ping.roles,
  };
}

function isOpen(ping: ActivePing) {
  return ping.status === 'OPEN' || ping.status === 'IN_PROGRESS';
}

/**
 * Borra la voz temporal y el hilo de un ping. Si no hay permiso para borrar el hilo,
 * lo archiva y bloquea para que desaparezca de la lista.
 */
export async function cleanupPingChannels(guild: Guild, ping: ActivePing, reason: string) {
  if (ping.voiceChannelId) {
    emptySince.delete(ping.voiceChannelId);
    const vc = await guild.channels.fetch(ping.voiceChannelId).catch(() => null);
    if (vc) await vc.delete(reason).catch(() => null);
    ping.voiceChannelId = undefined;
  }

  if (ping.threadId) {
    const thread = await guild.channels.fetch(ping.threadId).catch(() => null);
    if (thread?.isThread()) {
      const deleted = await thread
        .delete(reason)
        .then(() => true)
        .catch(() => false);
      if (!deleted) {
        await thread.setLocked(true, reason).catch(() => null);
        await thread.setArchived(true, reason).catch(() => null);
      }
    }
    ping.threadId = undefined;
  }
}

async function editPingMessage(guild: Guild, ping: ActivePing) {
  try {
    const config = ConfigManager.getConfig(guild.id, guild.name);
    const content = config.contentTypes.find((c) => c.id === ping.contentTypeId) || fallbackContent(ping);
    const channel = await guild.channels.fetch(ping.channelId).catch(() => null);
    if (channel?.isTextBased()) {
      const msg = await (channel as TextChannel).messages.fetch(ping.messageId).catch(() => null);
      if (msg) await msg.edit(await buildPingMessagePayload(ping, content, config));
    }
  } catch (err) {
    console.warn(`[${guild.id}] No se pudo actualizar el ping ${ping.id}:`, (err as Error).message);
  }
}

/** Cierra un ping desde el panel web: borra voz e hilo y actualiza el mensaje. */
export async function closePingExternally(guild: Guild, ping: ActivePing, status: 'CLOSED' | 'CANCELLED') {
  ping.status = status;
  ping.closedAt = Date.now();
  await cleanupPingChannels(guild, ping, status === 'CLOSED' ? 'Cerrado desde el panel' : 'Cancelado desde el panel');
  ConfigManager.savePing(guild.id, ping);
  await editPingMessage(guild, ping);
}

/** Cierra un ping desde fuera de una interacción (auto-cierre). */
async function autoClose(guild: Guild, ping: ActivePing, why: string) {
  ping.status = 'CLOSED';
  ping.closedAt = Date.now();
  await cleanupPingChannels(guild, ping, why);
  ConfigManager.savePing(guild.id, ping);
  await editPingMessage(guild, ping);
  console.log(`🧹 [${guild.id}] Ping ${ping.id} cerrado: ${why}`);
}

export async function sweepGuild(guild: Guild) {
  const now = Date.now();
  let pings: Record<string, ActivePing>;
  try {
    pings = ConfigManager.getActivePings(guild.id);
    // Privacidad: los pings cerrados (con los nombres de los jugadores) no duran más de 3 días
    ConfigManager.pruneClosedPings(guild.id, now);
  } catch {
    return;
  }

  for (const ping of Object.values(pings)) {
    if (!isOpen(ping)) continue;
    const startMs = ping.startTimeUnix * 1000;

    // 1. Red de seguridad: ping olvidado
    if (now >= startMs + STALE_AFTER_START_MS) {
      await autoClose(guild, ping, 'ping olvidado (6 h después de la salida)');
      continue;
    }

    if (!ping.voiceChannelId || now < startMs) continue;
    const vc = guild.channels.cache.get(ping.voiceChannelId);
    if (!vc || vc.type !== ChannelType.GuildVoice) {
      // Alguien borró la voz a mano
      ping.voiceChannelId = undefined;
      ConfigManager.savePing(guild.id, ping);
      await editPingMessage(guild, ping);
      continue;
    }

    if (vc.members.size > 0) {
      emptySince.delete(vc.id);
      if (!ping.voiceUsed) {
        ping.voiceUsed = true;
        ConfigManager.savePing(guild.id, ping);
      }
      continue;
    }

    // 2. La party usó la voz y se fue: la actividad terminó
    if (ping.voiceUsed) {
      const since = emptySince.get(vc.id) ?? now;
      emptySince.set(vc.id, since);
      if (now - since >= EMPTY_VOICE_END_MS) {
        await autoClose(guild, ping, 'la voz de la party quedó vacía');
      }
      continue;
    }

    // 3. Nadie entró nunca a la voz: se borra solo el canal, el ping sigue
    if (now >= startMs + UNUSED_VOICE_AFTER_START_MS) {
      await vc.delete('Voz temporal sin usar').catch(() => null);
      ping.voiceChannelId = undefined;
      ConfigManager.savePing(guild.id, ping);
      await editPingMessage(guild, ping);
    }
  }
}

/** Marca que la voz de un ping se usó, para saber cuándo la party terminó. */
function onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
  const joined = newState.channelId;
  if (!joined || joined === oldState.channelId) return;
  emptySince.delete(joined);
  try {
    const pings = ConfigManager.getActivePings(newState.guild.id);
    const ping = Object.values(pings).find((p) => p.voiceChannelId === joined && isOpen(p));
    if (ping && !ping.voiceUsed) {
      ping.voiceUsed = true;
      ConfigManager.savePing(newState.guild.id, ping);
    }
  } catch {
    /* servidor sin datos */
  }
}

/** Arranca la limpieza automática: fin de actividad por voz vacía y pings olvidados. */
export function startPingSweeper(client: Client) {
  client.on('voiceStateUpdate', onVoiceStateUpdate);
  const run = async () => {
    for (const guild of client.guilds.cache.values()) {
      await sweepGuild(guild).catch((err) => console.error(`[${guild.id}] Error en limpieza:`, err));
    }
  };
  void run();
  setInterval(() => void run(), SWEEP_EVERY_MS).unref();
}
