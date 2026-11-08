import fs from 'fs';
import path from 'path';
import { createCanvas, Image, loadImage, SKRSContext2D } from '@napi-rs/canvas';
import { BUILD_SLOTS, getItem, isTwoHanded, itemIconUrl } from '../data/items';
import { RoleTemplate } from '../types/ping';
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

export function hasAnyBuild(roles: RoleTemplate[]): boolean {
  return roles.some((r) => r.build && Object.values(r.build).some(Boolean));
}

function truncate(ctx: SKRSContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

/** Genera la tarjeta PNG o null si ningún rol tiene build. */
export async function generateBuildCard(title: string, roles: RoleTemplate[]): Promise<Buffer | null> {
  const withBuild = roles.filter((r) => r.build && Object.values(r.build).some(Boolean)).slice(0, 12);
  if (withBuild.length === 0) return null;

  const ICON = 64;
  const GAP = 8;
  const NAME_W = 210;
  const PAD = 24;
  const HEADER = 64;
  const ROW = ICON + 30;
  const width = PAD * 2 + NAME_W + BUILD_SLOTS.length * (ICON + GAP);
  const height = HEADER + withBuild.length * ROW + PAD;

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

  ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#D4AF37';
  ctx.textBaseline = 'middle';
  ctx.fillText(truncate(ctx, `BUILDS · ${title.toUpperCase()}`, width - PAD * 2), PAD, 36);

  // Cabecera de huecos
  ctx.font = '11px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#8f8a7e';
  ctx.textAlign = 'center';
  BUILD_SLOTS.forEach((s, i) => {
    const x = PAD + NAME_W + i * (ICON + GAP) + ICON / 2;
    ctx.fillText(s.short.toUpperCase(), x, HEADER - 6);
  });
  ctx.textAlign = 'left';

  // Precarga de iconos en paralelo
  const ids = new Set<string>();
  for (const r of withBuild) for (const id of Object.values(r.build ?? {})) if (id) ids.add(id);
  const icons = new Map<string, Image | null>();
  await Promise.all([...ids].map(async (id) => icons.set(id, await getIcon(id))));

  withBuild.forEach((role, row) => {
    const y = HEADER + 8 + row * ROW;
    if (row % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.fillRect(PAD - 8, y - 6, width - PAD * 2 + 16, ROW - 4);
    }

    const { name } = splitRoleLabel(role.label);
    ctx.font = 'bold 17px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#F2EEE3';
    ctx.fillText(truncate(ctx, name, NAME_W - 16), PAD, y + ICON / 2 - 8);
    ctx.font = '13px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#a39e92';
    ctx.fillText(role.maxSlots > 0 ? `${role.maxSlots} ${role.maxSlots === 1 ? 'cupo' : 'cupos'}` : 'sin límite', PAD, y + ICON / 2 + 14);

    BUILD_SLOTS.forEach((s, i) => {
      const x = PAD + NAME_W + i * (ICON + GAP);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(x, y, ICON, ICON);
      ctx.strokeStyle = 'rgba(212,175,55,0.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, ICON - 1, ICON - 1);

      const id = role.build?.[s.slot];
      if (s.slot === 'offhand' && isTwoHanded(role.build?.weapon)) {
        // Arma a dos manos: se muestra en gris como en el juego
        const img = icons.get(role.build?.weapon ?? '');
        if (img) {
          ctx.globalAlpha = 0.25;
          ctx.drawImage(img, x, y, ICON, ICON);
          ctx.globalAlpha = 1;
        }
        return;
      }
      const img = id ? icons.get(id) : null;
      if (img) ctx.drawImage(img, x, y, ICON, ICON);
    });
  });

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
