import { createCanvas, Image, SKRSContext2D } from '@napi-rs/canvas';
import { FONT_STACK } from './fonts';
import { getGuildLogo } from './logo';
import { ActivePing, ContentTypeConfig, GuildConfig } from '../types/ping';

/**
 * Dibuja un rectángulo con esquinas redondeadas o biseladas estilo medieval/Albion
 */
function drawBeveledRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  bevel: number
) {
  ctx.beginPath();
  ctx.moveTo(x + bevel, y);
  ctx.lineTo(x + w - bevel, y);
  ctx.lineTo(x + w, y + bevel);
  ctx.lineTo(x + w, y + h - bevel);
  ctx.lineTo(x + w - bevel, y + h);
  ctx.lineTo(x + bevel, y + h);
  ctx.lineTo(x, y + h - bevel);
  ctx.lineTo(x, y + bevel);
  ctx.closePath();
}

/**
 * Dibuja el emblema del gremio (escudo + corona + siglas)
 */
function drawKingdomEmblem(ctx: SKRSContext2D, cx: number, cy: number, radius: number, initials: string) {
  ctx.save();

  // Resplandor dorado exterior
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.35);
  glow.addColorStop(0, 'rgba(212, 175, 55, 0.35)');
  glow.addColorStop(0.6, 'rgba(212, 175, 55, 0.10)');
  glow.addColorStop(1, 'rgba(212, 175, 55, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.35, 0, Math.PI * 2);
  ctx.fill();

  // Escudo octogonal / heráldico negro y dorado
  const goldGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  goldGrad.addColorStop(0, '#FFF1A8');
  goldGrad.addColorStop(0.3, '#D4AF37');
  goldGrad.addColorStop(0.7, '#99731C');
  goldGrad.addColorStop(1, '#F3CE5A');

  // Forma de escudo heráldico
  ctx.beginPath();
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx + radius * 0.85, cy - radius * 0.65);
  ctx.lineTo(cx + radius * 0.75, cy + radius * 0.25);
  ctx.quadraticCurveTo(cx + radius * 0.45, cy + radius * 0.8, cx, cy + radius);
  ctx.quadraticCurveTo(cx - radius * 0.45, cy + radius * 0.8, cx - radius * 0.75, cy + radius * 0.25);
  ctx.lineTo(cx - radius * 0.85, cy - radius * 0.65);
  ctx.closePath();

  const shieldBg = ctx.createLinearGradient(cx, cy - radius, cx, cy + radius);
  shieldBg.addColorStop(0, '#181822');
  shieldBg.addColorStop(0.5, '#0B0B10');
  shieldBg.addColorStop(1, '#050508');
  ctx.fillStyle = shieldBg;
  ctx.fill();

  ctx.lineWidth = 4;
  ctx.strokeStyle = goldGrad;
  ctx.stroke();

  // Borde interior fino del escudo
  ctx.save();
  ctx.scale(0.86, 0.86);
  const sCx = cx / 0.86;
  const sCy = cy / 0.86;
  ctx.beginPath();
  ctx.moveTo(sCx, sCy - radius);
  ctx.lineTo(sCx + radius * 0.85, sCy - radius * 0.65);
  ctx.lineTo(sCx + radius * 0.75, sCy + radius * 0.25);
  ctx.quadraticCurveTo(sCx + radius * 0.45, sCy + radius * 0.8, sCx, sCy + radius);
  ctx.quadraticCurveTo(sCx - radius * 0.45, sCy + radius * 0.8, sCx - radius * 0.75, sCy + radius * 0.25);
  ctx.lineTo(sCx - radius * 0.85, sCy - radius * 0.65);
  ctx.closePath();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 229, 127, 0.45)';
  ctx.stroke();
  ctx.restore();

  // Dibujar Corona Dorada en el centro superior del escudo
  ctx.fillStyle = goldGrad;
  const cw = radius * 0.9;
  const ch = radius * 0.48;
  const cyCrown = cy - radius * 0.05;

  ctx.beginPath();
  ctx.moveTo(cx - cw * 0.42, cyCrown + ch * 0.4); // Base izq
  ctx.lineTo(cx - cw * 0.52, cyCrown - ch * 0.35); // Punta izq
  ctx.lineTo(cx - cw * 0.22, cyCrown + ch * 0.02); // Valle izq
  ctx.lineTo(cx, cyCrown - ch * 0.65); // Punta central alta
  ctx.lineTo(cx + cw * 0.22, cyCrown + ch * 0.02); // Valle der
  ctx.lineTo(cx + cw * 0.52, cyCrown - ch * 0.35); // Punta der
  ctx.lineTo(cx + cw * 0.42, cyCrown + ch * 0.4); // Base der
  ctx.closePath();
  ctx.fill();

  // Base inferior de la corona
  ctx.fillRect(cx - cw * 0.42, cyCrown + ch * 0.46, cw * 0.84, ch * 0.14);

  // Siglas debajo de la corona
  ctx.font = `bold 20px ${FONT_STACK}`;
  ctx.fillStyle = '#FFE57F';
  ctx.textAlign = 'center';
  ctx.fillText(initials.split('').join(' '), cx, cy + radius * 0.56);

  ctx.restore();
}

