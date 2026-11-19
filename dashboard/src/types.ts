/**
 * Tipos de las respuestas de la API del panel y utilidades de formato compartidas.
 * Reflejan lo que serializa src/panel/server.ts, no los tipos internos del bot: si cambia una
 * respuesta allí, hay que actualizarla aquí a mano.
 */

/** Hueco de equipo de una build. */
export type ItemSlot = 'weapon' | 'offhand' | 'head' | 'armor' | 'shoes' | 'cape' | 'mount' | 'food' | 'potion';

/** Ítem del catálogo (GET /api/items). */
export interface CatalogItem {
  id: string;
  slot: ItemSlot;
  name: string;
  en: string;
  icon: string;
  tier?: number;
}

/** Build de un rol: id de ítem por hueco. */
export type RoleBuild = Partial<Record<ItemSlot, string>>;

/** Cambio de equipo para un momento concreto (p. ej. "Boss"): solo los huecos que cambian. */
export interface BuildSwap {
  label: string;
  build: RoleBuild;
}

/** Máximo de swaps por rol; tiene que coincidir con el del bot (src/types/ping.ts). */
export const MAX_SWAPS_PER_ROLE = 3;

/** Rol tal como lo edita el panel: el bot guarda nombre y armas juntos en una sola etiqueta. */
export interface Role {
  /** Sin valor en los roles nuevos; el servidor les asigna uno al guardar. */
  id?: string;
  name: string;
  /** Armas sugeridas, en texto libre. */
  weapons: string;
  emoji: string;
  maxSlots: number;
  description: string;
  build: RoleBuild;
  swaps: BuildSwap[];
}

/** Plantilla de contenido. */
export interface Content {
  id: string;
  name: string;
  emoji: string;
  subtitle: string;
  accentColor: string;
  defaultGearTier: string;
  defaultMount: string;
  defaultZone: string;
  roles: Role[];
  /** Tamaño fijo de la party; sin valor, la suma de los cupos de los roles. */
  partySize?: number | null;
  createVoice?: boolean;
  createThread?: boolean;
}

/** Usuario con sesión y los servidores que puede gestionar (GET /api/me). */
export interface Me {
  user: { id: string; name: string; avatar: string | null; isOwner: boolean };
  guilds: Array<{ id: string; name: string; icon: string | null; botPresent: boolean; inviteUrl: string }>;
}

/** Todo lo que el panel necesita de un servidor (GET /api/guilds/:id y casi todas las escrituras). */
export interface GuildData {
  guild: { id: string; name: string; icon: string | null };
  plan: {
    tier: 'free' | 'premium';
    limits: {
      maxActivePings: number;
      maxContentTypes: number;
      customBranding: boolean;
      hideBotFooter: boolean;
      maxTicketPanels: number;
      maxTicketTypes: number;
      albionGuildHistory: boolean;
      htmlTranscripts: boolean;
    };
    premiumUntil: number | null;
    /** Fin del Premium. null si no vence o si es gratis; se distingue con tier. */
    endsAt: number | null;
    timed: { source: 'manual' | 'code' | 'payment'; until: number | null } | null;
    subscription: { endsAt: number | null } | null;
    storeUrl: string | null;
    payments: { test: boolean; packages: PremiumPackage[] } | null;
    history: Array<{ at: number; type: MembershipEventType; days?: number | null; until?: number | null; code?: string }>;
  };
  settings: {
    callerRoleId: string | null;
    defaultPingRoleId: string | null;
    pingTargetChannelId: string | null;
    voiceCategoryId: string | null;
    pingRoles: Record<string, string>;
  };
  branding: { guildName: string; guildTag: string; motto: string; color: string; customLogo: boolean };
  contents: Content[];
  discord: {
    roles: Array<{ id: string; name: string; color: string; mentionable: boolean }>;
    channels: Array<{ id: string; name: string; botCanSend: boolean }>;
    categories: Array<{ id: string; name: string }>;
  };
  pings: Array<{
    id: string;
    title: string;
    contentName: string;
    status: 'OPEN' | 'IN_PROGRESS';
    callerName: string;
    startTimeUnix: number;
    channelId: string;
    url: string;
    joined: number;
    max: number;
  }>;
  tickets: TicketsData;
}

