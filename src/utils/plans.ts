/**
 * Planes Gratis y Premium: límites de cada uno, plan efectivo de un servidor y precios de los
 * paquetes. Para mover una función de un plan a otro basta con cambiar PLAN_LIMITS.
 */
import { GuildConfig, PlanTier } from '../types/ping';

/** Límites y funciones de un plan. */
export interface PlanLimits {
  /** Pings abiertos o en ruta a la vez por servidor. */
  maxActivePings: number;
  /** Plantillas de contenido por servidor. 25 es el máximo de opciones de un menú de Discord. */
  maxContentTypes: number;
  /** Nombre, siglas, lema, color y logo propios en el banner y los embeds. */
  customBranding: boolean;
  /** Quitar el pie "Creado con <bot>" de los pings. */
  hideBotFooter: boolean;
  /** Puestos que muestra el ranking de puntos. */
  pointsRankingSize: number;
  /** Ranking por semana y mes, temporadas, ajustes manuales e historial completo. */
  pointsPro: boolean;
  /** Paneles de tickets por servidor. */
  maxTicketPanels: number;
  /** Tipos de ticket por servidor. */
  maxTicketTypes: number;
  /** Gremios anteriores en la ficha de Albion. */
  albionGuildHistory: boolean;
  /** Transcripción de los tickets en HTML con formato (en gratis, texto plano). */
  htmlTranscripts: boolean;
  /** Reparto de loot: importar el log del loot logger, historial completo y exportación a CSV. */
  lootPro: boolean;
}

/** Límites de cada plan. */
export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    maxActivePings: 3,
    maxContentTypes: 12,
    customBranding: false,
    hideBotFooter: false,
    pointsRankingSize: 10,
    pointsPro: false,
    maxTicketPanels: 1,
    maxTicketTypes: 3,
    albionGuildHistory: false,
    htmlTranscripts: false,
    lootPro: false,
  },
  premium: {
    maxActivePings: 25,
    maxContentTypes: 25,
    customBranding: true,
    hideBotFooter: true,
    pointsRankingSize: 25,
    pointsPro: true,
    maxTicketPanels: 5,
    maxTicketTypes: 10,
    albionGuildHistory: true,
    htmlTranscripts: true,
    lootPro: true,
  },
};

/** Nombre público del bot. Se lee en cada llamada y no al cargar el módulo, por si el .env aún no se ha cargado. */
export function botBrandName(): string {
  return process.env.BOT_BRAND_NAME || 'MassUp';
}

/** Indica si el servidor tiene una suscripción de Discord vigente. */
export function hasActiveSubscription(config: GuildConfig, now = Date.now()): boolean {
  const s = config.subscription;
  return Boolean(s?.active && (!s.endsAt || s.endsAt > now));
}

/** Indica si el servidor tiene Premium por tiempo vigente (manual, código o pago). */
export function hasTimedPremium(config: GuildConfig, now = Date.now()): boolean {
  return config.plan === 'premium' && (!config.premiumUntil || config.premiumUntil > now);
}

/** Plan efectivo del servidor: Premium si lo da la suscripción o el tiempo concedido. */
export function getEffectiveTier(config: GuildConfig, now = Date.now()): PlanTier {
  return hasActiveSubscription(config, now) || hasTimedPremium(config, now) ? 'premium' : 'free';
}

/**
 * Cuándo deja de ser Premium, teniendo en cuenta todas las fuentes: el fin más lejano.
 * @returns null si no vence (de por vida o suscripción que se renueva); undefined si ya es gratis.
 */
export function premiumEndsAt(config: GuildConfig, now = Date.now()): number | null | undefined {
  const ends: Array<number | null> = [];
  if (hasActiveSubscription(config, now)) ends.push(config.subscription!.endsAt ?? null);
  if (hasTimedPremium(config, now)) ends.push(config.premiumUntil ?? null);
  if (ends.length === 0) return undefined;
  if (ends.includes(null)) return null;
  return Math.max(...(ends as number[]));
}

/** Enlace a la tienda de Discord para suscribirse a Premium, o null si no hay SKU configurado. */
export function premiumStoreUrl(): string | null {
  const sku = premiumSkuId();
  const app = process.env.CLIENT_ID;
  return sku && app ? `https://discord.com/application-directory/${app}/store/${sku}` : null;
}

/** Paquete de Premium prepagado con Mercado Pago. */
export interface PremiumPackage {
  id: '1m' | '3m' | '12m';
  label: string;
  days: number;
  /** Precio en pesos colombianos, sin decimales. */
  priceCop: number;
}

/**
 * Paquetes a la venta. Los precios se pueden cambiar con PREMIUM_PRICE_1M, _3M y _12M en el .env;
 * un valor no entero o menor de 1000 se ignora y se usa el precio por defecto.
 */
export function premiumPackages(): PremiumPackage[] {
  const price = (env: string | undefined, fallback: number) => {
    const n = Number(env);
    return Number.isInteger(n) && n >= 1000 ? n : fallback;
  };
  return [
    { id: '1m', label: '1 mes', days: 30, priceCop: price(process.env.PREMIUM_PRICE_1M, 15000) },
    { id: '3m', label: '3 meses', days: 90, priceCop: price(process.env.PREMIUM_PRICE_3M, 40000) },
    { id: '12m', label: '12 meses', days: 365, priceCop: price(process.env.PREMIUM_PRICE_12M, 150000) },
  ];
}

/** SKU de la suscripción Premium de servidor (Developer Portal > Monetización), o null si no hay o no es válido. */
export function premiumSkuId(): string | null {
  const sku = process.env.PREMIUM_SKU_ID;
  return sku && /^\d{15,25}$/.test(sku) ? sku : null;
}

/** Límites del plan efectivo del servidor. */
export function getLimits(config: GuildConfig): PlanLimits {
  return PLAN_LIMITS[getEffectiveTier(config)];
}

/** Mensaje que se muestra al intentar usar una función Premium en plan gratis. */
export const PREMIUM_UPSELL = '💎 Esta función es **Premium**. Usa `/plan` para ver qué incluye.';

const FREE_MOTTO = 'ARMEN PARTY • ANÓTENSE EN SU ROL';
const FREE_EMBED_HEX = 0xd4af37;

/**
 * Copia de la config para dibujar pings: en plan gratis se ignoran las siglas, el lema, el color y
 * el logo personalizados. El nombre del servidor se muestra en ambos planes. No modifica la config.
 */
export function brandForRender(config: GuildConfig): GuildConfig {
  if (getLimits(config).customBranding) return config;
  return {
    ...config,
    guildTag: '',
    motto: FREE_MOTTO,
    customLogo: false, // En gratis se usa el icono del servidor.
    colors: { ...config.colors, embedHex: FREE_EMBED_HEX },
  };
}
