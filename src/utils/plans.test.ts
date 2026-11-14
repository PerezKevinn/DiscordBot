import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { getEffectiveTier, hasActiveSubscription, hasTimedPremium, premiumEndsAt, premiumPackages } from './plans';
import type { GuildConfig } from '../types/ping';

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;
const cfg = (c: Partial<GuildConfig>) => ({ plan: 'free', ...c }) as GuildConfig;

test('gratis sin nada', () => {
  const c = cfg({});
  assert.equal(getEffectiveTier(c, NOW), 'free');
  assert.equal(premiumEndsAt(c, NOW), undefined);
});

test('Premium por tiempo vigente y vencido', () => {
  const vigente = cfg({ plan: 'premium', premiumUntil: NOW + DAY });
  assert.equal(hasTimedPremium(vigente, NOW), true);
  assert.equal(getEffectiveTier(vigente, NOW), 'premium');
  assert.equal(premiumEndsAt(vigente, NOW), NOW + DAY);

  const vencido = cfg({ plan: 'premium', premiumUntil: NOW - 1 });
  assert.equal(hasTimedPremium(vencido, NOW), false);
  assert.equal(getEffectiveTier(vencido, NOW), 'free');
});

test('Premium de por vida no vence', () => {
  const c = cfg({ plan: 'premium' });
  assert.equal(getEffectiveTier(c, NOW), 'premium');
  assert.equal(premiumEndsAt(c, NOW), null);
});

test('suscripción de Discord: activa, cancelada con fecha de fin y terminada', () => {
  const sub = (s: object) => cfg({ subscription: { entitlementId: '1', userId: '2', active: true, updatedAt: NOW, ...s } as GuildConfig['subscription'] });
  assert.equal(premiumEndsAt(sub({}), NOW), null, 'se renueva sola');
  assert.equal(premiumEndsAt(sub({ endsAt: NOW + 5 * DAY }), NOW), NOW + 5 * DAY, 'cancelada');
  assert.equal(hasActiveSubscription(sub({ endsAt: NOW - 1 }), NOW), false, 'ya terminó');
  assert.equal(getEffectiveTier(sub({ active: false }), NOW), 'free');
});

test('con suscripción y tiempo a la vez, vence en la fecha más lejana', () => {
  const c = cfg({
    plan: 'premium',
    premiumUntil: NOW + 10 * DAY,
    subscription: { entitlementId: '1', userId: '2', active: true, endsAt: NOW + 3 * DAY, updatedAt: NOW } as GuildConfig['subscription'],
  });
  assert.equal(premiumEndsAt(c, NOW), NOW + 10 * DAY);
});

const savedEnv = { ...process.env };
afterEach(() => {
  for (const k of ['PREMIUM_PRICE_1M', 'PREMIUM_PRICE_3M', 'PREMIUM_PRICE_12M']) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

test('paquetes: precios por defecto y personalizados', () => {
  delete process.env.PREMIUM_PRICE_1M;
  delete process.env.PREMIUM_PRICE_3M;
  delete process.env.PREMIUM_PRICE_12M;
  assert.deepEqual(
    premiumPackages().map((p) => [p.id, p.days, p.priceCop]),
    [
      ['1m', 30, 15000],
      ['3m', 90, 40000],
      ['12m', 365, 150000],
    ]
  );
  process.env.PREMIUM_PRICE_1M = '20000';
  process.env.PREMIUM_PRICE_3M = '12.5'; // no entero: se ignora
  process.env.PREMIUM_PRICE_12M = '500'; // menos de 1000: se ignora
  assert.deepEqual(premiumPackages().map((p) => p.priceCop), [20000, 40000, 150000]);
});
