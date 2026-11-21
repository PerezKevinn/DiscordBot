/**
 * Lector del archivo que genera AO Loot Logger (github.com/matheussampaio/ao-loot-logger), un
 * programa que el jugador ejecuta en su PC y que anota todo lo que se recoge de las bolsas de loot.
 * MassUp no ejecuta nada: solo lee el archivo que sube el Caller.
 *
 * Formato (separado por punto y coma, una línea por evento, con cabecera):
 *   timestamp_utc;looted_by__alliance;looted_by__guild;looted_by__name;item_id;item_name;quantity;
 *   looted_from__alliance;looted_from__guild;looted_from__name
 */
import { LootLogSummary } from './loot';

/** Un ítem recogido. */
export interface LootEvent {
  at: number;
  looter: string;
  looterGuild: string;
  itemId: string;
  itemName: string;
  qty: number;
  from: string;
}

/** Tamaño máximo del archivo que se acepta. */
export const MAX_LOG_BYTES = 5 * 1024 * 1024;
/** Ítems distintos que se guardan por jugador. */
export const MAX_ITEMS_PER_LOOTER = 40;

const COLS = ['timestamp_utc', 'looted_by__alliance', 'looted_by__guild', 'looted_by__name', 'item_id', 'item_name', 'quantity', 'looted_from__alliance', 'looted_from__guild', 'looted_from__name'];

/**
 * Lee el texto del log. Acepta la cabecera en cualquier orden (y separada por ; , o tabulador) o,
 * sin cabecera, el orden de AO Loot Logger. Las líneas que no se entienden se cuentan en `skipped`.
 */
export function parseLootLog(text: string): { events: LootEvent[]; skipped: number } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { events: [], skipped: 0 };
  const sep = [';', '\t', ','].find((d) => lines[0].includes(d)) ?? ';';
  const head = lines[0].split(sep).map((c) => c.trim().toLowerCase());
  const hasHeader = head.includes('looted_by__name') && head.includes('item_id');
  const idx = (name: string) => (hasHeader ? head.indexOf(name) : COLS.indexOf(name));
  const col = Object.fromEntries(COLS.map((c) => [c, idx(c)])) as Record<string, number>;

  const events: LootEvent[] = [];
  let skipped = 0;
  for (const line of hasHeader ? lines.slice(1) : lines) {
    const f = line.split(sep).map((c) => c.trim());
    const get = (name: string) => (col[name] >= 0 ? f[col[name]] ?? '' : '');
    const at = Date.parse(get('timestamp_utc'));
    const looter = get('looted_by__name');
    const itemId = get('item_id');
    const qty = Number(get('quantity') || '1');
    if (!Number.isFinite(at) || !looter || !itemId || !Number.isInteger(qty) || qty <= 0 || qty > 1_000_000) {
      skipped++;
      continue;
    }
    events.push({
      at,
      looter: looter.slice(0, 32),
      looterGuild: get('looted_by__guild').slice(0, 64),
      itemId: itemId.slice(0, 80),
      itemName: get('item_name').slice(0, 80),
      qty,
      from: get('looted_from__name').slice(0, 32),
    });
  }
  return { events, skipped };
}

/**
 * Nombre legible de un ítem: el del log con su tier y encantamiento, p. ej. "Espadón · 6.2".
 * Si el log no trae nombre, se usa el id.
 */
export function itemLabel(itemId: string, itemName: string): string {
  const m = itemId.match(/^T(\d)_.*?(?:@(\d))?$/);
  const tier = m ? `${m[1]}.${m[2] ?? '0'}` : '';
  const name = itemName && itemName !== itemId ? itemName : itemId;
  return tier ? `${name} · ${tier}` : name;
}

/** Normaliza un nombre para compararlo: sin siglas entre corchetes, sin símbolos y en minúsculas. */
export function normName(s: string): string {
  return s
    .replace(/[[(【].*?[\])】]/g, '')
    .normalize('NFD')
    .replace(/[^A-Za-z0-9]/g, '')
    .toLowerCase();
}

/**
 * Resume el log para una salida: se queda con los eventos dentro de la ventana [from, to] (si no hay
 * ninguno, con todos) y agrupa por jugador. `isParty(nombre)` dice si un personaje es de la party;
 * los demás (enemigos u otros grupos) solo se cuentan.
 */
export function summarizeLog(
  events: LootEvent[],
  fileName: string,
  window: { from: number; to: number } | null,
  isParty: (name: string) => boolean
): LootLogSummary {
  let used = window ? events.filter((e) => e.at >= window.from && e.at <= window.to) : events;
  const outsideWindow = Boolean(window) && used.length === 0 && events.length > 0;
  if (outsideWindow) used = events;

  const byLooter = new Map<string, { name: string; count: number; items: Map<string, number> }>();
  let othersEvents = 0;
  for (const e of used) {
    if (!isParty(e.looter)) {
      othersEvents++;
      continue;
    }
    const key = normName(e.looter) || e.looter;
    const l = byLooter.get(key) ?? { name: e.looter, count: 0, items: new Map() };
    l.count += e.qty;
    const label = itemLabel(e.itemId, e.itemName);
    l.items.set(label, (l.items.get(label) ?? 0) + e.qty);
    byLooter.set(key, l);
  }
  const looters = [...byLooter.values()]
    .sort((a, b) => b.count - a.count)
    .map((l) => ({
      name: l.name,
      count: l.count,
      items: [...l.items]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, MAX_ITEMS_PER_LOOTER)
        .map(([name, qty]) => ({ name, qty })),
    }));
  return { fileName: fileName.slice(0, 100), events: used.length - othersEvents, outsideWindow, looters, othersEvents };
}

/**
 * Gremio de la party: el gremio que más se repite entre los jugadores que ya se reconocieron como de
 * la party. Sirve para no contar como "nuestro" el loot de los enemigos.
 */
export function partyGuild(events: LootEvent[], known: (name: string) => boolean): string | null {
  const counts = new Map<string, number>();
  for (const e of events) if (e.looterGuild && known(e.looter)) counts.set(e.looterGuild, (counts.get(e.looterGuild) ?? 0) + 1);
  let best: string | null = null;
  let max = 0;
  for (const [g, n] of counts) if (n > max) [best, max] = [g, n];
  return best;
}
