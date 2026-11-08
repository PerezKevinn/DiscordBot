import fs from 'fs';
import path from 'path';
import { GlobalFonts } from '@napi-rs/canvas';

/**
 * Fuente incluida con el bot para las imágenes (banner del ping y tarjeta de builds).
 * Sin esto, en un servidor Linux sin "Segoe UI"/"Arial" el texto sale como cuadraditos.
 * Noto Sans: licencia SIL OFL 1.1 (assets/fonts/OFL.txt).
 */
export const FONT_FAMILY = 'MassUp Sans';

/** Cadena para ctx.font: la fuente incluida y, por si acaso, las del sistema. */
export const FONT_STACK = `"${FONT_FAMILY}", "Segoe UI", Arial, sans-serif`;

let registered = false;

export function registerFonts(): void {
  if (registered) return;
  registered = true;
  const dir = path.join(process.cwd(), 'assets', 'fonts');
  for (const file of ['NotoSans-Regular.ttf', 'NotoSans-Bold.ttf']) {
    const full = path.join(dir, file);
    if (!fs.existsSync(full) || !GlobalFonts.registerFromPath(full, FONT_FAMILY)) {
      console.warn(`⚠️ No se pudo cargar la fuente ${full}: las imágenes usarán la del sistema.`);
    }
  }
}

registerFonts();
