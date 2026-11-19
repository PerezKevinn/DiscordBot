/**
 * Cliente de la API pública de Albion Online (gameinfo) y fichas de jugador para los tickets de
 * reclutamiento y /stats.
 *
 * La API no está documentada oficialmente ni publica límites de uso, y a veces tarda o se cuelga:
 * cada petición tiene tiempo máximo y un reintento, las respuestas se guardan en caché unos minutos
 * y como mucho hay MAX_CONCURRENT peticiones a la vez.
 *
 * La API no da el historial de gremios. Se reconstruye con dos fuentes:
 *  - los últimos kills y muertes del jugador, que guardan el gremio que tenía en ese momento;
 *  - lo que el propio bot ha visto en consultas anteriores (data/albion/players.json).
 */
import fs from 'fs';
import path from 'path';

/** Servidores de Albion. */
export type AlbionServer = 'americas' | 'europe' | 'asia';
export const ALBION_SERVERS: AlbionServer[] = ['americas', 'europe', 'asia'];

/** Nombre del servidor tal como se muestra. */
export const SERVER_LABEL: Record<AlbionServer, string> = {
  americas: 'América',
  europe: 'Europa',
  asia: 'Asia',
};

const HOSTS: Record<AlbionServer, string> = {
  americas: 'https://gameinfo.albiononline.com/api/gameinfo',
  europe: 'https://gameinfo-ams.albiononline.com/api/gameinfo',
  asia: 'https://gameinfo-sgp.albiononline.com/api/gameinfo',
};

// Valor del parámetro server de la búsqueda de Albion Online Tools.
const AOT_SERVER: Record<AlbionServer, string> = { americas: 'west', europe: 'europe', asia: 'east' };

/** Los nombres de personaje del juego: de 3 a 16 letras o números. */
export const ALBION_NAME_RE = /^[A-Za-z0-9]{3,16}$/;

const TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE = 500;
const MAX_CONCURRENT = 4;

/** Error con un mensaje apto para mostrar al usuario tal cual. */
export class AlbionError extends Error {}

// ---------- Peticiones ----------

let running = 0;
const waiting: Array<() => void> = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) await new Promise<void>((r) => waiting.push(r));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

const cache = new Map<string, { at: number; data: unknown }>();

/** GET a la API con caché, tiempo máximo y un reintento. */
async function getJson<T>(server: AlbionServer, route: string, fresh = false): Promise<T> {
  const url = `${HOSTS[server]}${route}`;
  const hit = cache.get(url);
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data as T;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const data = await withSlot(async () => {
        const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'application/json' } });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as T;
      });
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
      cache.set(url, { at: Date.now(), data });
      return data as T;
    } catch (err) {
      lastErr = err;
    }
  }
  console.warn(`[albion] ${url} falló:`, (lastErr as Error)?.message);
  throw new AlbionError('La API de Albion no responde ahora mismo. Inténtalo de nuevo en unos minutos.');
}

// ---------- Tipos de la API ----------

interface ApiSearchPlayer {
  Id: string;
  Name: string;
  GuildId: string;
  GuildName: string;
  AllianceName: string | null;
  KillFame: number;
  DeathFame: number;
}

interface ApiZones {
  Total: number;
  Royal: number;
  Outlands: number;
  Avalon: number;
}

interface ApiPlayer {
  Id: string;
  Name: string;
  GuildId: string;
  GuildName: string;
  AllianceId: string;
  AllianceName: string | null;
  AllianceTag: string;
  KillFame: number;
  DeathFame: number;
  FameRatio: number;
  LifetimeStatistics?: {
    PvE?: { Total: number; Royal: number; Outlands: number; Avalon: number; Hellgate: number; CorruptedDungeon: number; Mists: number };
    Gathering?: { Fiber: ApiZones; Hide: ApiZones; Ore: ApiZones; Rock: ApiZones; Wood: ApiZones; All: ApiZones };
    Crafting?: ApiZones;
    CrystalLeague?: number;
    FishingFame?: number;
    FarmingFame?: number;
    Timestamp?: string;
  };
}

interface ApiGuild {
  Id: string;
  Name: string;
  AllianceTag: string | null;
  AllianceName: string | null;
  MemberCount: number;
}

interface ApiEventSide {
  Id: string;
  GuildId: string;
  GuildName: string;
  AllianceName: string;
}

interface ApiEvent {
  TimeStamp: string;
  Killer: ApiEventSide;
  Victim: ApiEventSide;
}

// ---------- Búsqueda ----------

/** Resultado de buscar un nombre. */
export interface PlayerMatch {
  id: string;
  name: string;
  guildName: string;
  killFame: number;
}

/**
 * Busca jugadores por nombre. Si hay uno que se llama exactamente así (sin distinguir mayúsculas),
 * lo pone primero. Devuelve como mucho 25, el máximo de un menú de Discord.
 */
