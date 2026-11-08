import catalog from './itemCatalog.json';

/**
 * Catálogo de ítems de Albion (nombres oficiales ES) para las builds por rol.
 * Se genera con scripts/buildItemCatalog.ts.
 */

export type ItemSlot = 'weapon' | 'offhand' | 'head' | 'armor' | 'shoes' | 'cape' | 'mount' | 'food' | 'potion';

export interface CatalogItem {
  id: string; // Equipo sin tier (MAIN_MACE_HELL); monturas y consumibles con tier (T8_MEAL_STEW)
  slot: ItemSlot;
  name: string; // Nombre oficial ES
  en: string; // Nombre EN (para buscar también en inglés)
  icon: string; // Id para el servicio de iconos oficial
  tier?: number;
}

/** Orden y nombres de los huecos de una build, como en el juego. */
export const BUILD_SLOTS: Array<{ slot: ItemSlot; label: string; short: string; emoji: string }> = [
  { slot: 'weapon', label: 'Arma', short: 'Arma', emoji: '⚔️' },
  { slot: 'offhand', label: 'Mano secundaria', short: 'Secund.', emoji: '🛡️' },
  { slot: 'head', label: 'Cabeza', short: 'Cabeza', emoji: '🪖' },
  { slot: 'armor', label: 'Armadura', short: 'Armadura', emoji: '🥋' },
  { slot: 'shoes', label: 'Botas', short: 'Botas', emoji: '👢' },
  { slot: 'cape', label: 'Capa', short: 'Capa', emoji: '🧣' },
  { slot: 'food', label: 'Comida', short: 'Comida', emoji: '🍲' },
  { slot: 'potion', label: 'Poción', short: 'Poción', emoji: '🧪' },
  { slot: 'mount', label: 'Montura', short: 'Montura', emoji: '🐎' },
];

const ITEMS = catalog as CatalogItem[];
const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

export function getItem(id: string | undefined): CatalogItem | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** ¿Es un arma a dos manos? (entonces la mano secundaria no aplica) */
export function isTwoHanded(id: string | undefined): boolean {
  return Boolean(id && id.startsWith('2H_'));
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Busca por nombre en español o inglés (sin tildes), opcionalmente en un hueco concreto. */
export function searchItems(query: string, slot?: ItemSlot, limit = 30): CatalogItem[] {
  const q = norm(query.trim());
  const pool = slot ? ITEMS.filter((i) => i.slot === slot) : ITEMS;
  if (!q) return pool.slice(0, limit);
  const starts: CatalogItem[] = [];
  const contains: CatalogItem[] = [];
  for (const i of pool) {
    const es = norm(i.name);
    const en = norm(i.en);
    if (es.startsWith(q) || en.startsWith(q)) starts.push(i);
    else if (es.includes(q) || en.includes(q)) contains.push(i);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

/** URL del icono oficial (servicio de render de Albion Online). */
export function itemIconUrl(item: CatalogItem, size = 128): string {
  return `https://render.albiononline.com/v1/item/${encodeURIComponent(item.icon)}.png?size=${size}`;
}

export function allItems(): readonly CatalogItem[] {
  return ITEMS;
}
