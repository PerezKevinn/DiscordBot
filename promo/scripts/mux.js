/**
 * Une cada video «sin audio» de out/ con su pista de public/ y crea la versión «con audio».
 *   node scripts/mux.js [party|novedades|loot ...]   (sin argumentos: todos los que existan)
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VIDEOS = {
  party: 'massup-party-15s',
  novedades: 'massup-novedades',
  loot: 'massup-loot',
};
const root = path.join(__dirname, '..');
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VIDEOS);

for (const name of wanted) {
  const base = VIDEOS[name];
  if (!base) throw new Error(`Video desconocido: ${name}`);
  const audio = path.join(root, 'public', `audio-${name}.wav`);
  for (const fmt of ['9x16', '16x9']) {
    const src = path.join(root, 'out', `${base}-${fmt}-sin-audio.mp4`);
    if (!fs.existsSync(src) || !fs.existsSync(audio)) continue;
    const dst = path.join(root, 'out', `${base}-${fmt}-con-audio.mp4`);
    const r = spawnSync(
      'npx',
      ['remotion', 'ffmpeg', '-v', 'error', '-i', src, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', '-y', dst],
      { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' }
    );
    if (r.status !== 0) process.exit(r.status ?? 1);
    console.log(`✓ ${path.basename(dst)}`);
  }
}
