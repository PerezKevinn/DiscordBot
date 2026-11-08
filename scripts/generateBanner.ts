/**
 * Genera el banner de perfil de MassUp (Discord recomienda 680x240; se genera al doble: 1360x480).
 * Uso: npm run banner  ->  assets/banner.png
 *
 * En el perfil de Discord el avatar tapa la esquina inferior izquierda del banner, así que
 * las ondas "salen" de ahí (como si el cuerno del avatar sonara) y el texto va a la derecha.
 */
import fs from 'fs';
import path from 'path';
import { createCanvas, SKRSContext2D } from '@napi-rs/canvas';

const W = 1360;
const H = 480;
const OUT = path.join(process.cwd(), 'assets', 'banner.png');

const GOLD = { light: '#FFF1A8', main: '#D4AF37', dark: '#8A6D1B', deep: '#5C4510' };

function goldGradient(ctx: SKRSContext2D, x0: number, y0: number, x1: number, y1: number) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, GOLD.light);
  g.addColorStop(0.35, GOLD.main);
  g.addColorStop(0.7, GOLD.dark);
  g.addColorStop(1, '#F3CE5A');
  return g;
}

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// 1. Fondo oscuro con resplandor dorado
const bg = ctx.createLinearGradient(0, 0, W, H);
bg.addColorStop(0, '#070709');
bg.addColorStop(0.5, '#121117');
bg.addColorStop(1, '#09090C');
ctx.fillStyle = bg;
ctx.fillRect(0, 0, W, H);

const glow = ctx.createRadialGradient(W * 0.62, H * 0.45, 20, W * 0.62, H * 0.45, 620);
glow.addColorStop(0, 'rgba(212,175,55,0.20)');
glow.addColorStop(1, 'rgba(0,0,0,0)');
ctx.fillStyle = glow;
ctx.fillRect(0, 0, W, H);

// 2. Patrón diagonal sutil (igual que el banner de los pings)
ctx.save();
ctx.strokeStyle = 'rgba(212,175,55,0.05)';
ctx.lineWidth = 2;
for (let i = -H; i < W + H; i += 36) {
  ctx.beginPath();
  ctx.moveTo(i, 0);
  ctx.lineTo(i + H, H);
  ctx.stroke();
}
ctx.restore();

// 3. Ondas de sonido saliendo desde donde queda el avatar (abajo a la izquierda)
const origin = { x: 150, y: H + 40 };
ctx.save();
ctx.beginPath();
ctx.rect(30, 30, W - 60, H - 60); // que no pisen el marco
ctx.clip();
ctx.lineCap = 'round';
for (let i = 0; i < 7; i++) {
  const r = 260 + i * 95;
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, r, -Math.PI * 0.5, -Math.PI * 0.08);
  ctx.lineWidth = Math.max(4, 16 - i * 2);
  ctx.strokeStyle = `rgba(255, 229, 127, ${Math.max(0.05, 0.42 - i * 0.06)})`;
  ctx.stroke();
}
ctx.restore();

// 4. Marco dorado
ctx.lineWidth = 6;
ctx.strokeStyle = goldGradient(ctx, 0, 0, W, H);
ctx.strokeRect(14, 14, W - 28, H - 28);
ctx.lineWidth = 2;
ctx.strokeStyle = 'rgba(212,175,55,0.35)';
ctx.strokeRect(28, 28, W - 56, H - 56);

// 5. Texto (a la derecha, lejos del avatar)
const textX = W * 0.66;
ctx.textAlign = 'center';
ctx.textBaseline = 'alphabetic';

ctx.save();
ctx.font = 'bold 168px "Segoe UI", Arial, sans-serif';
ctx.shadowColor = 'rgba(0,0,0,0.75)';
ctx.shadowBlur = 30;
ctx.shadowOffsetY = 10;
ctx.fillStyle = goldGradient(ctx, textX - 380, 120, textX + 380, 300);
ctx.fillText('MASSUP', textX, 250);
ctx.restore();

// Separador con rombo
ctx.fillStyle = GOLD.main;
ctx.fillRect(textX - 300, 292, 250, 3);
ctx.fillRect(textX + 50, 292, 250, 3);
ctx.beginPath();
ctx.moveTo(textX, 280);
ctx.lineTo(textX + 14, 293.5);
ctx.lineTo(textX, 307);
ctx.lineTo(textX - 14, 293.5);
ctx.closePath();
ctx.fill();

ctx.font = 'bold 40px "Segoe UI", Arial, sans-serif';
ctx.fillStyle = '#F5E6C4';
ctx.fillText('EL CENTRO DE MANDO DE TU GREMIO', textX, 365);

ctx.font = '30px "Segoe UI", Arial, sans-serif';
ctx.fillStyle = 'rgba(212,175,55,0.85)';
ctx.fillText('Organiza  ·  Convoca  ·  Conquista', textX, 415);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, canvas.toBuffer('image/png'));
console.log(`✅ ${OUT}`);
