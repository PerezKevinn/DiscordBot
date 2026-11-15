/**
 * Utilidades de seguridad para un bot público: limpieza del texto que escriben los usuarios antes
 * de mostrarlo en embeds y límites de frecuencia (cooldowns) contra el spam.
 */
import { escapeMarkdown } from 'discord.js';

/**
 * Limpia texto libre de Callers y admins (título, lugar de masa, notas…):
 * - Desactiva los enlaces enmascarados [texto](url), que en un embed esconden la URL real (típico
 *   del phishing): se muestran como "texto (url)".
 * - Quita los caracteres invisibles que se usan para camuflar texto.
 * - Recorta al largo máximo.
 */
export function cleanUserText(raw: string, max: number): string {
  return raw
    .replace(/[​-‏‪-‮⁠-⁤﻿]/g, '')
    .replace(/\[([^\]]*)\]\(\s*<?([^)>\s]*)>?\s*\)/g, '$1 ($2)')
    .trim()
    .slice(0, max);
}

/** Limpia texto corto de cualquier jugador (arma, IP); además escapa el formato de Discord. */
export function cleanPlayerText(raw: string, max: number): string {
  return escapeMarkdown(cleanUserText(raw, max));
}

// ---------- Cooldowns ----------

const cooldowns = new Map<string, number>();

/**
 * Devuelve los segundos que faltan si la acción está en enfriamiento, o 0 si puede hacerse; en ese
 * caso la registra. Las entradas vencidas se purgan cuando el mapa pasa de 20 000.
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

/** Enfriamiento de cada acción, en ms. */
export const COOLDOWNS = {
  /** Publicar un ping: cada uno puede mencionar a un rol entero. */
  publishPing: 60_000,
  /** Anotarse, cambiar de rol o bajarse: cada clic regenera la imagen del ping. */
  rosterAction: 1_500,
  /** "¡A voz!" menciona a toda la party. */
  notifyVoice: 60_000,
};

/** Libera un enfriamiento, p. ej. si la acción falló y no llegó a hacerse. */
export function clearCooldown(key: string): void {
  cooldowns.delete(key);
}
