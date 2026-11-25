/**
 * Portada personalizada (misma plantilla para todos) de los videos ya generados en out/diario/.
 *   npm run portada                → todas las carpetas de out/diario/
 *   npm run portada -- <id> [<id>…] → solo esas ideas
 * La usa también scripts/daily.ts al generar cada video.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { COVER_FRAME, CoverProps } from '../src/shorts/Cover';

const root = path.join(__dirname, '..');
const q = (p: string) => (process.platform === 'win32' ? `"${p}"` : p);

export function renderCover(dir: string, cover: string, hook: { chat: CoverProps['chat']; channel?: string }) {
  const props: CoverProps = { cover, chat: hook.chat, channel: hook.channel };
  const propsFile = path.join(dir, 'portada-props.json');
  fs.writeFileSync(propsFile, JSON.stringify(props, null, 2));
  const out = path.join(dir, 'portada.png');
  const r = spawnSync('npx', ['remotion', 'still', 'Portada', q(out), `--props=${q(propsFile)}`, `--frame=${COVER_FRAME}`, '--log=error'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  fs.rmSync(propsFile, { force: true });
  if (r.status !== 0) throw new Error(`Falló la portada de ${dir}`);
  return out;
}

if (require.main === module) {
  const ideas: Array<{ id: string; cover: string; props: { hook: CoverProps & { channel?: string } } }> = JSON.parse(
    fs.readFileSync(path.join(root, 'shorts', 'ideas.json'), 'utf8')
  );
  const base = path.join(root, 'out', 'diario');
  const wanted = process.argv.slice(2);
  const dirs = fs.existsSync(base) ? fs.readdirSync(base) : [];
  let n = 0;
  for (const d of dirs) {
    const idea = ideas.find((i) => d.endsWith(`-${i.id}`) && /^\d{4}-\d{2}-\d{2}-/.test(d) && d.slice(11) === i.id);
    if (!idea || (wanted.length && !wanted.includes(idea.id))) continue;
    renderCover(path.join(base, d), idea.cover, idea.props.hook);
    console.log(`✓ ${d}/portada.png`);
    n++;
  }
  if (!n) console.log('No hay videos generados que coincidan.');
}
