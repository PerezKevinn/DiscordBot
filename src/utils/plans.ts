import { GuildConfig, PlanTier } from '../types/ping';

/**
 * Límites y funciones por plan. Para mover algo de gratis a premium (o al revés),
 * se cambia aquí y nada más.
 */
export interface PlanLimits {
  maxActivePings: number; // Pings abiertos/en ruta a la vez por servidor
  maxContentTypes: number; // Plantillas de contenido por servidor (Discord permite 25 en un menú)
  customBranding: boolean; // Nombre, siglas, lema y color propios en banner/embeds
  hideBotFooter: boolean; // Quitar el "Creado con <bot>" de los pings
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    maxActivePings: 3,
    maxContentTypes: 12,
    customBranding: false,
    hideBotFooter: false,
  },
  premium: {
    maxActivePings: 25,
    maxContentTypes: 25,
    customBranding: true,
    hideBotFooter: true,
  },
};

/** Nombre público del bot (se lee en cada llamada porque dotenv carga después de los imports). */
export function botBrandName(): string {
  return process.env.BOT_BRAND_NAME || 'MassUp';
}

/** Suscripción de Discord vigente. */
export function hasActiveSubscription(config: GuildConfig, now = Date.now()): boolean {
  const s = config.subscription;
  return Boolean(s?.active && (!s.endsAt || s.endsAt > now));
}

/** Premium por tiempo (manual o código) vigente. */
export function hasTimedPremium(config: GuildConfig, now = Date.now()): boolean {
  return config.plan === 'premium' && (!config.premiumUntil || config.premiumUntil > now);
}

/** Plan efectivo del servidor: Premium si lo da la suscripción o el tiempo concedido. */
export function getEffectiveTier(config: GuildConfig, now = Date.now()): PlanTier {
  return hasActiveSubscription(config, now) || hasTimedPremium(config, now) ? 'premium' : 'free';
}

/**
 * Cuándo deja de ser Premium: null = no vence (de por vida o suscripción que se renueva),
 * undefined = ya es gratis.
 */
export function premiumEndsAt(config: GuildConfig, now = Date.now()): number | null | undefined {
  const ends: Array<number | null> = [];
  if (hasActiveSubscription(config, now)) ends.push(config.subscription!.endsAt ?? null);
  if (hasTimedPremium(config, now)) ends.push(config.premiumUntil ?? null);
  if (ends.length === 0) return undefined;
  if (ends.includes(null)) return null;
  return Math.max(...(ends as number[]));
}

/** Enlace a la tienda de Discord para comprar Premium (o null si no hay SKU configurado). */
export function premiumStoreUrl(): string | null {
  const sku = premiumSkuId();
  const app = process.env.CLIENT_ID;
  return sku && app ? `https://discord.com/application-directory/${app}/store/${sku}` : null;
}

/** SKU de la suscripción Premium de servidor (Developer Portal -> Monetización). */
export function premiumSkuId(): string | null {
  const sku = process.env.PREMIUM_SKU_ID;
  return sku && /^\d{15,25}$/.test(sku) ? sku : null;
}

export function getLimits(config: GuildConfig): PlanLimits {
  return PLAN_LIMITS[getEffectiveTier(config)];
}

export const PREMIUM_UPSELL = '💎 Esta función es **Premium**. Usa `/plan` para ver qué incluye.';

const FREE_MOTTO = 'ARMEN PARTY • ANÓTENSE EN SU ROL';
const FREE_EMBED_HEX = 0xd4af37;

/**
 * Config "visual" para pintar pings: en plan gratis se ignoran siglas, lema y color personalizados.
 * El nombre del servidor sí se muestra en ambos planes.
 */
export function brandForRender(config: GuildConfig): GuildConfig {
  if (getLimits(config).customBranding) return config;
  return {
    ...config,
    guildTag: '',
    motto: FREE_MOTTO,
    customLogo: false, // en gratis se usa el icono del servidor
    colors: { ...config.colors, embedHex: FREE_EMBED_HEX },
  };
}