/** Pregunta del formulario de un ticket. */
export interface TicketQuestion {
  id: string;
  label: string;
  placeholder: string;
  style: 'short' | 'paragraph';
  required: boolean;
}

/** Tipo de ticket (un botón del panel). */
export interface TicketType {
  id: string;
  name: string;
  emoji: string;
  description: string;
  buttonStyle: 'primary' | 'secondary' | 'success' | 'danger';
  mode: 'channel' | 'thread';
  categoryId: string | null;
  threadChannelId: string | null;
  staffRoleIds: string[];
  pingStaff: boolean;
  welcome: string;
  questions: TicketQuestion[];
  recruitment: boolean;
  acceptRoleIds: string[];
  removeRoleIds: string[];
  setNickname: boolean;
}

/** Panel de tickets; url es el mensaje publicado, si lo hay. */
export interface TicketPanel {
  id: string;
  channelId: string;
  title: string;
  description: string;
  typeIds: string[];
  url?: string | null;
}

/** Configuración y estado de los tickets de un servidor. */
export interface TicketsData {
  logChannelId: string | null;
  albionServer: 'americas' | 'europe' | 'asia' | 'ask';
  dmUser: boolean;
  types: TicketType[];
  panels: TicketPanel[];
  open: Array<{
    id: string;
    number: string;
    typeName: string;
    userName: string;
    createdAt: number;
    claimed: boolean;
    character: string | null;
    url: string;
  }>;
  /** Permisos que le faltan al bot para los tickets configurados. */
  issues: string[];
}

/** Paquete de Premium a la venta. */
export interface PremiumPackage {
  id: '1m' | '3m' | '12m';
  label: string;
  days: number;
  priceCop: number;
}

/** Orden de pago, tal como la ve la administración. */
export interface PaymentOrder {
  invoice: string;
  guildId: string;
  guildName?: string;
  userId: string;
  packageId: string;
  days: number;
  amount: number;
  currency: 'COP';
  status: 'created' | 'pending' | 'paid' | 'rejected' | 'reversed';
  test: boolean;
  createdAt: number;
  updatedAt: number;
  paymentRef?: string;
  provider?: 'mercadopago' | 'epayco';
  paidAt?: number;
}

/** Formatea un importe en pesos colombianos: "$15.000 COP". */
export const cop = (n: number) => `$${n.toLocaleString('es-CO')} COP`;

/** Tipos de evento del historial de Premium; los textos están en EVENT_LABELS. */
export type MembershipEventType =
  | 'payment'
  | 'payment_reversed'
  | 'grant'
  | 'extend'
  | 'revoke'
  | 'code_redeemed'
  | 'subscription_started'
  | 'subscription_updated'
  | 'subscription_ended'
  | 'expired';

/** Entrada del historial de Premium. */
export interface MembershipEvent {
  at: number;
  guildId: string;
  guildName?: string;
  type: MembershipEventType;
  actorId?: string;
  days?: number | null;
  until?: number | null;
  code?: string;
  note?: string;
}

/** Fila de un servidor en la administración. */
export interface AdminGuild {
  id: string;
  name: string;
  icon: string | null;
  members: number | null;
  botPresent: boolean;
  joinedAt: number;
  tier: 'free' | 'premium';
  /** null si no vence o si es gratis; se distingue con tier. */
  endsAt: number | null;
  lifetime: boolean;
  timed: { source: 'manual' | 'code' | 'payment'; until: number | null } | null;
  subscription: { active: boolean; endsAt: number | null; userId: string } | null;
}

/** Código canjeable, con su estado calculado por el servidor. */
export interface RedeemCode {
  code: string;
  days: number | null;
  maxUses: number;
  uses: Array<{ guildId: string; guildName?: string; userId: string; at: number }>;
  createdAt: number;
  createdBy: string;
  expiresAt?: number;
  note?: string;
  disabled?: boolean;
  status: 'active' | 'used' | 'expired' | 'disabled';
}

