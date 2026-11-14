import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { credentialsMismatch, isValidSignature, mapStatus, searchPayments } from './mercadopago';

const SECRET = 'clave-de-prueba';

/** Firma como lo hace Mercado Pago: HMAC-SHA256 del manifiesto "id:..;request-id:..;ts:..;" */
function sign(manifest: string, ts = '1731500000') {
  const v1 = crypto.createHmac('sha256', SECRET).update(manifest).digest('hex');
  return `ts=${ts},v1=${v1}`;
}

test('mapStatus traduce los estados de pago a los de la orden', () => {
  assert.equal(mapStatus('approved'), 'paid');
  for (const s of ['pending', 'in_process', 'authorized']) assert.equal(mapStatus(s), 'pending');
  for (const s of ['rejected', 'cancelled']) assert.equal(mapStatus(s), 'rejected');
  for (const s of ['refunded', 'charged_back']) assert.equal(mapStatus(s), 'reversed');
  assert.equal(mapStatus('in_mediation'), null);
  assert.equal(mapStatus('lo-que-sea'), null);
});

test('isValidSignature acepta una firma correcta', () => {
  const sig = sign('id:123456;request-id:req-1;ts:1731500000;');
  assert.equal(isValidSignature(SECRET, sig, 'req-1', '123456'), true);
});

test('isValidSignature pasa a minúsculas los ids alfanuméricos', () => {
  const sig = sign('id:abc123;request-id:req-1;ts:1731500000;');
  assert.equal(isValidSignature(SECRET, sig, 'req-1', 'ABC123'), true);
});

test('isValidSignature omite del manifiesto las partes que no vienen', () => {
  const sig = sign('id:123456;ts:1731500000;');
  assert.equal(isValidSignature(SECRET, sig, undefined, '123456'), true);
});

test('isValidSignature rechaza firmas manipuladas o con otra clave', () => {
  const sig = sign('id:123456;request-id:req-1;ts:1731500000;');
  assert.equal(isValidSignature(SECRET, sig, 'req-1', '999999'), false, 'otro pago');
  assert.equal(isValidSignature(SECRET, sig, 'req-2', '123456'), false, 'otro request-id');
  assert.equal(isValidSignature('otra-clave', sig, 'req-1', '123456'), false, 'otra clave');
  assert.equal(isValidSignature(SECRET, sig.replace('ts=1731500000', 'ts=1731500001'), 'req-1', '123456'), false, 'otro ts');
});

test('isValidSignature rechaza cabeceras mal formadas sin lanzar', () => {
  for (const bad of ['', 'basura', 'ts=1', 'v1=abc', 'ts=1,v1=corta']) {
    assert.equal(isValidSignature(SECRET, bad, 'req-1', '123456'), false, bad);
  }
});

test('credentialsMismatch avisa de un token de prueba con MP_TEST=false', () => {
  assert.match(credentialsMismatch({ accessToken: 'TEST-123', webhookSecret: null, test: false }) ?? '', /de prueba/);
  assert.equal(credentialsMismatch({ accessToken: 'APP_USR-123', webhookSecret: null, test: false }), null);
  assert.equal(credentialsMismatch({ accessToken: 'TEST-123', webhookSecret: null, test: true }), null);
});

test('searchPayments busca por la referencia de la orden y devuelve los resultados', async () => {
  const realFetch = globalThis.fetch;
  let called = '';
  globalThis.fetch = (async (url: string) => {
    called = String(url);
    return new Response(JSON.stringify({ results: [{ id: 1, status: 'approved' }] }), { status: 200 });
  }) as typeof fetch;
  try {
    const r = await searchPayments({ accessToken: 'APP_USR-1', webhookSecret: null, test: false }, 'MU-ABC');
    assert.equal(r.length, 1);
    assert.match(called, /\/v1\/payments\/search\?external_reference=MU-ABC/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
