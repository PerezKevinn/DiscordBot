import fs from 'fs';
import { FONT_STACK } from './fonts';
import path from 'path';
import { createCanvas, Image, loadImage, SKRSContext2D } from '@napi-rs/canvas';
import { BUILD_SLOTS, getItem, isTwoHanded, itemIconUrl } from '../data/items';
import { RoleBuild, RoleTemplate } from '../types/ping';
import { splitRoleLabel } from './ui';

/**
 * Tarjeta de builds de una party: una fila por rol con los iconos oficiales de cada hueco.
 * Los iconos se descargan del servicio oficial de Albion y se guardan en data/cache/icons.
 */

const ICON_DIR = path.join(process.cwd(), 'data', 'cache', 'icons');
const ICON_HOST = 'render.albiononline.com';
const memory = new Map<string, Image>();

async function getIcon(itemId: string): Promise<Image | null> {
  const item = getItem(itemId);
  if (!item) return null;
  const hit = memory.get(item.icon);
  if (hit) return hit;

  const safe = item.icon.replace(/[^A-Z0-9_@]/gi, '_');
  const file = path.join(ICON_DIR, `${safe}.png`);
  try {
    let buf: Buffer;
    if (fs.existsSync(file)) {
      buf = fs.readFileSync(file);
    } else {
      const url = new URL(itemIconUrl(item, 128));
      if (url.hostname !== ICON_HOST) return null;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) return null;
      buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 512 * 1024) return null;
      fs.mkdirSync(ICON_DIR, { recursive: true });
      fs.writeFileSync(file, buf);
    }
    const img = await loadImage(buf);
    if (memory.size > 600) memory.delete(memory.keys().next().value as string);
    memory.set(item.icon, img);
    return img;
  } catch {
    return null;
  }
}

const hasItems = (b?: RoleBuild) => Boolean(b && Object.values(b).some(Boolean));

export function hasAnyBuild(roles: RoleTemplate[]): boolean {
  return roles.some((r) => hasItems(r.build) || (r.swaps ?? []).some((s) => hasItems(s.build)));
}

/** Filas de la tarjeta: la build de cada rol y, debajo, sus swaps. */
type CardRow =
  | { kind: 'main'; role: RoleTemplate; build: RoleBuild }
  | { kind: 'swap'; label: string; build: RoleBuild; base: RoleBuild };

const MAX_ROWS = 24;

