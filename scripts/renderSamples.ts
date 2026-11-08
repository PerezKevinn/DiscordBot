/**
 * Genera imágenes de ejemplo (banner de ping y tarjeta de builds) para comprobar que
 * las fuentes y los iconos se ven bien en esta máquina. No toca los datos reales.
 *   npx tsx scripts/renderSamples.ts [carpeta-de-salida]
 */
import fs from 'fs';
import path from 'path';
import { GlobalFonts } from '@napi-rs/canvas';
import { cloneDefaultContentTypes } from '../src/data/defaultTemplates';
import { generateBuildCard } from '../src/utils/buildCard';
import { generatePingBanner } from '../src/utils/canvasGenerator';
import { DEFAULT_COLORS } from '../src/utils/configManager';
import { FONT_FAMILY } from '../src/utils/fonts';
import { ActivePing, GuildConfig } from '../src/types/ping';

async function main() {
  const out = path.resolve(process.argv[2] ?? 'samples');
  fs.mkdirSync(out, { recursive: true });

  const content = cloneDefaultContentTypes()[1];
  const config: GuildConfig = {
    guildId: '0',
    guildName: 'KINGDOM OF SILENT',
    guildTag: '[KOS]',
    motto: 'CALLADITOS SE GANKEA MÁS RICO • ORO Y SANGRE',
    colors: { ...DEFAULT_COLORS },
    pingRoles: {},
    plan: 'premium',
    contentTypes: [content],
    createdAt: Date.now(),
  };
  const ping = { id: 'DEMO', title: content.name, roles: content.roles, roster: {}, status: 'OPEN' } as unknown as ActivePing;
  fs.writeFileSync(path.join(out, 'banner.png'), await generatePingBanner(ping, content, config));

  content.roles[0].build = { weapon: '2H_MACE', head: 'HEAD_PLATE_SET3', armor: 'ARMOR_PLATE_UNDEAD', food: 'T8_MEAL_STEW', mount: 'T5_MOUNT_COUGAR_KEEPER@1' };
  content.roles[1].build = { weapon: 'MAIN_HOLYSTAFF', offhand: 'OFF_BOOK', head: 'HEAD_CLOTH_SET2' };
  const card = await generateBuildCard(content.name, content.roles);
  if (card) fs.writeFileSync(path.join(out, 'builds.png'), card);

  const ok = GlobalFonts.families.some((f) => f.family === FONT_FAMILY);
  console.log(`${ok ? '✅' : '❌'} Fuente "${FONT_FAMILY}" ${ok ? 'cargada' : 'NO cargada'} · imágenes en ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
