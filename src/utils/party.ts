/**
 * Tamaño de la party y cupos. Una compo puede tener roles sin límite (p. ej. cinco armas de daño a
 * elegir) y aun así una party de tamaño fijo: para eso está `partySize`.
 */
import type { ActivePing, RoleTemplate } from '../types/ping';

/** Tamaño máximo de party que se puede configurar. */
export const MAX_PARTY_SIZE = 100;

/** Normaliza el tamaño de party guardado. undefined significa sin tamaño fijo. */
export function cleanPartySize(n: unknown): number | undefined {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= MAX_PARTY_SIZE ? n : undefined;
}

/**
 * Máximo de la party: el tamaño fijo si lo hay; si no, la suma de cupos cuando todos los roles
 * tienen límite; si algún rol es ilimitado y no hay tamaño fijo, null (no hay máximo).
 */
export function partyMax(roles: RoleTemplate[], partySize?: number): number | null {
  const fixed = cleanPartySize(partySize);
  if (fixed) return fixed;
  if (roles.length === 0 || roles.some((r) => r.maxSlots <= 0)) return null;
  return roles.reduce((acc, r) => acc + r.maxSlots, 0);
}

/** Jugadores anotados en algún rol (sin contar banca ni ausentes). */
export function partyJoined(ping: Pick<ActivePing, 'roster'>): number {
  return Object.values(ping.roster).reduce((acc, list) => acc + list.length, 0);
}

/** La party ya tiene a todos los que caben según su tamaño fijo. */
export function isPartyFull(ping: Pick<ActivePing, 'roster' | 'partySize'>): boolean {
  const size = cleanPartySize(ping.partySize);
  return Boolean(size && partyJoined(ping) >= size);
}

/** Quien elija este rol ahora va a banca: el rol está lleno o la party ya está completa. */
export function joinGoesToBench(ping: Pick<ActivePing, 'roster' | 'partySize'>, role: RoleTemplate): boolean {
  const inRole = (ping.roster[role.id] ?? []).length;
  return (role.maxSlots > 0 && inRole >= role.maxSlots) || isPartyFull(ping);
}

/** Recuento para mostrar: "1/7", "3/12", o solo "5" si no hay máximo. */
export function partyCountLabel(ping: Pick<ActivePing, 'roster' | 'roles' | 'partySize'>, sep = '/'): string {
  const max = partyMax(ping.roles, ping.partySize);
  const joined = partyJoined(ping);
  return max ? `${joined}${sep}${max}` : `${joined}`;
}
