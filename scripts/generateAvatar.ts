/**
 * Genera el avatar de MassUp (PNG 1024x1024) en varias variantes.
 * Uso: npx tsx scripts/generateAvatar.ts
 * Salida: assets/avatar-*.png
 */
import fs from 'fs';
import path from 'path';
import { createCanvas, SKRSContext2D } from '@napi-rs/canvas';

const SIZE = 1024;
const C = SIZE / 2;
const OUT_DIR = path.join(process.cwd(), 'assets');

const GOLD = { light: '#FFF1A8', main: '#D4AF37', dark: '#8A6D1B', deep: '#5C4510' };

type Pt = { x: number; y: number };

function goldGradient(ctx: SKRSContext2D, x0: number, y0: number, x1: number, y1: number) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, GOLD.light);
  g.addColorStop(0.35, GOLD.main);
  g.addColorStop(0.7, GOLD.dark);
  g.addColorStop(1, '#F3CE5A');
  return g;
}

/** Fondo oscuro con resplandor central y anillo dorado (pensado para el recorte circular de Discord). */
function drawBackground(ctx: SKRSContext2D, accent = 'rgba(212,175,55,0.22)') {
  const bg = ctx.createRadialGradient(C, C * 0.9, 40, C, C, SIZE * 0.72);
  bg.addColorStop(0, '#1E1A12');
  bg.addColorStop(0.55, '#0E0D10');
  bg.addColorStop(1, '#050507');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const glow = ctx.createRadialGradient(C, C, 60, C, C, 460);
  glow.addColorStop(0, accent);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Anillo doble dentro del círculo visible
  ctx.lineWidth = 14;
  ctx.strokeStyle = goldGradient(ctx, 0, 0, SIZE, SIZE);
  ctx.beginPath();
  ctx.arc(C, C, 470, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,229,127,0.45)';
  ctx.beginPath();
  ctx.arc(C, C, 446, 0, Math.PI * 2);
  ctx.stroke();
}

