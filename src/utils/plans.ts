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

/** Plan efectivo del servidor (premium vencido = free). */
export function getEffectiveTier(config: GuildConfig): PlanTier {
  if (config.plan !== 'premium') return 'free';
  if (config.premiumUntil && config.premiumUntil < Date.now()) return 'free';
  return 'premium';
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
