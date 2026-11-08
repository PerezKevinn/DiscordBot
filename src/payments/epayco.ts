import crypto from 'crypto';
import { OrderStatus } from '../utils/memberships';

/**
 * Cliente mínimo de ePayco (Smart Checkout).
 *
 *  1. El servidor pide un token a APIFY con PUBLIC_KEY:PRIVATE_KEY y crea una sesión de pago.
 *  2. El panel abre el checkout de ePayco con ese sessionId (checkout-v2.js).
 *  3. ePayco llama a nuestra URL de confirmación con el resultado, firmado con SHA-256.
 *     Esa llamada es la ÚNICA que da Premium: la página de respuesta solo informa.
 *
 * Variables: EPAYCO_PUBLIC_KEY, EPAYCO_PRIVATE_KEY, EPAYCO_CUST_ID, EPAYCO_P_KEY, EPAYCO_TEST.
 */

const APIFY = 'https://apify.epayco.co';

export interface EpaycoEnv {
  publicKey: string;
  privateKey: string;
  custId: string;
  pKey: string;
  test: boolean;
}

export function epaycoEnv(): EpaycoEnv | null {
  const { EPAYCO_PUBLIC_KEY, EPAYCO_PRIVATE_KEY, EPAYCO_CUST_ID, EPAYCO_P_KEY, EPAYCO_TEST } = process.env;
  if (!EPAYCO_PUBLIC_KEY || !EPAYCO_PRIVATE_KEY || !EPAYCO_CUST_ID || !EPAYCO_P_KEY) return null;
  // Por seguridad, modo prueba salvo que se diga explícitamente que no
  return { publicKey: EPAYCO_PUBLIC_KEY, privateKey: EPAYCO_PRIVATE_KEY, custId: EPAYCO_CUST_ID, pKey: EPAYCO_P_KEY, test: EPAYCO_TEST !== 'false' };
}

// El token de APIFY dura unos 20 min: lo reutilizamos 15
let cachedToken: { value: string; at: number } | null = null;

async function apifyToken(env: EpaycoEnv): Promise<string> {
  if (cachedToken && Date.now() - cachedToken.at < 15 * 60 * 1000) return cachedToken.value;
  const res = await fetch(`${APIFY}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${env.publicKey}:${env.privateKey}`).toString('base64')}`,
    },
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as { token?: string };
  if (!res.ok || !data.token) throw new Error(`ePayco login respondió ${res.status}`);
  cachedToken = { value: data.token, at: Date.now() };
  return data.token;
}

export async function createCheckoutSession(
  env: EpaycoEnv,
  p: { invoice: string; name: string; description: string; amount: number; responseUrl: string; confirmationUrl: string; extras: Record<string, string> }
): Promise<string> {
  const body = {
    checkout_version: '2',
    name: p.name,
    description: p.description,
    invoice: p.invoice,
    currency: 'COP',
    amount: p.amount,
    taxBase: 0,
    tax: 0,
    taxIco: 0,
    country: 'CO',
    lang: 'ES',
    response: p.responseUrl,
    confirmation: p.confirmationUrl,
    method: 'POST',
    extras: p.extras,
  };
  const send = async (token: string) =>
    fetch(`${APIFY}/payment/session/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

  let res = await send(await apifyToken(env));
  if (res.status === 401) {
    cachedToken = null; // token vencido antes de tiempo
    res = await send(await apifyToken(env));
  }
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; data?: { sessionId?: string }; textResponse?: string };
  if (!res.ok || !data.success || !data.data?.sessionId) {
    throw new Error(`ePayco no creó la sesión (${res.status}${data.textResponse ? `: ${data.textResponse}` : ''})`);
  }
  return data.data.sessionId;
}

/** Firma de la confirmación: SHA256(cust_id^p_key^x_ref_payco^x_transaction_id^x_amount^x_currency_code). */
export function confirmationSignature(env: EpaycoEnv, f: Record<string, string>): string {
  return crypto
    .createHash('sha256')
    .update([env.custId, env.pKey, f.x_ref_payco, f.x_transaction_id, f.x_amount, f.x_currency_code].join('^'))
    .digest('hex');
}

export function isValidSignature(env: EpaycoEnv, f: Record<string, string>): boolean {
  const given = (f.x_signature ?? '').toLowerCase();
  const expected = confirmationSignature(env, f);
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** Traduce el estado de ePayco al de nuestras órdenes (null = no cambia nada). */
export function mapState(f: Record<string, string>): Exclude<OrderStatus, 'created'> | null {
  const code = Number(f.x_cod_transaction_state || f.x_cod_response || f.x_cod_respuesta);
  const text = (f.x_response || f.x_transaction_state || '').toLowerCase();
  if (code === 1 || text === 'aceptada') return 'paid';
  if (code === 6 || text === 'reversada') return 'reversed';
  if ([3, 7, 8].includes(code) || text === 'pendiente') return 'pending';
  if ([2, 4, 9, 10, 11].includes(code) || ['rechazada', 'fallida', 'caducada', 'abandonada', 'cancelada'].includes(text)) return 'rejected';
  return null;
}
