/**
 * Fuente incluida con el bot para las imágenes (banner del ping y tarjeta de builds). Sin ella,
 * en un servidor Linux sin "Segoe UI" ni Arial el texto sale como cuadraditos.
 * Noto Sans, con licencia SIL OFL 1.1 (assets/fonts/OFL.txt).
 *
 * Las fuentes se registran al importar el módulo.
 */
import fs from 'fs';
import path from 'path';
import { GlobalFonts } from '@napi-rs/canvas';

/** Nombre con el que se registra la fuente incluida. */
export const FONT_FAMILY = 'MassUp Sans';

/** Lista de familias para ctx.font: la fuente incluida y, de respaldo, las del sistema. */
export const FONT_STACK = `"${FONT_FAMILY}", "Segoe UI", Arial, sans-serif`;

let registered = false;

/** Registra la fuente en @napi-rs/canvas. Solo actúa la primera vez. */
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
