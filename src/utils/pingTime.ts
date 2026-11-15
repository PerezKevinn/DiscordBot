/**
 * Hora de salida de los pings. Se elige una hora fija en UTC, que es la hora del juego, en vez de
 * "dentro de X minutos".
 */

/** Paso de los minutos en el selector de hora. */
export const MINUTE_STEP = 5;

/** Hora del día en UTC. */
export interface UtcSlot {
  /** 0-23. */
  hour: number;
  /** 0-55, múltiplo de MINUTE_STEP. */
  minute: number;
}

/** Formato para mostrar: "20:05 UTC". */
export function formatUtc(slot: UtcSlot): string {
  return `${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')} UTC`;
}

/** Próxima vez que el reloj UTC marque esa hora: hoy si aún no ha pasado, si no mañana. */
export function nextUtcStartUnix(slot: UtcSlot, nowMs = Date.now()): number {
  const now = new Date(nowMs);
  let start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), slot.hour, slot.minute);
  if (start <= nowMs) start += 24 * 60 * 60 * 1000;
  return Math.floor(start / 1000);
}

/** Hora propuesta al abrir el asistente: dentro de ~15 min, redondeada a los 5 min siguientes. */
export function defaultUtcSlot(nowMs = Date.now()): UtcSlot {
  const stepMs = MINUTE_STEP * 60 * 1000;
  const d = new Date(Math.ceil((nowMs + 15 * 60 * 1000) / stepMs) * stepMs);
  return { hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}

/** Hora del borrador, o la propuesta por defecto si aún no eligió ninguna. */
export function draftSlot(draft: { utcHour?: number; utcMinute?: number }): UtcSlot {
  if (draft.utcHour === undefined || draft.utcMinute === undefined) return defaultUtcSlot();
  return { hour: draft.utcHour, minute: draft.utcMinute };
}
