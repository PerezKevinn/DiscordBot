/**
 * Genera el video corto del día a partir de la siguiente idea sin usar de shorts/ideas.json:
 * video vertical sin audio y con audio, portada de prueba y publicacion.md con descripción, CTA y
 * comentario para fijar. Guarda el historial en shorts/historial.json.
 *
 *   npm run daily                  → siguiente idea (si hoy ya hay video, no hace nada)
 *   npm run daily -- <id>          → una idea concreta
 *   npm run daily -- --force       → otro video aunque hoy ya haya uno
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ShortProps, TURN_DUR, shortTimeline } from '../src/shorts/timeline';

type Idea = {
  id: string;
  /** Texto grande para la portada de TikTok (también se pone como texto en la app) */
  cover: string;
  props: ShortProps;
  /** Descripción sin hashtags; termina con la llamada a la acción */
  caption: string;
  hashtags: string[];
  /** Comentario para publicar y fijar */
  comment: string;
};

const BASE_TAGS = ['#AlbionOnline', '#Albion', '#AlbionLatam', '#Discord'];
const root = path.join(__dirname, '..');
const ideasFile = path.join(root, 'shorts', 'ideas.json');
const histFile = path.join(root, 'shorts', 'historial.json');

const args = process.argv.slice(2);
const force = args.includes('--force');
const wantedId = args.find((a) => !a.startsWith('--'));

const ideas: Idea[] = JSON.parse(fs.readFileSync(ideasFile, 'utf8'));
const hist: Array<{ date: string; id: string; dir: string }> = fs.existsSync(histFile) ? JSON.parse(fs.readFileSync(histFile, 'utf8')) : [];

const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
if (!wantedId && !force && hist.some((h) => h.date === today)) {
  console.log(`Hoy (${today}) ya hay video: ${hist.find((h) => h.date === today)!.dir}`);
  process.exit(0);
}

const used = new Set(hist.map((h) => h.id));
const idea = wantedId ? ideas.find((i) => i.id === wantedId) : ideas.find((i) => !used.has(i.id));
if (!idea) {
  console.error(wantedId ? `No existe la idea «${wantedId}».` : 'No quedan ideas sin usar: añade más a shorts/ideas.json.');
  process.exit(2);
}

const dirName = `${today}-${idea.id}`;
const dir = path.join(root, 'out', 'diario', dirName);
fs.mkdirSync(dir, { recursive: true });

const tl = shortTimeline(idea.props);
const propsFile = path.join(dir, 'props.json');
const timingFile = path.join(dir, 'tiempos.json');
fs.writeFileSync(propsFile, JSON.stringify(idea.props, null, 2));
fs.writeFileSync(
  timingFile,
  JSON.stringify({ total: tl.total, chat: tl.chat, turn: tl.turn, turnDur: TURN_DUR, scenes: tl.scenes.map((s) => s.from), outro: tl.outro })
);

const run = (cmd: string, a: string[]) => {
  const r = spawnSync(cmd, a, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error(`Falló: ${cmd} ${a.join(' ')}`);
    process.exit(r.status ?? 1);
  }
};
const q = (p: string) => (process.platform === 'win32' ? `"${p}"` : p);

const silent = path.join(dir, 'video-sin-audio.mp4');
const withAudio = path.join(dir, 'video-con-audio.mp4');
const audio = path.join(dir, 'audio.wav');
const cover = path.join(dir, 'portada.png');

run('npx', ['remotion', 'render', 'Short', q(silent), `--props=${q(propsFile)}`, '--log=error']);
run('npx', ['remotion', 'still', 'Short', q(cover), `--props=${q(propsFile)}`, `--frame=${tl.hookDur - 8}`, '--log=error']);
run('node', ['scripts/synthAudio.js', 'short', q(timingFile), q(audio)]);
run('npx', ['remotion', 'ffmpeg', '-v', 'error', '-i', q(silent), '-i', q(audio), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', '-y', q(withAudio)]);
fs.rmSync(audio, { force: true });

const tags = [...new Set([...BASE_TAGS, ...idea.hashtags])].slice(0, 7).join(' ');
const secs = (tl.total / 30).toFixed(1).replace('.', ',');
const md = `# Video del ${today} · ${idea.id}

- **Archivos:** \`video-con-audio.mp4\` (pista propia) y \`video-sin-audio.mp4\` (para ponerle un sonido en tendencia desde TikTok, al 20–30 %)
- **Duración:** ${secs} s · vertical 1080×1920
- **Mejor hora para publicar:** entre las 19:00 y las 22:00 (hora de Colombia / México)

## Texto de portada

Ponlo con el editor de texto de TikTok, arriba y con fondo negro. Como portada usa un fotograma del gancho (\`portada.png\`).

\`\`\`
${idea.cover}
\`\`\`

## Descripción

\`\`\`
${idea.caption}

${tags}
\`\`\`

## Comentario para fijar

\`\`\`
${idea.comment}
\`\`\`

## Ajustes

- **Contenido promocional → Tu marca:** activado
- **Comentarios, Dúo y Stitch:** activados
- Responde todos los comentarios de la primera hora
`;
fs.writeFileSync(path.join(dir, 'publicacion.md'), md);

const i0 = hist.findIndex((h) => h.date === today && h.id === idea.id);
if (i0 >= 0) hist.splice(i0, 1);
hist.push({ date: today, id: idea.id, dir: path.relative(root, dir).replace(/\\/g, '/') });
fs.writeFileSync(histFile, JSON.stringify(hist, null, 2) + '\n');

const left = ideas.filter((i) => !new Set(hist.map((h) => h.id)).has(i.id)).length;
console.log(`\n✓ ${path.relative(root, dir)} (${secs} s)\n  Quedan ${left} ideas sin usar.`);
