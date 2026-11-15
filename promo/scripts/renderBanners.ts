/**
 * Genera con el renderizador real del bot los banners del ping de ejemplo del video
 * (Gankeo en Caminos de Avalon) de 4/7 a 7/7, para que el contador suba con el roster.
 *   npx tsx promo/scripts/renderBanners.ts   (desde la raíz del repo)
 */
import fs from 'fs';
import path from 'path';
import { cloneDefaultContentTypes } from '../../src/data/defaultTemplates';
import { generatePingBanner } from '../../src/utils/canvasGenerator';
import { DEFAULT_COLORS } from '../../src/utils/configManager';
import { ActivePing, GuildConfig, RosterSlotUser } from '../../src/types/ping';

async function main() {
  const out = path.resolve(__dirname, '..', 'public');
  const content = cloneDefaultContentTypes().find((c) => c.id === 'gank_ava')!;
  const config: GuildConfig = {
    guildId: '0',
    guildName: 'TU GREMIO',
    guildTag: '[TAG]',
    motto: 'ORO Y GLORIA',
    colors: { ...DEFAULT_COLORS },
    pingRoles: {},
    plan: 'premium',
    contentTypes: [content],
    createdAt: Date.now(),
  };
  const u = (n: string): RosterSlotUser => ({ userId: n, username: n, displayName: n, joinedAt: 0 });
  // Mismo orden de llegada que en el video
  const steps: Record<string, string[]>[] = [
    { catch_ava: ['Vortex'], healer_ava_gank: ['Aurelia'], dps_ava_gank: ['Nyx', 'Draven'] },
  ];
  const add = (prev: Record<string, string[]>, role: string, name: string) => ({ ...prev, [role]: [...(prev[role] ?? []), name] });
  steps.push(add(steps[0], 'purge_ava', 'Bruno'));
  steps.push(add(steps[1], 'catch_ava', 'Kael'));
  steps.push(add(steps[2], 'dps_ava_gank', 'Lyra'));

  for (const s of steps) {
    const roster = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.map(u)]));
    const n = Object.values(s).flat().length;
    const ping = { id: 'DEMO', title: content.name, roles: content.roles, roster, status: 'OPEN', partySize: 7 } as unknown as ActivePing;
    fs.writeFileSync(path.join(out, `banner-${n}.png`), await generatePingBanner(ping, content, config));
    console.log(`banner-${n}.png`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
