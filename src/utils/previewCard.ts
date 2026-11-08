import fs from 'fs';
import path from 'path';
import { ActivePing } from '../types/ping';
import { generatePingBanner } from './canvasGenerator';
import { cloneDefaultContentTypes } from '../data/defaultTemplates';
import { DEFAULT_COLORS } from './configManager';
import { GuildConfig } from '../types/ping';

async function runPreview() {
  // Config de ejemplo (no toca los datos reales). Cambia guildTag/motto para probar la marca.
  const config: GuildConfig = {
    guildId: '0',
    guildName: process.argv[2] || 'MI GREMIO DE PRUEBA',
    guildTag: process.argv[3] || '',
    motto: 'ARMEN PARTY • ANÓTENSE EN SU ROL',
    colors: { ...DEFAULT_COLORS },
    pingRoles: {},
    plan: 'free',
    contentTypes: cloneDefaultContentTypes(),
    createdAt: Date.now(),
  };
  const gankContent = config.contentTypes[0];

  const samplePing: ActivePing = {
    id: 'DEMO777',
    messageId: '123456',
    channelId: '123456',
    callerId: '999999',
    callerName: 'LordSilent',
    contentTypeId: gankContent.id,
    contentName: gankContent.name,
    title: gankContent.name,
    departureLocation: 'Portal Fort Sterling (Norte) / Hideout',
    gearTier: 'T7 / T8 Equivalente (1350+ IP)',
    mountRequired: 'Garrapresta + Pociones de veneno',
    startTimeUnix: Math.floor(Date.now() / 1000) + 900,
    timeLabel: 'En 15 minutos (20:00 UTC)',
    notes: 'Traer set de catch o burst, estar en voz 5 min antes.',
    roles: gankContent.roles,
    roster: {
      catch: [
        { userId: '1', username: 'k1', displayName: 'Kaelen', joinedAt: Date.now() },
        { userId: '2', username: 'k2', displayName: 'Vortex', joinedAt: Date.now() },
      ],
      purge: [{ userId: '3', username: 'k3', displayName: 'Nyx', joinedAt: Date.now() }],
      dps_burst: [
        { userId: '4', username: 'k4', displayName: 'Draven', joinedAt: Date.now() },
        { userId: '5', username: 'k5', displayName: 'Ragnar', joinedAt: Date.now() },
        { userId: '6', username: 'k6', displayName: 'Zephyr', joinedAt: Date.now() },
      ],
      healer_gank: [{ userId: '7', username: 'k7', displayName: 'Aurelia', joinedAt: Date.now() }],
      scout: [{ userId: '8', username: 'k8', displayName: 'Shadow', joinedAt: Date.now() }],
    },
    bench: [],
    absent: [],
    status: 'OPEN',
    createdAt: Date.now(),
  };

  const buffer = await generatePingBanner(samplePing, gankContent, config);
  const outPath = path.join(process.cwd(), 'data', 'preview_banner.png');
  fs.writeFileSync(outPath, buffer);
  console.log(`✅ Vista previa de la tarjeta generada en: ${outPath}`);
}

runPreview().catch(console.error);

