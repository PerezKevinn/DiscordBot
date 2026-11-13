import type { Content } from './types';

/**
 * Borradores de contenidos en el navegador (localStorage): si la sesión caduca, se recarga la
 * página o se cierra la pestaña, los cambios sin guardar se pueden recuperar. Nunca salen del
 * navegador. Todo va en try/catch: en modo privado o sin almacenamiento simplemente no hay borrador.
 */

export interface ContentDraft {
  savedAt: number;
  content: Content;
}

const PREFIX = 'massup:draft:';
/** Un borrador viejo ya no sirve para nada */
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
/** Contenido que se estaba editando, para reabrirlo al volver de iniciar sesión o recargar */
const REOPEN_KEY = 'massup_reopen_content';

const key = (guildId: string, contentId: string) => `${PREFIX}${guildId}:${contentId || 'nuevo'}`;

export function readDraft(guildId: string, contentId: string): ContentDraft | null {
  try {
    const raw = localStorage.getItem(key(guildId, contentId));
    if (!raw) return null;
    const d = JSON.parse(raw) as ContentDraft;
    if (!d?.content || typeof d.savedAt !== 'number' || Date.now() - d.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(key(guildId, contentId));
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

export function writeDraft(guildId: string, contentId: string, content: Content) {
  try {
    localStorage.setItem(key(guildId, contentId), JSON.stringify({ savedAt: Date.now(), content } satisfies ContentDraft));
  } catch {
    /* sin almacenamiento: no hay borrador */
  }
}

export function clearDraft(guildId: string, contentId: string) {
  try {
    localStorage.removeItem(key(guildId, contentId));
  } catch {
    /* nada */
  }
}

export function setReopen(guildId: string, contentId: string | null) {
  try {
    if (contentId === null) sessionStorage.removeItem(REOPEN_KEY);
    else sessionStorage.setItem(REOPEN_KEY, JSON.stringify({ guildId, contentId }));
  } catch {
    /* nada */
  }
}

/** Devuelve (y olvida) el contenido que se estaba editando en este servidor, si lo hay. */
export function takeReopen(guildId: string): string | null {
  try {
    const raw = sessionStorage.getItem(REOPEN_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(REOPEN_KEY);
    const r = JSON.parse(raw) as { guildId: string; contentId: string };
    return r.guildId === guildId ? r.contentId : null;
  } catch {
    return null;
  }
}

/** "hace 20 min", "hace 3 h", "hace 2 días" */
export function ago(ms: number): string {
  const min = Math.max(1, Math.round((Date.now() - ms) / 60000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}
