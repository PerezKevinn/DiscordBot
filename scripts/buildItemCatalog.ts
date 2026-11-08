/**
 * Genera src/data/itemCatalog.json: catálogo compacto de equipo, monturas y consumibles de
 * Albion Online con los nombres OFICIALES en español (ES-ES), a partir del volcado público
 * ao-data/ao-bin-dumps (formatted/items.json).
 *
 * Uso:
 *   npx tsx scripts/buildItemCatalog.ts                  -> descarga el volcado
 *   npx tsx scripts/buildItemCatalog.ts ruta/items.json  -> usa un archivo local
 *
 * Vuelve a ejecutarlo cuando el juego añada armas o equipo nuevo.
 */
import fs from 'fs';
import path from 'path';

const SOURCE = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json';
const OUT = path.join(__dirname, '..', 'src', 'data', 'itemCatalog.json');

export type ItemSlot = 'weapon' | 'offhand' | 'head' | 'armor' | 'shoes' | 'cape' | 'mount' | 'food' | 'potion';

interface RawItem {
  UniqueName?: string;
  LocalizedNames?: Record<string, string> | null;
}

/** Equipo: se guarda sin tier (la build vale para cualquier tier); el icono se pide en T8. */
const GEAR: Array<[ItemSlot, RegExp]> = [
  ['weapon', /^T8_((MAIN|2H)_[A-Z0-9_]+)$/],
  ['offhand', /^T8_(OFF_[A-Z0-9_]+)$/],
  ['head', /^T8_(HEAD_[A-Z0-9_]+)$/],
  ['armor', /^T8_(ARMOR_[A-Z0-9_]+)$/],
  ['shoes', /^T8_(SHOES_[A-Z0-9_]+)$/],
  ['cape', /^T8_(CAPE[A-Z0-9_]*)$/],
];
/** Monturas y consumibles: el tier sí importa (Guiso T8 ≠ Guiso T6), se guarda el id completo. */
const TIERED: Array<[ItemSlot, RegExp]> = [
  ['mount', /^T([3-8])_(MOUNT_[A-Z0-9_]+)(@\d)?$/], // la Garrapresta es T5_MOUNT_COUGAR_KEEPER@1
  ['food', /^T([1-8])_(MEAL_[A-Z0-9_]+)$/],
  ['potion', /^T([1-8])_(POTION_[A-Z0-9_]+)$/],
];

const ELDER = /\s+del?\s+anciano$/i;

async function main() {
  const local = process.argv[2];
  const raw: RawItem[] = local
    ? JSON.parse(fs.readFileSync(local, 'utf8'))
    : await (await fetch(SOURCE)).json();

  const out: Array<{ id: string; slot: ItemSlot; name: string; en: string; icon: string; tier?: number }> = [];
  const seen = new Set<string>();

  for (const it of raw) {
    const u = it.UniqueName ?? '';
    const es = it.LocalizedNames?.['ES-ES'];
    const en = it.LocalizedNames?.['EN-US'];
    if (!u || !es || !en) continue;
    if (u.includes('@') && !/_MOUNT_/.test(u)) continue; // encantamientos: solo monturas especiales
    if (/SKIN|_UNIQUE|VANITY|TOKEN|_TRASH|_NONTRADABLE|_TELLAFRIEND/.test(u)) continue;

    for (const [slot, re] of GEAR) {
      const m = u.match(re);
      if (m && !seen.has(m[1])) {
        seen.add(m[1]);
        out.push({ id: m[1], slot, name: es.replace(ELDER, ''), en: en.replace(/^Elder's\s+/, ''), icon: u });
      }
    }
    for (const [slot, re] of TIERED) {
      const m = u.match(re);
      if (m && !seen.has(u)) {
        seen.add(u);
        out.push({ id: u, slot, name: es.replace(ELDER, ''), en: en.replace(/^Elder's\s+/, ''), icon: u, tier: Number(m[1]) });
      }
    }
  }

  out.sort((a, b) => a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name, 'es') || (b.tier ?? 0) - (a.tier ?? 0));
  fs.writeFileSync(OUT, JSON.stringify(out));
  const bySlot = out.reduce<Record<string, number>>((acc, i) => ((acc[i.slot] = (acc[i.slot] ?? 0) + 1), acc), {});
  console.log(`✅ ${out.length} ítems -> ${OUT}`, bySlot);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
