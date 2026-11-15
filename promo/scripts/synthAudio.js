/**
 * Sintetiza la pista de audio del video (música de fondo + efectos), 100 % generada por código:
 * sin samples ni música de terceros, así que no hay problemas de derechos.
 *   node scripts/synthAudio.js   (desde promo/) → public/audio.wav
 * Los tiempos salen de los fotogramas de las escenas (30 fps); ver GUION.md.
 */
const fs = require('fs');
const path = require('path');

const SR = 48000;
const DUR = 25;
const N = SR * DUR;
const L = new Float32Array(N);
const R = new Float32Array(N);
const f = (frame) => frame / 30; // fotograma → segundos

// Ruido determinista (mismo resultado en cada ejecución)
let seed = 1234567;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296 * 2 - 1;
};

/** Suma una voz: gen(t, tLocal) → muestra; env(tLocal) → ganancia; pan -1..1 */
function add(start, dur, gen, env, gain = 1, pan = 0) {
  const s0 = Math.max(0, Math.floor(start * SR));
  const s1 = Math.min(N, Math.floor((start + dur) * SR));
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  for (let i = s0; i < s1; i++) {
    const tl = i / SR - start;
    const v = gen(tl) * env(tl);
    L[i] += v * gl;
    R[i] += v * gr;
  }
}
const expEnv = (a, d) => (t) => (t < a ? t / a : Math.exp(-(t - a) / d));
const sin = (fr) => (t) => Math.sin(2 * Math.PI * fr * t);
// Frecuencia que barre de f0 a f1 (fase integrada)
const sweep = (f0, f1, dur) => (t) => {
  const k = (f1 - f0) / dur;
  return Math.sin(2 * Math.PI * (f0 * t + 0.5 * k * Math.min(t, dur) * Math.min(t, dur)));
};
// Ruido filtrado paso bajo de un polo (lp 0..1, menor = más grave)
const noise = (lp) => {
  let y = 0;
  return () => (y += lp * (rnd() - y));
};

// ---------- Efectos ----------
const tick = (t, g = 0.35, hi = true) =>
  add(t, 0.05, (x) => sin(hi ? 2400 : 1700)(x) + 0.4 * noise(0.6)(x), expEnv(0.001, 0.012), g, hi ? 0.15 : -0.15);
const click = (t, g = 0.4) => {
  add(t, 0.06, noise(0.5), expEnv(0.0005, 0.008), g);
  add(t, 0.06, sin(900), expEnv(0.0005, 0.015), g * 0.5);
};
const key = (t) => {
  add(t, 0.05, noise(0.35), expEnv(0.0005, 0.01), 0.35, rnd() * 0.3);
  add(t, 0.05, sin(320), expEnv(0.0005, 0.012), 0.15);
};
const pop = (t, base = 520, g = 0.35) => add(t, 0.18, sweep(base, base * 2.2, 0.08), expEnv(0.002, 0.05), g);
const whoosh = (t, dur = 0.45, g = 0.22) => {
  const n = noise(0.25);
  add(t, dur, (x) => n(x), (x) => Math.sin(Math.PI * Math.min(1, x / dur)) ** 2, g);
};
const boom = (t, g = 0.9) => {
  add(t, 1.6, sweep(130, 38, 0.5), expEnv(0.003, 0.45), g);
  add(t, 0.5, noise(0.08), expEnv(0.001, 0.12), g * 0.6);
};
const chime = (t, notes, g = 0.22, step = 0.09) =>
  notes.forEach((fr, i) => {
    add(t + i * step, 1.2, (x) => sin(fr)(x) + 0.3 * sin(fr * 2)(x) + 0.12 * sin(fr * 3)(x), expEnv(0.004, 0.35), g, i % 2 ? 0.2 : -0.2);
  });
const riser = (t, dur, g = 0.18) => {
  const n = noise(0.15);
  add(t, dur, (x) => 0.6 * n(x) + 0.4 * sweep(200, 1400, dur)(x), (x) => (x / dur) ** 2, g);
};

// ---------- Música de fondo (re menor, 120 bpm) ----------
const BEAT = 0.5;
const D2 = 73.42, A2 = 110, F2 = 87.31, C3 = 130.81, Bb1 = 58.27;
// Progresión de 2 compases por acorde: Dm – Bb – F – C
const prog = [
  [D2, 146.83, 174.61, 220],
  [Bb1, 116.54, 146.83, 174.61],
  [F2, 130.81, 174.61, 220],
  [C3 / 2, 130.81, 164.81, 196],
];
const pad = (t, dur, chord, g) =>
  chord.forEach((fr, i) => {
    const det = 1 + (i % 2 ? 0.003 : -0.003);
    add(
      t,
      dur + 0.4,
      (x) => 0.6 * Math.sin(2 * Math.PI * fr * det * x) + 0.25 * Math.sin(2 * Math.PI * fr * 2 * x) + 0.1 * Math.sin(2 * Math.PI * fr * 3 * x),
      (x) => Math.min(1, x / 0.35) * Math.min(1, Math.max(0, (dur + 0.4 - x) / 0.4)),
      g * (i === 0 ? 1.3 : 0.7),
      (i - 1.5) * 0.35
    );
  });
const kick = (t, g = 0.55) => add(t, 0.4, sweep(150, 45, 0.12), expEnv(0.002, 0.12), g);
const hat = (t, g = 0.08) => add(t, 0.06, noise(0.95), expEnv(0.0005, 0.02), g, 0.3);
const tom = (t, g = 0.4) => add(t, 0.5, sweep(220, 90, 0.2), expEnv(0.002, 0.15), g, -0.2);

