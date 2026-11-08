import fs from 'fs';
import path from 'path';
import { cloneDefaultContentTypes } from '../data/defaultTemplates';
import { applyGameNames, NAMES_VERSION } from '../data/gameNames';
import { ActivePing, ContentTypeConfig, DraftPingSession, GuildConfig, RoleTemplate } from '../types/ping';

const DATA_DIR = path.join(process.cwd(), 'data');
const GUILDS_DIR = path.join(DATA_DIR, 'guilds');
const PINGS_DIR = path.join(DATA_DIR, 'pings');

// Archivos de la versión anterior (un solo servidor). Se migran al primer arranque.
const LEGACY_CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const LEGACY_PINGS_PATH = path.join(DATA_DIR, 'active_pings.json');

// Pings cerrados/cancelados se borran del disco pasado este tiempo
const CLOSED_PING_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export const DEFAULT_COLORS: GuildConfig['colors'] = {
  primaryBlack: '#0A0A0D',
  secondaryBlack: '#14141A',
  goldPrimary: '#D4AF37',
  goldLight: '#FFE57F',
  goldDark: '#8A6D1B',
  embedHex: 0xd4af37,
};

// Borradores en memoria de los Callers armando un ping: clave `${guildId}:${userId}`.
// Caducan a los 45 min sin tocarlos para no acumular memoria con miles de servidores.
const DRAFT_TTL_MS = 45 * 60 * 1000;
const draftSessions = new Map<string, { draft: DraftPingSession; at: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of draftSessions) if (now - v.at > DRAFT_TTL_MS) draftSessions.delete(k);
}, 10 * 60 * 1000).unref();

const configCache = new Map<string, GuildConfig>();
const pingsCache = new Map<string, Record<string, ActivePing>>();

