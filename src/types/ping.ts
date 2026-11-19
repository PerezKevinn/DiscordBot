/**
 * Tipos compartidos del bot: config de cada servidor, plantillas de contenido, pings y borradores.
 * Se guardan tal cual en data/ como JSON, así que un campo obligatorio nuevo obliga a migrar los
 * archivos existentes; por eso casi todos los campos añadidos después son opcionales.
 */

/** Build de un rol: id de ítem del catálogo por hueco (ver src/data/items.ts). */
export type RoleBuild = Partial<Record<'weapon' | 'offhand' | 'head' | 'armor' | 'shoes' | 'cape' | 'mount' | 'food' | 'potion', string>>;

/** Rol dentro de una compo (Tanque, Healer…), con su cupo y su build opcional. */
export interface RoleTemplate {
  id: string;
  label: string;
  emoji: string;
  /** Cupos del rol; 0 significa ilimitado. */
  maxSlots: number;
  description?: string;
  build?: RoleBuild;
  /** Cambios de equipo para un momento concreto (p. ej. "Boss"): solo los huecos que cambian. */
  swaps?: BuildSwap[];
}

/** Máximo de cambios de equipo (swaps) por rol. */
export const MAX_SWAPS_PER_ROLE = 3;

/** Cambio de equipo de un rol para un momento concreto de la actividad. */
export interface BuildSwap {
  /** Momento en que se aplica, p. ej. "Boss". */
  label: string;
  /** Solo los huecos que cambian respecto a la build principal. */
  build: RoleBuild;
}

/** Plantilla de un tipo de contenido (Gankeo, ZvZ…): valores por defecto del ping y compo de roles. */
export interface ContentTypeConfig {
  id: string;
  name: string;
  emoji: string;
  subtitle: string;
  /** Color hex de los detalles secundarios del banner. */
  accentColor: string;
  defaultGearTier: string;
  defaultMount: string;
  defaultZone: string;
  roles: RoleTemplate[];
  /** Tamaño fijo de la party (p. ej. 7). Útil si hay roles sin límite. Sin valor = suma de cupos. */
  partySize?: number;
  /** Crear canal de voz temporal al publicar. Por defecto, sí. */
  createVoice?: boolean;
  /** Crear hilo de builds al publicar. Por defecto, sí. */
  createThread?: boolean;
}

/** Plan de un servidor. */
export type PlanTier = 'free' | 'premium';

/** Ajustes de los puntos de actividad de un servidor. */
export interface PointsSettings {
  enabled: boolean;
  /** Puntos que se proponen a cada participante al repartir. */
  defaultAward: number;
  /** Máximo que un Caller puede dar a un jugador en una actividad. */
  maxPerActivity: number;
}

/** Suscripción de Discord (entitlement del SKU Premium) tal como se guardó la última vez. */
export interface GuildSubscription {
  entitlementId: string;
  /** Usuario que paga la suscripción. */
  userId: string;
  startsAt?: number;
  /** Sin valor: se renueva sola. Con valor: está cancelada y termina en esa fecha. */
  endsAt?: number;
  active: boolean;
  updatedAt: number;
}

/**
 * Configuración de un servidor de Discord, guardada en data/guilds/<guildId>.json.
 */
export interface GuildConfig {
  guildId: string;
  /** Nombre que se muestra en los pings; por defecto, el del servidor. */
  guildName: string;
  /** Siglas del gremio, p. ej. [KOS]. Solo se muestran en Premium. */
  guildTag: string;
  /** Lema del gremio. Solo se muestra en Premium. */
  motto: string;
  colors: {
    primaryBlack: string;
    secondaryBlack: string;
    goldPrimary: string;
    goldLight: string;
    goldDark: string;
    embedHex: number;
  };
  /** Rol que puede crear pings. Si no hay, puede cualquiera. */
  callerRoleId?: string;
  /** Rol a mencionar por tipo de contenido: contentTypeId -> roleId. */
  pingRoles: Record<string, string>;
  /** Rol a mencionar si el contenido no tiene uno propio. */
  defaultPingRoleId?: string;
  /** Categoría donde se crean los canales de voz temporales. */
  voiceCategoryId?: string;
  /** Canal por defecto donde se publican los pings. */
  pingTargetChannelId?: string;
  /**
   * Premium por tiempo (manual, código o pago). No refleja la suscripción de Discord:
   * el plan real lo da getEffectiveTier().
   */
  plan: PlanTier;
  /** Icono del servidor en Discord; se actualiza solo con GuildUpdate. */
  iconUrl?: string;
  /** Hay un logo propio en data/logos/<guildId>.png (Premium). */
  customLogo?: boolean;
  /** Momento en que el bot salió del servidor; los datos se borran pasado el plazo de retención. */
  leftAt?: number;
  /** Fin del Premium por tiempo, en ms. Sin valor y con plan premium significa de por vida. */
  premiumUntil?: number;
  /** Origen del Premium por tiempo. */
  premiumSource?: 'manual' | 'code' | 'payment';
  /** Suscripción de Discord. Convive con el Premium por tiempo: ninguno de los dos pisa al otro. */
  subscription?: GuildSubscription;
  /** Avisos de vencimiento ya enviados, por fecha de fin, para no repetirlos. */
  notices?: { warnedFor?: number; expiredFor?: number };
  /** Puntos de actividad (ver utils/points.ts). Sin valor se usan los valores por defecto. */
  points?: PointsSettings;
  /** Sistema de tickets. Sin valor, no está configurado. */
  tickets?: TicketSettings;
  contentTypes: ContentTypeConfig[];
  /** Versión de la corrección a nombres oficiales del juego ya aplicada (ver data/gameNames.ts). */
  namesVersion?: number;
  createdAt: number;
}

