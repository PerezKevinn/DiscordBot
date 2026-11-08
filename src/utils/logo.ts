import fs from 'fs';
import path from 'path';
import { createCanvas, Image, loadImage } from '@napi-rs/canvas';
import { GuildConfig } from '../types/ping';

/**
 * Logo del gremio para el banner de los pings:
 * 1. Logo propio subido con /config marca (Premium) -> data/logos/<guildId>.png
 * 2. Si no, el icono del servidor de Discord
 * 3. Si no hay ninguno, el banner dibuja el escudo con las iniciales
 */

const LOGOS_DIR = path.join(process.cwd(), 'data', 'logos');
const LOGO_SIZE = 256;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 4000;
const ALLOWED_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);

// Caché en memoria para no descargar el icono en cada actualización del roster
const cache = new Map<string, { img: Image; at: number }>();
const CACHE_MAX = 300;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function logoPath(guildId: string) {
  if (!/^\d{5,25}$/.test(guildId)) throw new Error('guildId inválido');
  return path.join(LOGOS_DIR, `${guildId}.png`);
}

function remember(key: string, img: Image) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { img, at: Date.now() });
}

async function download(url: string, maxBytes = MAX_UPLOAD_BYTES): Promise<Buffer> {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !ALLOWED_HOSTS.has(u.hostname)) throw new Error('Origen de imagen no permitido');
  const res = await fetch(u, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new Error('Imagen demasiado grande');
  if (!(res.headers.get('content-type') ?? '').startsWith('image/')) throw new Error('No es una imagen');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new Error('Imagen demasiado grande');
  return buf;
}

/** Devuelve la imagen del logo o null si no hay (o falla: el banner usa el escudo). */
export async function getGuildLogo(config: GuildConfig): Promise<Image | null> {
  try {
    if (config.customLogo) {
      const file = logoPath(config.guildId);
      if (fs.existsSync(file)) {
        const key = `file:${file}:${fs.statSync(file).mtimeMs}`;
        const hit = cache.get(key);
        if (hit) return hit.img;
        const img = await loadImage(fs.readFileSync(file));
        remember(key, img);
        return img;
      }
    }
    if (config.iconUrl) {
      const hit = cache.get(config.iconUrl);
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.img;
      const img = await loadImage(await download(config.iconUrl, 2 * 1024 * 1024));
      remember(config.iconUrl, img);
      return img;
    }
  } catch (err) {
    console.warn(`[${config.guildId}] No se pudo cargar el logo:`, (err as Error).message);
  }
  return null;
}

/**
 * Descarga un adjunto de Discord, comprueba que es una imagen y la guarda recortada
 * en cuadrado a 256x256 PNG (re-codificarla también limpia cualquier dato raro del archivo).
 */
export async function saveCustomLogo(guildId: string, url: string): Promise<void> {
  const img = await loadImage(await download(url));
  if (img.width < 32 || img.height < 32) throw new Error('La imagen es demasiado pequeña (mínimo 32x32)');
  if (img.width > 4096 || img.height > 4096) throw new Error('La imagen es demasiado grande (máximo 4096x4096)');

  const canvas = createCanvas(LOGO_SIZE, LOGO_SIZE);
  const ctx = canvas.getContext('2d');
  const side = Math.min(img.width, img.height);
  ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, LOGO_SIZE, LOGO_SIZE);

  fs.mkdirSync(LOGOS_DIR, { recursive: true });
  fs.writeFileSync(logoPath(guildId), canvas.toBuffer('image/png'));
}

export function deleteCustomLogo(guildId: string): void {
  const file = logoPath(guildId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