export async function searchPlayers(server: AlbionServer, name: string): Promise<PlayerMatch[]> {
  if (!ALBION_NAME_RE.test(name)) throw new AlbionError('Los nombres de Albion tienen de 3 a 16 letras o números, sin espacios.');
  const data = await getJson<{ players?: ApiSearchPlayer[] } | null>(server, `/search?q=${encodeURIComponent(name)}`);
  const players = (data?.players ?? []).map((p) => ({ id: p.Id, name: p.Name, guildName: p.GuildName || '', killFame: p.KillFame || 0 }));
  const lower = name.toLowerCase();
  players.sort((a, b) => Number(b.name.toLowerCase() === lower) - Number(a.name.toLowerCase() === lower) || b.killFame - a.killFame);
  return players.slice(0, 25);
}

/** Coincidencia exacta del nombre, si la hay. */
export function exactMatch(matches: PlayerMatch[], name: string): PlayerMatch | undefined {
  return matches.find((m) => m.name.toLowerCase() === name.toLowerCase());
}

// ---------- Ficha ----------

/** Gremio en el que se ha visto al jugador y cuándo. */
export interface GuildStint {
  guildId: string;
  name: string;
  allianceName?: string;
  firstSeen: number;
  lastSeen: number;
}

/** Ficha completa de un jugador. */
export interface PlayerProfile {
  server: AlbionServer;
  id: string;
  name: string;
  guild?: { id: string; name: string; allianceTag?: string; allianceName?: string; members?: number };
  pvp: { killFame: number; deathFame: number; ratio: number };
  pve: { total: number; royal: number; outlands: number; avalon: number; hellgate: number; corrupted: number; mists: number };
  gathering: { total: number; fiber: number; hide: number; ore: number; rock: number; wood: number };
  crafting: number;
  fishing: number;
  farming: number;
  crystalLeague: number;
  /** Momento de los datos según la API. */
  updatedAt?: number;
  /** Gremios anteriores (sin el actual), del más reciente al más antiguo. */
  pastGuilds: GuildStint[];
  links: Array<{ label: string; url: string }>;
}

/**
 * Pide la ficha de un jugador: datos, gremio actual (para completar la alianza, que el jugador a
 * veces trae vacía) y sus últimos kills y muertes para sacar los gremios anteriores.
 * @param fresh true para saltarse la caché (botón Actualizar).
 */
export async function getPlayerProfile(server: AlbionServer, playerId: string, fresh = false): Promise<PlayerProfile> {
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(playerId)) throw new AlbionError('Jugador no válido.');
  const p = await getJson<ApiPlayer | null>(server, `/players/${playerId}`, fresh);
  if (!p) throw new AlbionError('Ese jugador ya no existe en la API de Albion.');

  // Si fallan, la ficha sale igual: el gremio y el historial son un extra.
  const [guild, kills, deaths] = await Promise.all([
    p.GuildId ? getJson<ApiGuild | null>(server, `/guilds/${p.GuildId}`, fresh).catch(() => null) : Promise.resolve(null),
    getJson<ApiEvent[] | null>(server, `/players/${playerId}/kills`, fresh).catch(() => null),
    getJson<ApiEvent[] | null>(server, `/players/${playerId}/deaths`, fresh).catch(() => null),
  ]);

  const s = p.LifetimeStatistics ?? {};
  const pve = s.PvE;
  const g = s.Gathering;
  const updatedAt = s.Timestamp ? Date.parse(s.Timestamp) : undefined;

  // Gremios vistos en los eventos, más los que el bot ya tenía guardados.
  const seen: GuildStint[] = [];
  for (const e of kills ?? []) seen.push(...stintFromEvent(e.Killer, e.TimeStamp));
  for (const e of deaths ?? []) seen.push(...stintFromEvent(e.Victim, e.TimeStamp));
  if (p.GuildId) {
    const now = Date.now();
    seen.push({ guildId: p.GuildId, name: p.GuildName, allianceName: guild?.AllianceName ?? undefined, firstSeen: now, lastSeen: now });
  }
  const history = recordHistory(server, p.Id, p.Name, seen);

  return {
    server,
    id: p.Id,
    name: p.Name,
    guild: p.GuildId
      ? {
          id: p.GuildId,
          name: p.GuildName,
          allianceTag: p.AllianceTag || guild?.AllianceTag || undefined,
          allianceName: p.AllianceName || guild?.AllianceName || undefined,
          members: guild?.MemberCount,
        }
      : undefined,
    pvp: { killFame: p.KillFame || 0, deathFame: p.DeathFame || 0, ratio: p.FameRatio || 0 },
    pve: {
      total: pve?.Total ?? 0,
      royal: pve?.Royal ?? 0,
      outlands: pve?.Outlands ?? 0,
      avalon: pve?.Avalon ?? 0,
      hellgate: pve?.Hellgate ?? 0,
      corrupted: pve?.CorruptedDungeon ?? 0,
      mists: pve?.Mists ?? 0,
    },
    gathering: {
      total: g?.All?.Total ?? 0,
      fiber: g?.Fiber?.Total ?? 0,
      hide: g?.Hide?.Total ?? 0,
      ore: g?.Ore?.Total ?? 0,
      rock: g?.Rock?.Total ?? 0,
      wood: g?.Wood?.Total ?? 0,
    },
    crafting: s.Crafting?.Total ?? 0,
    fishing: s.FishingFame ?? 0,
    farming: s.FarmingFame ?? 0,
    crystalLeague: s.CrystalLeague ?? 0,
    updatedAt: updatedAt && !Number.isNaN(updatedAt) ? updatedAt : undefined,
    pastGuilds: history.filter((h) => h.guildId !== p.GuildId).sort((a, b) => b.lastSeen - a.lastSeen),
    links: profileLinks(server, p.Id, p.Name),
  };
}

