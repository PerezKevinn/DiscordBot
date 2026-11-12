import crypto from 'crypto';
import type { OrderStatus } from '../utils/memberships';

/**
 * Cliente mínimo de Mercado Pago (Checkout Pro), cuenta de Colombia (COP).
 *
 *  1. El servidor crea una "preferencia" con el paquete y nuestra referencia (external_reference).
 *  2. El panel redirige al usuario a init_point: ahí paga con tarjeta, PSE, Efecty o saldo MP.
 *  3. Mercado Pago avisa a nuestro webhook con el id del pago. NO nos fiamos del aviso:
 *     consultamos el pago a la API con nuestro token y solo eso da (o quita) Premium.
 *     La página de vuelta (back_urls) solo informa.
 *
 * Variables: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET (opcional, valida x-signature), MP_TEST.
 */

const API = 'https://api.mercadopago.com';

export interface MercadoPagoEnv {
  accessToken: string;
  webhookSecret: string | null;
  test: boolean;
}

export function mercadoPagoEnv(): MercadoPagoEnv | null {
  const { MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, MP_TEST } = process.env;
  if (!MP_ACCESS_TOKEN) return null;
  // Por seguridad, modo prueba salvo que se diga explícitamente que no
  return { accessToken: MP_ACCESS_TOKEN, webhookSecret: MP_WEBHOOK_SECRET || null, test: MP_TEST !== 'false' };
}

async function mpFetch(env: MercadoPagoEnv, path: string, init: RequestInit = {}) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.accessToken}`,
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(10_000),
  });
}

/** Crea la preferencia de pago y devuelve la URL del checkout. */
export async function createPreference(
  env: MercadoPagoEnv,
  p: { invoice: string; title: string; description: string; amount: number; returnUrl: string; notificationUrl: string }
): Promise<string> {
  const body = {
    items: [
      {
        id: p.invoice,
        title: p.title,
        description: p.description,
        quantity: 1,
        currency_id: 'COP',
        unit_price: p.amount,
      },
    ],
    external_reference: p.invoice,
    back_urls: { success: p.returnUrl, pending: p.returnUrl, failure: p.returnUrl },
    auto_return: 'approved',
    notification_url: p.notificationUrl,
  };
  const res = await mpFetch(env, '/checkout/preferences', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': p.invoice },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { init_point?: string; message?: string };
  if (!res.ok || !data.init_point) {
    throw new Error(`Mercado Pago no creó la preferencia (${res.status}${data.message ? `: ${data.message}` : ''})`);
  }
  return data.init_point;
}

export interface MpPayment {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string | null;
  transaction_amount: number;
  currency_id: string;
  live_mode?: boolean;
}

/** Consulta un pago a la API. Solo devuelve pagos de nuestra cuenta (404 si no es nuestro). */
export async function getPayment(env: MercadoPagoEnv, paymentId: string): Promise<MpPayment | null> {
  const res = await mpFetch(env, `/v1/payments/${encodeURIComponent(paymentId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Mercado Pago respondió ${res.status} al consultar el pago ${paymentId}`);
  return (await res.json()) as MpPayment;
}

/**
 * Valida la cabecera x-signature ("ts=...,v1=...") de un webhook:
 * HMAC-SHA256(secret, "id:<data.id>;request-id:<x-request-id>;ts:<ts>;").
 * Las partes que no vienen se omiten del manifiesto.
 */
export function isValidSignature(secret: string, signature: string, requestId: string | undefined, dataId: string): boolean {
  const parts = Object.fromEntries(
    signature.split(',').map((kv) => {
      const [k, ...v] = kv.split('=');
      return [k.trim(), v.join('=').trim()];
    })
  );
  const ts = parts.ts;
  const given = (parts.v1 ?? '').toLowerCase();
  if (!ts || !given) return false;
  let manifest = '';
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** Traduce el estado de un pago de Mercado Pago al de nuestras órdenes (null = no cambia nada). */
export function mapStatus(status: string): Exclude<OrderStatus, 'created'> | null {
  switch (status) {
    case 'approved':
      return 'paid';
    case 'pending':
    case 'in_process':
    case 'authorized':
      return 'pending';
    case 'rejected':
    case 'cancelled':
      return 'rejected';
    case 'refunded':
    case 'charged_back':
      return 'reversed';
    default:
      return null; // in_mediation, etc.: se espera a que se resuelva
  }
}