/** Respuesta de GET /api/admin/overview. */
export interface AdminOverview {
  stats: { guilds: number; premium: number; subscriptions: number; timed: number; expiringSoon: number };
  skuConfigured: boolean;
  guilds: AdminGuild[];
  codes: RedeemCode[];
  history: MembershipEvent[];
  payments: { enabled: boolean; test: boolean; orders: PaymentOrder[]; revenue30d: number };
}

/** Texto de cada tipo de evento del historial. */
export const EVENT_LABELS: Record<MembershipEventType, string> = {
  grant: 'Premium concedido',
  extend: 'Días añadidos',
  revoke: 'Premium retirado',
  code_redeemed: 'Código canjeado',
  subscription_started: 'Suscripción iniciada',
  subscription_updated: 'Suscripción actualizada',
  subscription_ended: 'Suscripción terminada',
  expired: 'Premium vencido',
  payment: 'Pago aprobado',
  payment_reversed: 'Pago reversado',
};

/** Fecha en formato local, opcionalmente con hora. Sin valor devuelve "—". */
export function fmtDate(ms: number | null | undefined, withTime = false) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('es', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
}

/** Huecos de la build en el orden en que se muestran, como en el juego. */
export const BUILD_SLOTS: Array<{ slot: ItemSlot; label: string }> = [
  { slot: 'weapon', label: 'Arma' },
  { slot: 'offhand', label: 'Mano secundaria' },
  { slot: 'head', label: 'Cabeza' },
  { slot: 'armor', label: 'Armadura' },
  { slot: 'shoes', label: 'Botas' },
  { slot: 'cape', label: 'Capa' },
  { slot: 'food', label: 'Comida' },
  { slot: 'potion', label: 'Poción' },
  { slot: 'mount', label: 'Montura' },
];

/** URL del icono oficial de un ítem (servicio de render de Albion Online). */
export function iconUrl(item: CatalogItem, size = 64) {
  return `https://render.albiononline.com/v1/item/${encodeURIComponent(item.icon)}.png?size=${size}`;
}

// ---------- Puntos ----------

/** Periodo del ranking: 'total' es la temporada actual. */
export type RankingPeriod = 'total' | 'month' | 'week';

/** Nombre de cada periodo; coincide con los del bot. */
export const PERIOD_LABEL: Record<RankingPeriod, string> = {
  total: 'Temporada',
  month: 'Últimos 30 días',
  week: 'Últimos 7 días',
};

/** Puntos de un jugador dentro de un registro. */
export interface PointsEntry {
  userId: string;
  name: string;
  points: number;
}

/** Respuesta de GET /api/guilds/:id/points y de las escrituras de puntos. */
export interface PointsData {
  settings: { enabled: boolean; defaultAward: number; maxPerActivity: number };
  /** El servidor tiene las funciones de puntos Premium. */
  pro: boolean;
  rankingSize: number;
  period: RankingPeriod;
  seasonStart: number | null;
  ranking: Array<{ userId: string; name: string; points: number; activities: number; rank: number }>;
  awards: Array<{
    id: string;
    kind: 'activity' | 'adjust';
    title: string;
    contentName: string | null;
    by: string;
    byName: string | null;
    at: number;
    updatedAt: number | null;
    note: string | null;
    total: number;
    entries: PointsEntry[];
  }>;
  /** Salidas cerradas que siguen guardadas; awarded es null si aún no se repartieron puntos. */
  pending: Array<{
    pingId: string;
    title: string;
    contentName: string;
    callerName: string;
    closedAt: number;
    participants: number;
    awarded: number | null;
  }>;
}

/** Datos para el editor de reparto de una salida. */
export interface PointsEditor {
  pingId: string;
  title: string;
  /** Máximo por jugador (maxPerActivity del servidor). */
  max: number;
  entries: PointsEntry[];
}