/** Jugador anotado en un rol, en la banca o como ausente. */
export interface RosterSlotUser {
  userId: string;
  username: string;
  displayName: string;
  joinedAt: number;
  customWeapon?: string;
}

/** Ping publicado. Se conserva en disco hasta CLOSED_PING_TTL_MS después de cerrarse. */
export interface ActivePing {
  id: string;
  /** Opcional por los pings migrados de la versión de un solo servidor; savePing lo rellena. */
  guildId?: string;
  messageId: string;
  channelId: string;
  threadId?: string;
  voiceChannelId?: string;
  /** Alguien entró a la voz temporal; sirve para detectar cuándo terminó la actividad. */
  voiceUsed?: boolean;
  callerId: string;
  callerName: string;
  callerAvatarUrl?: string;
  contentTypeId: string;
  contentName: string;
  title: string;
  departureLocation: string;
  gearTier: string;
  mountRequired: string;
  /** Hora de salida en segundos, para las marcas de tiempo de Discord (<t:UNIX:R>). */
  startTimeUnix: number;
  timeLabel: string;
  notes: string;
  roles: RoleTemplate[];
  /** Tamaño fijo de la party copiado del contenido al publicar. Sin valor: suma de cupos. */
  partySize?: number;
  /** Jugadores anotados por rol: roleId -> jugadores. */
  roster: Record<string, RosterSlotUser[]>;
  /** Banca o relleno (Fill). */
  bench: RosterSlotUser[];
  /** Jugadores que marcaron que no pueden asistir. */
  absent: RosterSlotUser[];
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | 'CANCELLED';
  createdAt: number;
  closedAt?: number;
  /** Id de quien dio GG o canceló. Sin valor: cierre automático o ping anterior a este campo. */
  closedBy?: string;
  /** Nombre visible de closedBy en ese momento, para los registros. */
  closedByName?: string;
  closedVia?: 'discord' | 'panel' | 'auto';
  /** Cuándo borrar el mensaje del ping, p. ej. unos minutos después de repartir puntos. */
  messageDeleteAt?: number;
  /** El mensaje del ping ya se borró de Discord. */
  messageDeleted?: boolean;
}

/** A quién menciona el ping al publicarse; ROLE usa el rol de aviso del contenido. */
export type MentionType = 'NONE' | 'HERE' | 'EVERYONE' | 'ROLE';

/** Borrador del asistente de /ping. Vive solo en memoria (ver ConfigManager.getDraft). */
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
  /** Hora de salida elegida, en UTC. */
  utcHour?: number;
  utcMinute?: number;
  startTimeUnix?: number;
  timeLabel?: string;
  notes?: string;
  targetChannelId?: string;
  mentionType: MentionType;
  createThread: boolean;
  createVoice: boolean;
  customRoles?: RoleTemplate[];
}

// ---------- Tickets (ver handlers/ticketHandler.ts) ----------

/** Pregunta del formulario que se rellena al abrir un ticket. */
export interface TicketQuestion {
  id: string;
  /** Título del campo; Discord admite 45 caracteres. */
  label: string;
  placeholder: string;
  style: 'short' | 'paragraph';
  required: boolean;
}

/** Tipo de ticket: un botón del panel (Aplicar al gremio, Soporte…). */
export interface TicketType {
  id: string;
  name: string;
  emoji: string;
  /** Texto corto bajo el nombre en el panel. */
  description: string;
  buttonStyle: 'primary' | 'secondary' | 'success' | 'danger';
  /** Canal privado en una categoría o hilo privado en un canal de texto. */
  mode: 'channel' | 'thread';
  /** Categoría de los canales (modo canal). Sin valor, la del canal del panel. */
  categoryId?: string;
  /** Canal donde se crean los hilos (modo hilo). Sin valor, el del panel. */
  threadChannelId?: string;
  staffRoleIds: string[];
  /** Mencionar a los roles de staff al abrir. En modo hilo es lo que los añade al hilo. */
  pingStaff: boolean;
  /** Mensaje de bienvenida dentro del ticket. */
  welcome: string;
  questions: TicketQuestion[];
  /** Ticket de reclutamiento: pide el personaje de Albion y publica su ficha. */
  recruitment: boolean;
  /** Roles que se dan al aceptar (reclutamiento). */
  acceptRoleIds: string[];
  /** Roles que se quitan al aceptar (p. ej. Invitado). */
  removeRoleIds: string[];
  /** Poner el nombre del personaje como apodo al aceptar. */
  setNickname: boolean;
}

/** Mensaje con los botones para abrir tickets. */
export interface TicketPanel {
  id: string;
  channelId: string;
  title: string;
  description: string;
  typeIds: string[];
  /** Mensaje publicado; se edita al volver a publicar. */
  messageId?: string;
}

/** Ajustes de tickets de un servidor. */
export interface TicketSettings {
  /** Canal donde se registran aperturas y cierres con su transcripción. */
  logChannelId?: string;
  /** Servidor de Albion del gremio, o 'ask' para que el aspirante lo elija. */
  albionServer: 'americas' | 'europe' | 'asia' | 'ask';
  /** Avisar por mensaje privado al aspirante al cerrar y al aceptar o rechazar. */
  dmUser: boolean;
  types: TicketType[];
  panels: TicketPanel[];
}