function stintFromEvent(side: ApiEventSide | undefined, timestamp: string): GuildStint[] {
  const at = Date.parse(timestamp);
  if (!side?.GuildId || Number.isNaN(at)) return [];
  return [{ guildId: side.GuildId, name: side.GuildName, allianceName: side.AllianceName || undefined, firstSeen: at, lastSeen: at }];
}

/**
 * Enlaces a perfiles externos. Solo se enlaza, nunca se leen sus páginas. El killboard oficial
 * abre en América; en Europa y Asia hay que cambiar el servidor arriba a la derecha.
 */
export function profileLinks(server: AlbionServer, id: string, name: string): Array<{ label: string; url: string }> {
  return [
    { label: server === 'americas' ? 'Killboard oficial' : `Killboard oficial (elige ${SERVER_LABEL[server]})`, url: `https://albiononline.com/killboard/player/${id}` },
    {
      label: 'Albion Online Tools',
      url: `https://albiononlinetools.com/player/player-search.php?playerName=${encodeURIComponent(name)}&server=${AOT_SERVER[server]}`,
    },
  ];
}

// ---------- Historial propio de gremios ----------

const HISTORY_FILE = path.join(process.cwd(), 'data', 'albion', 'players.json');
/** Jugadores guardados como máximo; al pasarse se borran los consultados hace más tiempo. */
const MAX_PLAYERS = 20_000;
const MAX_STINTS = 15;

interface StoredPlayer {
  name: string;
  checkedAt: number;
  guilds: GuildStint[];
}

let history: Record<string, StoredPlayer> | null = null;
let saveTimer: NodeJS.Timeout | null = null;

function loadHistory(): Record<string, StoredPlayer> {
  if (history) return history;
  try {
    history = fs.existsSync(HISTORY_FILE) ? (JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')) as Record<string, StoredPlayer>) : {};
  } catch (err) {
    console.error('Historial de jugadores de Albion dañado; se empieza de cero:', err);
    history = {};
  }
  return history;
}

// Se guarda como mucho una vez cada 5 s: varias consultas seguidas no reescriben el archivo cada vez.
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const data = loadHistory();
    const keys = Object.keys(data);
    if (keys.length > MAX_PLAYERS) {
      keys.sort((a, b) => data[a].checkedAt - data[b].checkedAt);
      for (const k of keys.slice(0, keys.length - MAX_PLAYERS)) delete data[k];
    }
    try {
      fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
      const tmp = `${HISTORY_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(data), 'utf-8');
      fs.renameSync(tmp, HISTORY_FILE);
    } catch (err) {
      console.error('No se pudo guardar el historial de jugadores de Albion:', err);
    }
  }, 5_000);
  saveTimer.unref();
}

/** Junta los gremios vistos ahora con los guardados y devuelve el historial completo. */
function recordHistory(server: AlbionServer, playerId: string, name: string, seen: GuildStint[]): GuildStint[] {
  const data = loadHistory();
  const key = `${server}:${playerId}`;
  const entry = (data[key] ||= { name, checkedAt: 0, guilds: [] });
  entry.name = name;
  entry.checkedAt = Date.now();
  for (const s of seen) {
    const prev = entry.guilds.find((g) => g.guildId === s.guildId);
    if (prev) {
      prev.name = s.name || prev.name;
      prev.allianceName = s.allianceName ?? prev.allianceName;
      prev.firstSeen = Math.min(prev.firstSeen, s.firstSeen);
      prev.lastSeen = Math.max(prev.lastSeen, s.lastSeen);
    } else {
      entry.guilds.push({ ...s });
    }
  }
  entry.guilds.sort((a, b) => b.lastSeen - a.lastSeen);
  entry.guilds = entry.guilds.slice(0, MAX_STINTS);
  scheduleSave();
  return entry.guilds.map((g) => ({ ...g }));
}

// ---------- Formato ----------

/** Cifra abreviada en español: 243,8 M, 204,7 K, 1,2 B. */
export function shortNumber(n: number): string {
  const fmt = (v: number) => v.toLocaleString('es-ES', { maximumFractionDigits: v < 10 ? 2 : 1 });
  if (n >= 1e9) return `${fmt(n / 1e9)} B`;
  if (n >= 1e6) return `${fmt(n / 1e6)} M`;
  if (n >= 1e3) return `${fmt(n / 1e3)} K`;
  return String(Math.round(n));
}