function ensureDirs() {
  for (const dir of [DATA_DIR, GUILDS_DIR, PINGS_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

/** Escritura atómica: escribe a un .tmp y renombra, para no dejar JSON corrupto si el proceso muere. */
function writeJsonAtomic(filePath: string, data: unknown) {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, filePath);
}

function isValidGuildId(guildId: string): boolean {
  return /^\d{5,25}$/.test(guildId);
}

function guildPath(guildId: string) {
  if (!isValidGuildId(guildId)) throw new Error(`guildId inválido: ${guildId}`);
  return path.join(GUILDS_DIR, `${guildId}.json`);
}

function pingsPath(guildId: string) {
  if (!isValidGuildId(guildId)) throw new Error(`guildId inválido: ${guildId}`);
  return path.join(PINGS_DIR, `${guildId}.json`);
}

function buildDefaultConfig(guildId: string, guildName: string): GuildConfig {
  return {
    guildId,
    guildName: guildName.toUpperCase().slice(0, 40),
    guildTag: '',
    motto: 'ARMEN PARTY • ANÓTENSE EN SU ROL',
    colors: { ...DEFAULT_COLORS },
    pingRoles: {},
    plan: 'free',
    contentTypes: cloneDefaultContentTypes(),
    namesVersion: NAMES_VERSION,
    createdAt: Date.now(),
  };
}

export class ConfigManager {
  /**
   * Migra el config.json/active_pings.json de la versión de un solo servidor
   * al servidor indicado (LEGACY_GUILD_ID o GUILD_ID del .env).
   */
  public static migrateLegacy(targetGuildId: string | undefined): void {
    ensureDirs();
    if (!fs.existsSync(LEGACY_CONFIG_PATH)) return;
    if (!targetGuildId || !isValidGuildId(targetGuildId)) {
      console.warn('⚠️ Hay un data/config.json antiguo pero no hay GUILD_ID válido en .env para migrarlo.');
      return;
    }
    if (fs.existsSync(guildPath(targetGuildId))) return;

    const legacy = JSON.parse(fs.readFileSync(LEGACY_CONFIG_PATH, 'utf-8'));
    const migrated: GuildConfig = {
      ...buildDefaultConfig(targetGuildId, legacy.guildName || 'MI GREMIO'),
      guildName: legacy.guildName,
      guildTag: legacy.guildTag || '',
      motto: legacy.motto || '',
      colors: { ...DEFAULT_COLORS, ...(legacy.colors || {}) },
      voiceCategoryId: legacy.voiceCategoryId,
      pingTargetChannelId: legacy.pingTargetChannelId,
      defaultPingRoleId: legacy.defaultPingRoleId,
      contentTypes: legacy.contentTypes?.length ? legacy.contentTypes : cloneDefaultContentTypes(),
      // El servidor original del dueño conserva su marca propia
      plan: 'premium',
    };
    writeJsonAtomic(guildPath(targetGuildId), migrated);

    if (fs.existsSync(LEGACY_PINGS_PATH)) {
      try {
        const pings = JSON.parse(fs.readFileSync(LEGACY_PINGS_PATH, 'utf-8')) as Record<string, ActivePing>;
        for (const p of Object.values(pings)) p.guildId = targetGuildId;
        writeJsonAtomic(pingsPath(targetGuildId), pings);
        fs.renameSync(LEGACY_PINGS_PATH, `${LEGACY_PINGS_PATH}.migrated`);
      } catch (err) {
        console.warn('No se pudieron migrar los pings antiguos:', err);
      }
    }
    fs.renameSync(LEGACY_CONFIG_PATH, `${LEGACY_CONFIG_PATH}.migrated`);
    console.log(`📦 Config antigua migrada al servidor ${targetGuildId} (data/guilds/${targetGuildId}.json).`);
  }

  // --- Config por servidor ---
  public static getConfig(guildId: string, guildNameHint = 'MI GREMIO'): GuildConfig {
    const cached = configCache.get(guildId);
    if (cached) return cached;

    ensureDirs();
    const file = guildPath(guildId);
    let config: GuildConfig;
    if (fs.existsSync(file)) {
      config = JSON.parse(fs.readFileSync(file, 'utf-8')) as GuildConfig;
      config.pingRoles ||= {};
      config.plan ||= 'free';
      config.colors = { ...DEFAULT_COLORS, ...(config.colors || {}) };
      // Pasar plantillas antiguas a los nombres oficiales del juego (una sola vez)
      if ((config.namesVersion ?? 0) < NAMES_VERSION) {
        config.contentTypes = applyGameNames(config.contentTypes);
        config.namesVersion = NAMES_VERSION;
        writeJsonAtomic(file, config);
      }
    } else {
      config = buildDefaultConfig(guildId, guildNameHint);
      writeJsonAtomic(file, config);
    }
    configCache.set(guildId, config);
    return config;
  }

  /** Guarda el icono actual del servidor (para el logo del banner) si cambió. */
  public static syncGuildIcon(config: GuildConfig, guild: { iconURL(options?: { extension?: 'png'; size?: 256 }): string | null }): void {
    const icon = guild.iconURL({ extension: 'png', size: 256 }) ?? undefined;
    if (config.iconUrl !== icon) {
      config.iconUrl = icon;
      this.saveConfig(config);
    }
  }

  public static saveConfig(config: GuildConfig): void {
    configCache.set(config.guildId, config);
    writeJsonAtomic(guildPath(config.guildId), config);
  }

  public static getContentType(guildId: string, id: string): ContentTypeConfig | undefined {
    return this.getConfig(guildId).contentTypes.find((c) => c.id === id);
  }

  public static upsertContentType(guildId: string, content: ContentTypeConfig): void {
    const config = this.getConfig(guildId);
    const index = config.contentTypes.findIndex((c) => c.id === content.id);
    if (index >= 0) config.contentTypes[index] = content;
    else config.contentTypes.push(content);
    this.saveConfig(config);
  }

  public static deleteContentType(guildId: string, id: string): boolean {
    const config = this.getConfig(guildId);
    const prevLen = config.contentTypes.length;
    config.contentTypes = config.contentTypes.filter((c) => c.id !== id);
    if (config.contentTypes.length === prevLen) return false;
    delete config.pingRoles[id];
    this.saveConfig(config);
    return true;
  }

  public static updateContentRoles(guildId: string, contentId: string, roles: RoleTemplate[]): boolean {
    const config = this.getConfig(guildId);
    const content = config.contentTypes.find((c) => c.id === contentId);
    if (!content) return false;
    content.roles = roles;
    this.saveConfig(config);
    return true;
  }

  public static resetContentTypes(guildId: string): void {
    const config = this.getConfig(guildId);
    config.contentTypes = cloneDefaultContentTypes();
    config.namesVersion = NAMES_VERSION;
    config.pingRoles = {};
    this.saveConfig(config);
  }

  // --- Pings por servidor ---
  public static getActivePings(guildId: string): Record<string, ActivePing> {
    const cached = pingsCache.get(guildId);
    if (cached) return cached;

    ensureDirs();
    const file = pingsPath(guildId);
    let pings: Record<string, ActivePing> = {};
    if (fs.existsSync(file)) {
      try {
        pings = JSON.parse(fs.readFileSync(file, 'utf-8'));
      } catch {
        pings = {};
      }
    }
    // Limpieza de pings viejos ya cerrados
    const now = Date.now();
    for (const [id, p] of Object.entries(pings)) {
      const done = p.status === 'CLOSED' || p.status === 'CANCELLED';
      if (done && now - (p.closedAt || p.createdAt) > CLOSED_PING_TTL_MS) delete pings[id];
    }
    pingsCache.set(guildId, pings);
    return pings;
  }

  public static countOpenPings(guildId: string): number {
    return Object.values(this.getActivePings(guildId)).filter(
      (p) => p.status === 'OPEN' || p.status === 'IN_PROGRESS'
    ).length;
  }

  public static getPing(guildId: string, pingId: string): ActivePing | undefined {
    return this.getActivePings(guildId)[pingId];
  }

  public static savePing(guildId: string, ping: ActivePing): void {
    const pings = this.getActivePings(guildId);
    ping.guildId = guildId;
    pings[ping.id] = ping;
    writeJsonAtomic(pingsPath(guildId), pings);
  }

  // --- Borradores (asistente paso a paso), separados por servidor ---
  public static getDraft(guildId: string, callerId: string): DraftPingSession | undefined {
    const entry = draftSessions.get(`${guildId}:${callerId}`);
    if (!entry) return undefined;
    if (Date.now() - entry.at > DRAFT_TTL_MS) {
      draftSessions.delete(`${guildId}:${callerId}`);
      return undefined;
    }
    return entry.draft;
  }

  public static setDraft(guildId: string, callerId: string, draft: DraftPingSession): void {
    draftSessions.set(`${guildId}:${callerId}`, { draft, at: Date.now() });
  }

  public static clearDraft(guildId: string, callerId: string): void {
    draftSessions.delete(`${guildId}:${callerId}`);
  }

  /** Libera la caché de un servidor (p. ej. cuando expulsan al bot). Los archivos se conservan. */
  public static evictGuild(guildId: string): void {
    configCache.delete(guildId);
    pingsCache.delete(guildId);
  }

  // --- Retención de datos (ver utils/dataRetention.ts) ---

  /** IDs de todos los servidores con datos guardados. */
  public static listStoredGuildIds(): string[] {
    ensureDirs();
    return fs
      .readdirSync(GUILDS_DIR)
      .filter((f) => /^\d{5,25}\.json$/.test(f))
      .map((f) => f.replace('.json', ''));
  }

  /** Lee la config del disco sin crearla ni cachearla (null si no existe o está dañada). */
  public static peekConfig(guildId: string): GuildConfig | null {
    const file = guildPath(guildId);
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8')) as GuildConfig;
    } catch {
      return null;
    }
  }

  /** Marca que el bot salió del servidor; sus datos se borran pasado el plazo de retención. */
  public static markGuildLeft(guildId: string, at = Date.now()): void {
    const config = configCache.get(guildId) ?? this.peekConfig(guildId);
    if (config && !config.leftAt) {
      config.leftAt = at;
      writeJsonAtomic(guildPath(guildId), config);
    }
    this.evictGuild(guildId);
  }

  /** El bot volvió al servidor: se cancela el borrado pendiente. */
  public static clearGuildLeft(guildId: string): void {
    const config = this.peekConfig(guildId);
    if (config?.leftAt) {
      delete config.leftAt;
      writeJsonAtomic(guildPath(guildId), config);
      this.evictGuild(guildId);
    }
  }

  /** Borra todos los datos de un servidor: config, pings y logo. */
  public static purgeGuild(guildId: string): void {
    this.evictGuild(guildId);
    for (const file of [guildPath(guildId), pingsPath(guildId), path.join(DATA_DIR, 'logos', `${guildId}.png`)]) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    for (const key of [...draftSessions.keys()]) if (key.startsWith(`${guildId}:`)) draftSessions.delete(key);
  }
}