/** Punto y tangente sobre una curva Bézier cúbica. */
function bezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number) {
  const u = 1 - t;
  const pt = {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
  const d = {
    x: 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
    y: 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
  };
  const len = Math.hypot(d.x, d.y) || 1;
  return { pt, n: { x: -d.y / len, y: d.x / len }, tan: { x: d.x / len, y: d.y / len } };
}

/**
 * Cuerno de guerra: un cono curvado que se ensancha hacia la campana, con anillos dorados
 * y ondas de sonido saliendo de la boca.
 */
function drawWarHorn(ctx: SKRSContext2D, scale = 1, offset: Pt = { x: 0, y: 0 }, waves = true) {
  ctx.save();
  ctx.translate(C + offset.x, C + offset.y);
  ctx.scale(scale, scale);
  ctx.translate(-C, -C);

  const p0 = { x: 250, y: 330 };
  const p1 = { x: 260, y: 640 };
  const p2 = { x: 520, y: 760 };
  const p3 = { x: 700, y: 520 };
  const width = (t: number) => 14 + Math.pow(t, 1.7) * 125; // semiancho

  const STEPS = 120;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const { pt, n } = bezier(p0, p1, p2, p3, t);
    const w = width(t);
    left.push({ x: pt.x + n.x * w, y: pt.y + n.y * w });
    right.push({ x: pt.x - n.x * w, y: pt.y - n.y * w });
  }

  // Sombra
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;

  // Cuerpo del cuerno (hueso/marfil oscuro con brillo)
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (const p of left) ctx.lineTo(p.x, p.y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  const body = ctx.createLinearGradient(220, 300, 760, 760);
  body.addColorStop(0, '#F5E6C4');
  body.addColorStop(0.45, '#C9A66B');
  body.addColorStop(1, '#6B4A22');
  ctx.fillStyle = body;
  ctx.fill();
  ctx.restore();

  ctx.lineWidth = 6;
  ctx.strokeStyle = GOLD.deep;
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (const p of left) ctx.lineTo(p.x, p.y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.stroke();

  // Brillo lateral
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#FFF8E6';
  ctx.beginPath();
  for (let i = 8; i <= STEPS - 14; i++) {
    const t = i / STEPS;
    const { pt, n } = bezier(p0, p1, p2, p3, t);
    const w = width(t) * 0.55;
    const x = pt.x + n.x * w;
    const y = pt.y + n.y * w;
    if (i === 8) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  // Anillos dorados
  const gold = goldGradient(ctx, 200, 300, 760, 760);
  for (const t of [0.04, 0.3, 0.55, 0.88]) {
    const { pt, n, tan } = bezier(p0, p1, p2, p3, t);
    const w = width(t) + 10;
    const band = t > 0.8 ? 30 : 22;
    ctx.beginPath();
    ctx.moveTo(pt.x + n.x * w - tan.x * band / 2, pt.y + n.y * w - tan.y * band / 2);
    ctx.lineTo(pt.x + n.x * w + tan.x * band / 2, pt.y + n.y * w + tan.y * band / 2);
    ctx.lineTo(pt.x - n.x * w + tan.x * band / 2, pt.y - n.y * w + tan.y * band / 2);
    ctx.lineTo(pt.x - n.x * w - tan.x * band / 2, pt.y - n.y * w - tan.y * band / 2);
    ctx.closePath();
    ctx.fillStyle = gold;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = GOLD.deep;
    ctx.stroke();
  }

  // Boquilla
  {
    const { pt, tan } = bezier(p0, p1, p2, p3, 0);
    ctx.beginPath();
    ctx.ellipse(pt.x - tan.x * 6, pt.y - tan.y * 6, 26, 14, Math.atan2(tan.y, tan.x) + Math.PI / 2, 0, Math.PI * 2);
    ctx.fillStyle = gold;
    ctx.fill();
    ctx.strokeStyle = GOLD.deep;
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  // Campana (boca del cuerno)
  const end = bezier(p0, p1, p2, p3, 1);
  const angle = Math.atan2(end.tan.y, end.tan.x);
  const bellR = width(1) + 14;
  ctx.save();
  ctx.translate(end.pt.x, end.pt.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.ellipse(0, 0, 44, bellR, 0, 0, Math.PI * 2);
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = GOLD.deep;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(6, 0, 30, bellR - 22, 0, 0, Math.PI * 2);
  const inner = ctx.createRadialGradient(6, 0, 5, 6, 0, bellR);
  inner.addColorStop(0, '#000000');
  inner.addColorStop(1, '#2A1E0A');
  ctx.fillStyle = inner;
  ctx.fill();
  ctx.restore();

  // Ondas de sonido
  if (waves) {
    ctx.save();
    ctx.translate(end.pt.x, end.pt.y);
    ctx.rotate(angle);
    ctx.lineCap = 'round';
    [90, 150, 210].forEach((r, i) => {
      ctx.beginPath();
      ctx.arc(10, 0, r, -0.55 + i * 0.05, 0.55 - i * 0.05);
      ctx.lineWidth = 18 - i * 4;
      ctx.strokeStyle = `rgba(255, 229, 127, ${0.95 - i * 0.25})`;
      ctx.stroke();
    });
    ctx.restore();
  }

  ctx.restore();
}

/** Escudo heráldico de fondo. */
function drawShield(ctx: SKRSContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.85, cy - r * 0.65);
  ctx.lineTo(cx + r * 0.78, cy + r * 0.2);
  ctx.quadraticCurveTo(cx + r * 0.5, cy + r * 0.8, cx, cy + r);
  ctx.quadraticCurveTo(cx - r * 0.5, cy + r * 0.8, cx - r * 0.78, cy + r * 0.2);
  ctx.lineTo(cx - r * 0.85, cy - r * 0.65);
  ctx.closePath();
  const bg = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  bg.addColorStop(0, '#1C1A22');
  bg.addColorStop(1, '#060608');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 16;
  ctx.strokeStyle = goldGradient(ctx, cx - r, cy - r, cx + r, cy + r);
  ctx.stroke();
}

/** Monograma "M" dorado con biselado. */
function drawMonogram(ctx: SKRSContext2D, cx: number, cy: number, size: number) {
  ctx.save();
  ctx.font = `bold ${size}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = goldGradient(ctx, cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2);
  ctx.fillText('M', cx, cy);
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 5;
  ctx.strokeStyle = GOLD.deep;
  ctx.strokeText('M', cx, cy);
  ctx.restore();
}

function save(name: string, draw: (ctx: SKRSContext2D) => void) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  draw(ctx);
  const file = path.join(OUT_DIR, `avatar-${name}.png`);
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
  console.log(`✅ ${file}`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

// A: cuerno de guerra protagonista
// Avatar oficial elegido: también se guarda como assets/avatar.png
save('cuerno', (ctx) => {
  drawBackground(ctx);
  drawWarHorn(ctx, 1, { x: -20, y: -10 });
});

// B: cuerno sobre escudo heráldico
save('escudo', (ctx) => {
  drawBackground(ctx, 'rgba(212,175,55,0.12)');
  drawShield(ctx, C, C + 10, 360);
  drawWarHorn(ctx, 0.66, { x: -10, y: 10 }, true);
});

// C: monograma M con cuerno pequeño
save('monograma', (ctx) => {
  drawBackground(ctx);
  drawMonogram(ctx, C, C - 10, 560);
});

fs.copyFileSync(path.join(OUT_DIR, 'avatar-cuerno.png'), path.join(OUT_DIR, 'avatar.png'));
console.log(`⭐ Avatar oficial: ${path.join(OUT_DIR, 'avatar.png')}`);
