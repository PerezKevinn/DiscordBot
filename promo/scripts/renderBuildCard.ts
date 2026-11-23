/**
 * Tarjeta de builds con swaps del video «Novedades», hecha con el renderizador real del bot
 * (la misma imagen que sale en el hilo de cada ping). Descarga los iconos oficiales de los ítems.
 *   npx tsx promo/scripts/renderBuildCard.ts   (desde la raíz del repo)
 */
import fs from 'fs';
import path from 'path';
import { cloneDefaultContentTypes } from '../../src/data/defaultTemplates';
import { generateBuildCard } from '../../src/utils/buildCard';

async function main() {
  const content = cloneDefaultContentTypes().find((c) => c.id === 'gank_ava')!;
  const role = (id: string) => content.roles.find((r) => r.id === id)!;
  Object.assign(role('catch_ava'), {
    build: { weapon: '2H_MACE', head: 'HEAD_PLATE_SET3', armor: 'ARMOR_PLATE_SET2', shoes: 'SHOES_PLATE_SET3', cape: 'CAPEITEM_FW_BRECILIEN', potion: 'T6_POTION_COOLDOWN' },
    swaps: [{ label: 'Boss', build: { head: 'HEAD_PLATE_HELL', cape: 'CAPEITEM_FW_CAERLEON' } }],
  });
  Object.assign(role('healer_ava_gank'), {
    build: { weapon: 'MAIN_HOLYSTAFF', head: 'HEAD_CLOTH_SET2', armor: 'ARMOR_LEATHER_SET2', shoes: 'SHOES_LEATHER_SET2', cape: 'CAPEITEM_FW_BRECILIEN' },
  });
  Object.assign(role('purge_ava'), {
    build: { weapon: 'MAIN_CURSEDSTAFF_AVALON', head: 'HEAD_PLATE_HELL', armor: 'ARMOR_LEATHER_SET3', shoes: 'SHOES_LEATHER_SET3', cape: 'CAPEITEM_FW_BRECILIEN' },
  });
  Object.assign(role('dps_ava_gank'), {
    build: { weapon: 'MAIN_RAPIER_MORGANA', head: 'HEAD_LEATHER_MORGANA', armor: 'ARMOR_LEATHER_MORGANA', shoes: 'SHOES_LEATHER_MORGANA', cape: 'CAPEITEM_FW_BRECILIEN', potion: 'T6_POTION_COOLDOWN' },
    swaps: [
      { label: 'Boss', build: { weapon: '2H_KNUCKLES_SET2' } },
      { label: 'Falce 3', build: { armor: 'ARMOR_LEATHER_FEY', shoes: 'SHOES_LEATHER_FEY' } },
    ],
  });
  const card = await generateBuildCard(content.name, content.roles);
  if (!card) throw new Error('No se generó la tarjeta');
  const out = path.resolve(__dirname, '..', 'public', 'builds-swaps.png');
  fs.writeFileSync(out, card);
  console.log(out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