function truncate(ctx: SKRSContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

/** Genera la tarjeta PNG o null si ningún rol tiene build. */
export async function generateBuildCard(title: string, roles: RoleTemplate[]): Promise<Buffer | null> {
  const rows: CardRow[] = [];
  for (const role of roles) {
    const swaps = (role.swaps ?? []).filter((s) => hasItems(s.build));
    if (!hasItems(role.build) && swaps.length === 0) continue;
    rows.push({ kind: 'main', role, build: role.build ?? {} });
    for (const s of swaps) rows.push({ kind: 'swap', label: s.label, build: s.build, base: role.build ?? {} });
  }
  if (rows.length === 0) return null;
  // No partir un rol de sus swaps al recortar
  while (rows.length > MAX_ROWS) {
    const lastMain = rows.map((r) => r.kind).lastIndexOf('main');
    rows.splice(lastMain > 0 ? lastMain : MAX_ROWS);
  }

  const ICON = 64;
  const GAP = 8;
  const NAME_W = 210;
  const PAD = 24;
  const HEADER = 64;
  const ROW = ICON + 30;
  const SWAP_ROW = ICON + 12;
  // Un rol seguido de sus swaps va más pegado a ellos; entre roles queda el espacio normal
  const rowHeight = (i: number) =>
    rows[i].kind === 'swap' ? (rows[i + 1]?.kind === 'swap' ? SWAP_ROW : ROW - 8) : rows[i + 1]?.kind === 'swap' ? SWAP_ROW : ROW;
  const width = PAD * 2 + NAME_W + BUILD_SLOTS.length * (ICON + GAP);
  const height = HEADER + rows.reduce((h, _r, i) => h + rowHeight(i), 0) + PAD;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Fondo y marco en el estilo de MassUp
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#08080b');
  bg.addColorStop(1, '#14141a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(212,175,55,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, width - 12, height - 12);

  ctx.font = `bold 22px ${FONT_STACK}`;
  ctx.fillStyle = '#D4AF37';
  ctx.textBaseline = 'middle';
  ctx.fillText(truncate(ctx, `BUILDS · ${title.toUpperCase()}`, width - PAD * 2), PAD, 36);

  // Cabecera de huecos
  ctx.font = `11px ${FONT_STACK}`;
  ctx.fillStyle = '#8f8a7e';
  ctx.textAlign = 'center';
  BUILD_SLOTS.forEach((s, i) => {
    const x = PAD + NAME_W + i * (ICON + GAP) + ICON / 2;
    ctx.fillText(s.short.toUpperCase(), x, HEADER - 6);
  });
  ctx.textAlign = 'left';

  // Precarga de iconos en paralelo
  const ids = new Set<string>();
  for (const r of rows) {
    for (const id of Object.values(r.build)) if (id) ids.add(id);
    if (r.kind === 'swap' && r.base.weapon) ids.add(r.base.weapon);
  }
  const icons = new Map<string, Image | null>();
  await Promise.all([...ids].map(async (id) => icons.set(id, await getIcon(id))));

  let y = HEADER + 8;
  let band = 0;
  for (const [index, row] of rows.entries()) {
    const rowH = rowHeight(index);
    if (row.kind === 'main') band++;
    // Mismo fondo para un rol y sus swaps, alternando entre roles
    if (band % 2 === 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.fillRect(PAD - 8, y - 6, width - PAD * 2 + 16, rowH);
    }

    if (row.kind === 'main') {
      const { name } = splitRoleLabel(row.role.label);
      ctx.font = `bold 17px ${FONT_STACK}`;
      ctx.fillStyle = '#F2EEE3';
      ctx.fillText(truncate(ctx, name, NAME_W - 16), PAD, y + ICON / 2 - 8);
      ctx.font = `13px ${FONT_STACK}`;
      ctx.fillStyle = '#a39e92';
      ctx.fillText(row.role.maxSlots > 0 ? `${row.role.maxSlots} ${row.role.maxSlots === 1 ? 'cupo' : 'cupos'}` : 'sin límite', PAD, y + ICON / 2 + 14);
    } else {
      ctx.font = `bold 12px ${FONT_STACK}`;
      ctx.fillStyle = '#8f8a7e';
      ctx.fillText('SWAP', PAD + 12, y + ICON / 2 - 9);
      ctx.font = `bold 16px ${FONT_STACK}`;
      ctx.fillStyle = '#D4AF37';
      ctx.fillText(truncate(ctx, row.label.toUpperCase(), NAME_W - 28), PAD + 12, y + ICON / 2 + 10);
    }

    // En un swap, el arma que manda es la del swap si la cambia; si no, la de la build
    const weapon = row.build.weapon ?? (row.kind === 'swap' ? row.base.weapon : undefined);
    BUILD_SLOTS.forEach((s, i) => {
      const x = PAD + NAME_W + i * (ICON + GAP);
      const id = row.build[s.slot];
      const changed = row.kind === 'swap' && Boolean(id);
      ctx.fillStyle = row.kind === 'swap' && !id ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.04)';
      ctx.fillRect(x, y, ICON, ICON);
      ctx.strokeStyle = changed ? 'rgba(212,175,55,0.75)' : row.kind === 'swap' ? 'rgba(212,175,55,0.08)' : 'rgba(212,175,55,0.18)';
      ctx.lineWidth = changed ? 2 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, ICON - 1, ICON - 1);

      if (s.slot === 'offhand' && isTwoHanded(weapon) && (row.kind === 'main' || row.build.weapon)) {
        // Arma a dos manos: se muestra en gris como en el juego
        const img = icons.get(weapon ?? '');
        if (img) {
          ctx.globalAlpha = 0.25;
          ctx.drawImage(img, x, y, ICON, ICON);
          ctx.globalAlpha = 1;
        }
        return;
      }
      // En un swap solo se dibuja lo que cambia: lo demás se queda como en la build de arriba
      const img = id ? icons.get(id) : null;
      if (img) ctx.drawImage(img, x, y, ICON, ICON);
    });

    y += rowH;
  }

  return canvas.toBuffer('image/png');
}

/** Resumen en texto de una build (para embeds): "Maza íncubo + Escudo · Casco de guardián · …" */
export function buildSummary(role: RoleTemplate, max = 200): string {
  const b = role.build ?? {};
  const parts: string[] = [];
  const weapon = getItem(b.weapon)?.name;
  const off = isTwoHanded(b.weapon) ? undefined : getItem(b.offhand)?.name;
  if (weapon) parts.push(off ? `${weapon} + ${off}` : weapon);
  for (const s of ['head', 'armor', 'shoes', 'cape'] as const) {
    const n = getItem(b[s])?.name;
    if (n) parts.push(n);
  }
  return parts.join(' · ').slice(0, max);
}
