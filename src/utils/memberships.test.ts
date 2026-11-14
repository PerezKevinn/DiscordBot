import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Pagos y códigos de Premium. Se ejecuta en una carpeta temporal para no tocar data/ real:
 * los módulos leen process.cwd() al cargarse, así que se importan después de cambiar de carpeta.
 */
const DAY = 24 * 60 * 60 * 1000;
const originalCwd = process.cwd();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'massup-test-'));

let M: typeof import('./memberships');
let C: typeof import('./configManager');

before(async () => {
  process.chdir(tmp);
  M = await import('./memberships');
  C = await import('./configManager');
});

after(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
});

let nextGuild = 100000000000000000n;
function newGuild() {
  const id = String(nextGuild++);
  return C.ConfigManager.getConfig(id, `Gremio ${id.slice(-3)}`);
}

function order(guildId: string, days = 30, amount = 15000) {
  return M.createOrder({ guildId, userId: '42', packageId: '1m', days, amount, currency: 'COP', test: true, provider: 'mercadopago' });
}

const until = (guildId: string) => C.ConfigManager.getConfig(guildId).premiumUntil ?? 0;

test('un pago aprobado suma los días una sola vez aunque el aviso se repita', () => {
  const g = newGuild();
  const o = order(g.guildId);
  const before = Date.now();

  assert.equal(M.settleOrder(o.invoice, 'paid', { paymentRef: 'P1' }).changed, true);
  const first = until(g.guildId);
  assert.ok(first >= before + 30 * DAY && first <= Date.now() + 30 * DAY);
  assert.equal(C.ConfigManager.getConfig(g.guildId).plan, 'premium');

  assert.equal(M.settleOrder(o.invoice, 'paid', { paymentRef: 'P1' }).changed, false, 'aviso repetido');
  assert.equal(until(g.guildId), first);
});

test('un segundo pago aprobado de la misma orden no suma días', () => {
  const g = newGuild();
  const o = order(g.guildId);
  M.settleOrder(o.invoice, 'paid', { paymentRef: 'P1' });
  const first = until(g.guildId);
  assert.equal(M.settleOrder(o.invoice, 'paid', { paymentRef: 'P2' }).changed, false);
  assert.equal(until(g.guildId), first);
});

test('un pago rechazado puede aprobarse después con otro intento', () => {
  const g = newGuild();
  const o = order(g.guildId);
  assert.equal(M.settleOrder(o.invoice, 'rejected', { paymentRef: 'P1' }).changed, true);
  assert.equal(C.ConfigManager.getConfig(g.guildId).plan, 'free');
  assert.equal(M.settleOrder(o.invoice, 'paid', { paymentRef: 'P2' }).changed, true);
  assert.equal(M.getOrder(o.invoice)?.status, 'paid');
  assert.equal(C.ConfigManager.getConfig(g.guildId).plan, 'premium');
});

test('un reembolso descuenta los días y deja el servidor en gratis si no le quedan', () => {
  const g = newGuild();
  const o = order(g.guildId);
  M.settleOrder(o.invoice, 'paid', { paymentRef: 'P1' });
  assert.equal(M.settleOrder(o.invoice, 'reversed', { paymentRef: 'P1' }).changed, true);
  const c = C.ConfigManager.getConfig(g.guildId);
  assert.equal(c.plan, 'free');
  assert.equal(c.premiumUntil, undefined);
  // Reversado es final
  assert.equal(M.settleOrder(o.invoice, 'paid', { paymentRef: 'P1' }).changed, false);
});

test('el reembolso de otro pago no toca una orden pagada', () => {
  const g = newGuild();
  const o = order(g.guildId);
  M.settleOrder(o.invoice, 'paid', { paymentRef: 'P1' });
  const first = until(g.guildId);
  assert.equal(M.settleOrder(o.invoice, 'reversed', { paymentRef: 'OTRO' }).changed, false);
  assert.equal(until(g.guildId), first);
});

test('dos órdenes pagadas se acumulan; reembolsar una deja la otra', () => {
  const g = newGuild();
  const a = order(g.guildId, 30);
  const b = order(g.guildId, 90, 40000);
  M.settleOrder(a.invoice, 'paid', { paymentRef: 'A' });
  M.settleOrder(b.invoice, 'paid', { paymentRef: 'B' });
  const both = until(g.guildId);
  M.settleOrder(a.invoice, 'reversed', { paymentRef: 'A' });
  assert.equal(until(g.guildId), both - 30 * DAY);
  assert.equal(C.ConfigManager.getConfig(g.guildId).plan, 'premium');
});

test('pagar con Premium de por vida registra el pago pero no cambia nada', () => {
  const g = newGuild();
  M.grantPremium(g, null, 'dueño');
  const o = order(g.guildId);
  assert.equal(M.settleOrder(o.invoice, 'paid', { paymentRef: 'P1' }).changed, true);
  const c = C.ConfigManager.getConfig(g.guildId);
  assert.equal(c.plan, 'premium');
  assert.equal(c.premiumUntil, undefined);
});

test('normalizeCode acepta el código con o sin guiones, espacios ni prefijo', () => {
  for (const input of ['MASS-ABCD-EFGH', 'mass abcd efgh', 'ABCDEFGH', 'massabcdefgh']) {
    assert.equal(M.normalizeCode(input), 'MASS-ABCD-EFGH', input);
  }
});

test('un código se canjea una vez por servidor y respeta sus usos', () => {
  const [code] = M.createCodes({ days: 7, maxUses: 1, count: 1, actorId: 'dueño' });
  const g1 = newGuild();
  const r = M.redeemCode(code.code.toLowerCase(), g1, 'u1');
  assert.equal(r.days, 7);
  assert.equal(C.ConfigManager.getConfig(g1.guildId).plan, 'premium');

  const g2 = newGuild();
  assert.throws(() => M.redeemCode(code.code, g2, 'u2'), /ya se usó/);
});

test('tras 5 intentos fallidos se bloquea a ese usuario un rato', () => {
  const g = newGuild();
  for (let i = 0; i < 5; i++) assert.throws(() => M.redeemCode('MASS-ZZZZ-ZZZZ', g, 'atacante'), /no existe/);
  assert.throws(() => M.redeemCode('MASS-ZZZZ-ZZZZ', g, 'atacante'), /Demasiados intentos/);
  // Otro usuario no queda bloqueado
  assert.throws(() => M.redeemCode('MASS-ZZZZ-ZZZZ', g, 'otro'), /no existe/);
});