// Tensión en el gancho: dron grave + tic-tac que acelera (0–1,73 s)
add(0, 1.9, (x) => sin(D2 / 2)(x) + 0.4 * sin(D2)(x), (x) => Math.min(1, x / 0.3), 0.18);
{
  let t = 0.13, gap = 0.22, hi = true;
  while (t < f(52)) {
    tick(t, 0.32, hi);
    hi = !hi;
    t += gap;
    gap = Math.max(0.045, gap * 0.86);
  }
}
riser(0.6, f(56) - 0.6, 0.16);
boom(f(56));
chime(f(56) + 0.02, [587.33, 880], 0.12, 0.05);

// Base desde 2,9 s hasta el cierre
const MUSIC_START = 2.9;
const MUSIC_END = f(580);
for (let bar = 0; MUSIC_START + bar * 4 * BEAT < MUSIC_END; bar++) {
  const t0 = MUSIC_START + bar * 4 * BEAT;
  const chord = prog[Math.floor(bar / 2) % prog.length];
  if (bar % 2 === 0) pad(t0, Math.min(8 * BEAT, MUSIC_END - t0), chord, 0.05);
  for (let b = 0; b < 4; b++) {
    const t = t0 + b * BEAT;
    if (t >= MUSIC_END - 0.05) break;
    kick(t, b === 0 ? 0.5 : 0.36);
    if (b === 3 && bar % 2 === 1) tom(t + BEAT / 2, 0.3);
    hat(t + BEAT / 2);
    if (t > f(310)) hat(t + BEAT / 4, 0.05); // más energía cuando se llena la party
  }
  // bajo en corcheas
  for (let e = 0; e < 8; e++) {
    const t = t0 + e * (BEAT / 2);
    if (t >= MUSIC_END - 0.05) break;
    add(t, 0.24, (x) => sin(chord[0])(x) + 0.35 * sin(chord[0] * 2)(x), expEnv(0.004, 0.09), 0.16);
  }
}
riser(MUSIC_END - 1.1, 1.1, 0.14);

// Paso 1 · /ping (empieza en 90)
whoosh(f(90) - 0.15);
[9, 12, 15, 18, 21].forEach((fr) => key(f(90 + fr)));
whoosh(f(90 + 26), 0.3, 0.12);
[44, 60, 72, 84].forEach((fr) => click(f(90 + fr)));
click(f(90 + 100), 0.5);
chime(f(90 + 104), [783.99, 1174.66], 0.16, 0.07); // ✅ publicado

// Paso 2 · Aviso (210)
whoosh(f(210) - 0.15);
chime(f(210 + 18), [1046.5, 1318.5], 0.2, 0.11); // notificación
// Paso 3 · Roster
whoosh(f(210 + 110) - 0.1, 0.35, 0.14);
[132, 152, 172].forEach((fr, i) => pop(f(210 + fr), 480 + i * 80));
chime(f(210 + 172) + 0.08, [587.33, 739.99, 880], 0.12, 0.06); // party completa
pop(f(210 + 196), 300, 0.32); // banca

// Mando (450)
whoosh(f(450) - 0.15);
click(f(450 + 28), 0.5);
for (let i = 0; i < 7; i++) add(f(450 + 34 + i * 3), 0.12, sin(660 + i * 55), expEnv(0.002, 0.04), 0.1, -0.4 + i * 0.13);
click(f(450 + 66), 0.55);
whoosh(f(450 + 72), 0.5, 0.25);
add(f(450 + 74), 0.4, sweep(900, 200, 0.3), expEnv(0.002, 0.12), 0.12);

// Cierre (580): golpe + cuerno de guerra en re
boom(f(580), 1);
const horn = (fr, t, dur, g) =>
  add(
    t,
    dur,
    (x) => {
      let v = 0;
      for (let h = 1; h <= 8; h++) v += Math.sin(2 * Math.PI * fr * h * x * (1 + 0.002 * Math.sin(5 * x))) / (h * 1.3);
      return v;
    },
    (x) => Math.min(1, x / 0.25) * Math.min(1, Math.max(0, (dur - x) / 0.6)),
    g
  );
horn(D2 * 2, f(580) + 0.05, 2.4, 0.09);
horn(A2 * 2, f(580) + 0.05, 2.4, 0.06);
pad(f(580), 5.3, [D2, 146.83, 174.61, 220, 293.66], 0.06);
[26, 36, 46].forEach((fr) => tom(f(580 + fr), 0.35));
kick(f(580 + 78), 0.5);
chime(f(580 + 78), [587.33, 880, 1174.66], 0.12, 0.05);

// ---------- Master: limitador suave + fundido final ----------
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const PRE = 1.7; // ganancia antes del limitador (≈ -14 LUFS, lo habitual en redes)
const norm = 0.97 / Math.tanh(peak * PRE);
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write('WAVEfmt ', 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = Math.min(1, t / 0.02, (DUR - t) / 1.2);
  const l = Math.tanh(L[i] * PRE) * norm * fade;
  const r = Math.tanh(R[i] * PRE) * norm * fade;
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l)) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r)) * 32767), 46 + i * 4);
}
const out = path.join(__dirname, '..', 'public', 'audio.wav');
fs.writeFileSync(out, buf);
console.log(`audio.wav · ${DUR} s · pico previo ${peak.toFixed(2)}`);
