import { escapeMarkdown } from 'discord.js';

/**
 * Utilidades de seguridad para un bot público:
 * - limpiar texto escrito por usuarios antes de mostrarlo en embeds
 * - límites de frecuencia (cooldowns) contra spam
 */

/**
 * Texto libre de Callers/admins (título, lugar de masa, notas...):
 * - Desactiva los enlaces enmascarados [texto](url), que en un embed esconden la URL real
 *   (típico de phishing): se muestran como "texto (url)".
 * - Quita caracteres invisibles que se usan para camuflar texto.
 * - Recorta al largo máximo.
 */
export function cleanUserText(raw: string, max: number): string {
  return raw
    .replace(/[​-‏‪-‮⁠-⁤﻿]/g, '')
    .replace(/\[([^\]]*)\]\(\s*<?([^)>\s]*)>?\s*\)/g, '$1 ($2)')
    .trim()
    .slice(0, max);
}

/** Texto corto de cualquier jugador (arma/IP): además se escapa el formato de Discord. */
export function cleanPlayerText(raw: string, max: number): string {
  return escapeMarkdown(cleanUserText(raw, max));
}

// ---------- Cooldowns ----------

const cooldowns = new Map<string, number>();

/**
 * Devuelve los segundos que faltan si la acción está en enfriamiento, o 0 si puede hacerse
 * (y en ese caso la registra).
 */
export function takeCooldown(key: string, ms: number): number {
  const now = Date.now();
  const until = cooldowns.get(key) ?? 0;
  if (until > now) return Math.ceil((until - now) / 1000);
  cooldowns.set(key, now + ms);
  if (cooldowns.size > 20000) {
    for (const [k, v] of cooldowns) if (v <= now) cooldowns.delete(k);
  }
  return 0;
}

export const COOLDOWNS = {
  /** Publicar un ping (cada uno puede mencionar a un rol entero) */
  publishPing: 60_000,
  /** Anotarse / cambiar de rol / bajarse (cada clic regenera la imagen del ping) */
  rosterAction: 1_500,
  /** "¡A voz!" menciona a toda la party */
  notifyVoice: 60_000,
};

/** Libera un enfriamiento (p. ej. si la acción falló y no llegó a hacerse). */
export function clearCooldown(key: string): void {
  cooldowns.delete(key);
}
