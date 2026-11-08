/** Build de un rol: id de ítem del catálogo por hueco (ver src/data/items.ts). */
export type RoleBuild = Partial<Record<'weapon' | 'offhand' | 'head' | 'armor' | 'shoes' | 'cape' | 'mount' | 'food' | 'potion', string>>;

export interface RoleTemplate {
  id: string;
  label: string;
  emoji: string;
  maxSlots: number; // 0 = ilimitado
  description?: string;
  build?: RoleBuild;
}

export interface ContentTypeConfig {
  id: string;
  name: string;
  emoji: string;
  subtitle: string;
  accentColor: string; // Hex color para detalles secundarios en el canvas
  defaultGearTier: string;
  defaultMount: string;
  defaultZone: string;
  roles: RoleTemplate[];
  /** Crear canal de voz temporal al publicar (por defecto sí) */
  createVoice?: boolean;
  /** Crear hilo de builds al publicar (por defecto sí) */
  createThread?: boolean;
}

export type PlanTier = 'free' | 'premium';

export interface GuildSubscription {
  entitlementId: string;
  userId: string; // quien paga
  startsAt?: number;
  endsAt?: number; // sin valor = se renueva sola
  active: boolean;
  updatedAt: number;
}

/**
 * Configuración de UN servidor de Discord. Cada servidor donde está el bot tiene la suya
 * (data/guilds/<guildId>.json).
 */
export interface GuildConfig {
  guildId: string;
  guildName: string; // Nombre mostrado en pings (por defecto, el nombre del servidor)
  guildTag: string; // Siglas, ej: [KOS] (personalizable en Premium)
  motto: string; // Lema del gremio (personalizable en Premium)
  colors: {
    primaryBlack: string;
    secondaryBlack: string;
    goldPrimary: string;
    goldLight: string;
    goldDark: string;
    embedHex: number;
  };
  /** Rol que puede tirar pings. Si no hay, cualquiera puede. */
  callerRoleId?: string;
  /** Rol a mencionar por tipo de contenido: contentTypeId -> roleId (ej: gankeo -> @Gankeo) */
  pingRoles: Record<string, string>;
  /** Rol por defecto a mencionar si el contenido no tiene uno propio */
  defaultPingRoleId?: string;
  voiceCategoryId?: string; // Categoría donde se crean los canales de voz temporales
  pingTargetChannelId?: string; // Canal por defecto donde se publican los pings
  plan: PlanTier;
  /** Icono del servidor de Discord (se actualiza solo) */
  iconUrl?: string;
  /** Hay un logo propio subido en data/logos/<guildId>.png (Premium) */
  customLogo?: boolean;
  /** Momento en que el bot salió del servidor (los datos se borran pasado el plazo de retención) */
  leftAt?: number;
  premiumUntil?: number; // ms epoch. Sin valor + plan premium = de por vida
  /** De dónde salió el Premium por tiempo (plan/premiumUntil) */
  premiumSource?: 'manual' | 'code' | 'payment';
  /** Suscripción de Discord (entitlement del SKU Premium). Convive con el Premium por tiempo. */
  subscription?: GuildSubscription;
  /** Avisos de vencimiento ya enviados (por fecha de fin, para no repetirlos) */
  notices?: { warnedFor?: number; expiredFor?: number };
  contentTypes: ContentTypeConfig[];
  /** Versión de la corrección a nombres oficiales del juego ya aplicada a las plantillas */
  namesVersion?: number;
  createdAt: number;
}

export interface RosterSlotUser {
  userId: string;
  username: string;
  displayName: string;
  joinedAt: number;
  customWeapon?: string;
}

export interface ActivePing {
  id: string;
  guildId?: string;
  messageId: string;
  channelId: string;
  threadId?: string;
  voiceChannelId?: string;
  voiceUsed?: boolean; // alguien entró a la voz temporal (para detectar el fin de la actividad)
  callerId: string;
  callerName: string;
  callerAvatarUrl?: string;
  contentTypeId: string;
  contentName: string;
  title: string;
  departureLocation: string;
  gearTier: string;
  mountRequired: string;
  startTimeUnix: number; // Timestamp en segundos para <t:UNIX:R>
  timeLabel: string;
  notes: string;
  roles: RoleTemplate[];
  roster: Record<string, RosterSlotUser[]>; // roleId -> lista de jugadores anotados
  bench: RosterSlotUser[]; // Jugadores en banca / relleno (Fill)
  absent: RosterSlotUser[]; // Jugadores que marcaron no poder asistir
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | 'CANCELLED';
  createdAt: number;
  closedAt?: number;
}

export type MentionType = 'NONE' | 'HERE' | 'EVERYONE' | 'ROLE';

export interface DraftPingSession {
  guildId: string;
  callerId: string;
  callerName: string;
  callerAvatarUrl?: string;
  contentTypeId: string;
  title?: string;
  departureLocation?: string;
  gearTier?: string;
  mountRequired?: string;
  minutesFromNow?: number;
  startTimeUnix?: number;
  timeLabel?: string;
  notes?: string;
  targetChannelId?: string;
  mentionType: MentionType;
  createThread: boolean;
  createVoice: boolean;
  customRoles?: RoleTemplate[];
}
