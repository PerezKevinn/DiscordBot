export type ItemSlot = 'weapon' | 'offhand' | 'head' | 'armor' | 'shoes' | 'cape' | 'mount' | 'food' | 'potion';

export interface CatalogItem {
  id: string;
  slot: ItemSlot;
  name: string;
  en: string;
  icon: string;
  tier?: number;
}

export type RoleBuild = Partial<Record<ItemSlot, string>>;

/** Cambio de equipo para un momento concreto ("Boss"…): solo los huecos que cambian. */
export interface BuildSwap {
  label: string;
  build: RoleBuild;
}

export const MAX_SWAPS_PER_ROLE = 3;

export interface Role {
  id?: string;
  name: string;
  weapons: string;
  emoji: string;
  maxSlots: number;
  description: string;
  build: RoleBuild;
  swaps: BuildSwap[];
}

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
  createVoice?: boolean;
  createThread?: boolean;
}

export interface Me {
  user: { id: string; name: string; avatar: string | null; isOwner: boolean };
  guilds: Array<{ id: string; name: string; icon: string | null; botPresent: boolean; inviteUrl: string }>;
}

export interface GuildData {
  guild: { id: string; name: string; icon: string | null };
  plan: {
    tier: 'free' | 'premium';
    limits: { maxActivePings: number; maxContentTypes: number; customBranding: boolean; hideBotFooter: boolean };
    premiumUntil: number | null;
    /** Fin del Premium (null = no vence o gratis: mirar tier) */
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
}

export interface PremiumPackage {
  id: '1m' | '3m' | '12m';
  label: string;
  days: number;
  priceCop: number;
}

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

export const cop = (n: number) => `$${n.toLocaleString('es-CO')} COP`;

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

export interface AdminGuild {
  id: string;
  name: string;
  icon: string | null;
  members: number | null;
  botPresent: boolean;
  joinedAt: number;
  tier: 'free' | 'premium';
  endsAt: number | null;
  lifetime: boolean;
  timed: { source: 'manual' | 'code' | 'payment'; until: number | null } | null;
  subscription: { active: boolean; endsAt: number | null; userId: string } | null;
}

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

export interface AdminOverview {
  stats: { guilds: number; premium: number; subscriptions: number; timed: number; expiringSoon: number };
  skuConfigured: boolean;
  guilds: AdminGuild[];
  codes: RedeemCode[];
  history: MembershipEvent[];
  payments: { enabled: boolean; test: boolean; orders: PaymentOrder[]; revenue30d: number };
}

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

export function fmtDate(ms: number | null | undefined, withTime = false) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('es', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
}

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

export function iconUrl(item: CatalogItem, size = 64) {
  return `https://render.albiononline.com/v1/item/${encodeURIComponent(item.icon)}.png?size=${size}`;
}

// ---------- Puntos ----------
export type RankingPeriod = 'total' | 'month' | 'week';

export const PERIOD_LABEL: Record<RankingPeriod, string> = {
  total: 'Temporada',
  month: 'Últimos 30 días',
  week: 'Últimos 7 días',
};

export interface PointsEntry {
  userId: string;
  name: string;
  points: number;
}

export interface PointsData {
  settings: { enabled: boolean; defaultAward: number; maxPerActivity: number };
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

export interface PointsEditor {
  pingId: string;
  title: string;
  max: number;
  entries: PointsEntry[];
}
