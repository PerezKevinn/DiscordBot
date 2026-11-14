import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePingBanner } from './canvasGenerator';
import type { ActivePing, ContentTypeConfig, GuildConfig } from '../types/ping';

/**
 * El banner usa @napi-rs/canvas, un módulo nativo: este test comprueba en la CI (Linux, como el
 * VPS) que se puede dibujar de verdad, no solo que compila. Si una actualización lo rompe, falla aquí.
 */
test('genera el banner de un ping como PNG de 960x200', async () => {
  const content = { id: 'x', name: 'Gankeo Ava', emoji: '🛕', subtitle: 'ROAMING CAMINOS AVA', accentColor: '#D4AF37', roles: [{ id: 'a', label: 'DPS', emoji: '🗡️', maxSlots: 0 }] } as ContentTypeConfig;
  const ping = {
    id: 'T', title: 'Gankeo Ava', status: 'OPEN', roles: content.roles, partySize: 7,
    roster: { a: [{ userId: '1', username: 'u', displayName: 'U', joinedAt: 0 }] }, bench: [], absent: [],
    startTimeUnix: 0, timeLabel: '21:00 UTC', departureLocation: 'Lymhurst', gearTier: 'T7', mountRequired: '+130', callerName: 'X',
  } as unknown as ActivePing;
  const config = {
    guildId: '1', guildName: 'KINGDOM OF SILENT', guildTag: '[KOS]', motto: 'ARMEN PARTY',
    colors: { primaryBlack: '#0A0A0D', secondaryBlack: '#14141A', goldPrimary: '#D4AF37', goldLight: '#FFE57F', goldDark: '#8A6D1B', embedHex: 0xd4af37 },
  } as GuildConfig;

  const png = await generatePingBanner(ping, content, config);
  assert.ok(png.length > 10_000, `PNG demasiado pequeño (${png.length} bytes)`);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'cabecera PNG');
  assert.equal(png.readUInt32BE(16), 960, 'ancho');
  assert.equal(png.readUInt32BE(20), 200, 'alto');
});