/**
 * Trunca un texto si supera el ancho máximo en píxeles
 */
function truncateText(ctx: SKRSContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

/**
 * Genera el banner PNG personalizado en Negro Obsidiana y Dorado Imperial 
 */
export async function generatePingBanner(
  ping: ActivePing,
  contentConfig: ContentTypeConfig,
  guildConfig: GuildConfig
): Promise<Buffer> {
  const width = 960;
  // Cabecera compacta: los datos (hora, masa, IP...) van en el embed, que se actualiza en vivo
  const height = 200;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Fondo Negro Obsidiana con degradado profundo
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#070709');
  bgGrad.addColorStop(0.45, '#111117');
  bgGrad.addColorStop(1, '#09090C');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Resplandor radial ambiental (Dorado + Color de acento del contenido)
  const ambientGlow = ctx.createRadialGradient(width * 0.8, height * 0.25, 20, width * 0.75, height * 0.3, 480);
  ambientGlow.addColorStop(0, contentConfig.accentColor + '33'); // 20% opacidad
  ambientGlow.addColorStop(0.5, 'rgba(212, 175, 55, 0.08)');
  ambientGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = ambientGlow;
  ctx.fillRect(0, 0, width, height);

  // 3. Patrón geométrico sutil de fondo (líneas diagonales doradas tenues)
  ctx.save();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.04)';
  ctx.lineWidth = 1;
  for (let i = -height; i < width + height; i += 28) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + height, height);
    ctx.stroke();
  }
  ctx.restore();

  // 4. Marco Imperial Dorado Exterior e Interior
  const goldGrad = ctx.createLinearGradient(0, 0, width, height);
  goldGrad.addColorStop(0, '#FFF1A8');
  goldGrad.addColorStop(0.25, '#D4AF37');
  goldGrad.addColorStop(0.5, '#8A6D1B');
  goldGrad.addColorStop(0.75, '#D4AF37');
  goldGrad.addColorStop(1, '#FFF1A8');

  // Borde exterior biselado
  drawBeveledRect(ctx, 12, 12, width - 24, height - 24, 18);
  ctx.lineWidth = 3;
  ctx.strokeStyle = goldGrad;
  ctx.stroke();

  // Borde interior sutil
  drawBeveledRect(ctx, 20, 20, width - 40, height - 40, 14);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
  ctx.stroke();

  // Adornos de diamantes dorados en las 4 esquinas
  const corners = [
    [28, 28],
    [width - 28, 28],
    [28, height - 28],
    [width - 28, height - 28],
  ];
  ctx.fillStyle = '#FFE57F';
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 5);
    ctx.lineTo(cx + 5, cy);
    ctx.lineTo(cx, cy + 5);
    ctx.lineTo(cx - 5, cy);
    ctx.closePath();
    ctx.fill();
  }

  // 5. Emblema del gremio (Izquierda Superior)
  const logo = await getGuildLogo(guildConfig);
  if (logo) drawGuildLogo(ctx, logo, 96, 98, 52);
  else drawKingdomEmblem(ctx, 96, 98, 52, getInitials(guildConfig));

  // 6. Encabezado del Gremio y Estado del Ping
  ctx.textAlign = 'left';
  ctx.font = `bold 16px ${FONT_STACK}`;
  ctx.fillStyle = '#D4AF37';
  ctx.fillText(`${guildConfig.guildName}  •  ARMANDO PARTY / MASS UP`, 172, 62);

  // Título Principal (Nombre del Contenido / Actividad)
  // El título se achica (de 36 a 24 px) para caber entero; solo si aun así no cabe se recorta
  const titleText = ping.title.toUpperCase();
  let titleSize = 36;
  ctx.font = `bold ${titleSize}px ${FONT_STACK}`;
  while (titleSize > 24 && ctx.measureText(titleText).width > 560) {
    titleSize -= 2;
    ctx.font = `bold ${titleSize}px ${FONT_STACK}`;
  }
  ctx.fillStyle = '#FFFFFF';
  const mainTitle = truncateText(ctx, titleText, 560);
  ctx.fillText(mainTitle, 172, 104);

  // Subtítulo de la categoría con barra de acento
  ctx.fillStyle = contentConfig.accentColor;
  ctx.fillRect(172, 118, 5, 22);
  ctx.font = `bold 17px ${FONT_STACK}`;
  ctx.fillStyle = '#FFE57F';
  ctx.fillText(truncateText(ctx, contentConfig.subtitle, 550), 186, 135);

  // 7. Badge de Estado y Contador de Jugadores (Arriba Derecha)
  const totalJoined = Object.values(ping.roster).reduce((acc, arr) => acc + arr.length, 0);
  const totalMax = ping.roles.reduce((acc, r) => acc + (r.maxSlots || 0), 0);

  const statusColors: Record<ActivePing['status'], { bg: string; border: string; label: string }> = {
    OPEN: { bg: 'rgba(212, 175, 55, 0.16)', border: '#D4AF37', label: 'MASS UP ABIERTO' },
    IN_PROGRESS: { bg: 'rgba(42, 157, 143, 0.25)', border: '#2A9D8F', label: 'EN RUTA / ROAMING' },
    CLOSED: { bg: 'rgba(108, 117, 125, 0.25)', border: '#ADB5BD', label: 'GG / TERMINADO' },
    CANCELLED: { bg: 'rgba(230, 57, 70, 0.25)', border: '#E63946', label: 'SE CANCELA' },
  };
  const st = statusColors[ping.status];

  drawBeveledRect(ctx, width - 235, 42, 195, 86, 10);
  ctx.fillStyle = st.bg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = st.border;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = `bold 13px ${FONT_STACK}`;
  ctx.fillStyle = '#FFE57F';
  ctx.fillText(st.label, width - 137, 66);

  ctx.font = `bold 32px ${FONT_STACK}`;
  ctx.fillStyle = '#FFFFFF';
  const countStr = totalMax > 0 ? `${totalJoined} / ${totalMax}` : `${totalJoined}`;
  ctx.fillText(countStr, width - 137, 102);

  ctx.font = `12px ${FONT_STACK}`;
  ctx.fillStyle = '#B8B8C8';
  ctx.fillText('EN LA PARTY', width - 137, 119);

  // 10. Pie de tarjeta con lema del gremio e ID
  ctx.textAlign = 'center';
  ctx.font = `bold 12px ${FONT_STACK}`;
  ctx.fillStyle = 'rgba(255, 229, 127, 0.75)';
  ctx.fillText(
    guildConfig.motto || 'ANÓTATE EN TU ROL CON EL MENÚ DE ABAJO',
    width / 2,
    height - 30
  );

  return canvas.toBuffer('image/png');
}


/** Siglas para el emblema: usa el tag ([KOS] -> KOS) o las iniciales del nombre. */
function getInitials(guildConfig: GuildConfig): string {
  const fromTag = guildConfig.guildTag.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase();
  if (fromTag) return fromTag.slice(0, 4);
  const words = guildConfig.guildName.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const initials = words.map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')[0] || '').join('').toUpperCase();
  return (initials || 'AO').slice(0, 3);
}

/** Logo del gremio en círculo con aro dorado (icono del servidor o logo propio). */
function drawGuildLogo(ctx: SKRSContext2D, img: Image, cx: number, cy: number, radius: number) {
  ctx.save();
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius * 1.45);
  glow.addColorStop(0, 'rgba(212, 175, 55, 0.30)');
  glow.addColorStop(1, 'rgba(212, 175, 55, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#0B0B10';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();

  const ring = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  ring.addColorStop(0, '#FFF1A8');
  ring.addColorStop(0.35, '#D4AF37');
  ring.addColorStop(0.7, '#99731C');
  ring.addColorStop(1, '#F3CE5A');
  ctx.lineWidth = 5;
  ctx.strokeStyle = ring;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
