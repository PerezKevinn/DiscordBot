/**
 * Catálogo de ítems de Albion Online, con los nombres oficiales en español, para las builds por rol.
 * itemCatalog.json se genera con scripts/buildItemCatalog.ts (npm run items:update).
 */
import catalog from './itemCatalog.json';

/** Hueco de equipo de una build. */
export type ItemSlot = 'weapon' | 'offhand' | 'head' | 'armor' | 'shoes' | 'cape' | 'mount' | 'food' | 'potion';

/** Ítem del catálogo. */
export interface CatalogItem {
  /** Sin tier para el equipo (MAIN_MACE_HELL); con tier para monturas y consumibles (T8_MEAL_STEW). */
  id: string;
  slot: ItemSlot;
  /** Nombre oficial en español. */
  name: string;
  /** Nombre en inglés, para poder buscar también en inglés. */
  en: string;
  /** Id para el servicio oficial de iconos. */
  icon: string;
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

/** Busca un ítem por id. */
export function getItem(id: string | undefined): CatalogItem | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** Indica si es un arma a dos manos, en cuyo caso no hay mano secundaria. */
export function isTwoHanded(id: string | undefined): boolean {
  return Boolean(id && id.startsWith('2H_'));
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * Busca por nombre en español o inglés, sin distinguir tildes ni mayúsculas, opcionalmente en un
 * solo hueco. Primero van los que empiezan por el texto buscado y después los que lo contienen.
 */
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

/** Catálogo completo (lo descarga el panel una vez para su buscador). */
export function allItems(): readonly CatalogItem[] {
  return ITEMS;
}
