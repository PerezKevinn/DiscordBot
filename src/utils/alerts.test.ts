import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { reportError } from './alerts';

const calls: Array<{ url: string; body: { embeds?: Array<{ title: string; description: string }>; content?: string } }> = [];
const realFetch = globalThis.fetch;
const realError = console.error;
const URL_OK = 'https://discord.com/api/webhooks/123456789/abc-DEF_ghi';

before(() => {
  console.error = () => {}; // los tests provocan errores a propósito
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
});

after(() => {
  globalThis.fetch = realFetch;
  console.error = realError;
  delete process.env.ALERT_WEBHOOK_URL;
});

test('sin ALERT_WEBHOOK_URL no envía nada', async () => {
  delete process.env.ALERT_WEBHOOK_URL;
  await reportError('Prueba', new Error('sin webhook'));
  assert.equal(calls.length, 0);
});

test('ignora URLs que no son webhooks de Discord', async () => {
  process.env.ALERT_WEBHOOK_URL = 'https://ejemplo.com/api/webhooks/1/x';
  await reportError('Prueba', new Error('url rara'));
  assert.equal(calls.length, 0);
});

test('envía el error con su contexto y no repite el mismo error seguido', async () => {
  process.env.ALERT_WEBHOOK_URL = URL_OK;
  await reportError('Panel GET /api/x', new Error('se rompió algo'));
  await reportError('Panel GET /api/x', new Error('se rompió algo'));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, URL_OK);
  assert.equal(calls[0].body.embeds?.[0].title, 'Error · Panel GET /api/x');
  assert.match(calls[0].body.embeds?.[0].description ?? '', /se rompió algo/);

  await reportError('Panel GET /api/x', new Error('otro error distinto'));
  assert.equal(calls.length, 2);
});

test('pone un tope de avisos si algo entra en bucle', async () => {
  process.env.ALERT_WEBHOOK_URL = URL_OK;
  const before = calls.length;
  for (let i = 0; i < 50; i++) await reportError('Bucle', new Error(`fallo ${i}`));
  assert.ok(calls.length - before <= 15, `envió ${calls.length - before}`);
});
