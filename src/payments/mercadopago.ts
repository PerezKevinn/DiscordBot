/**
 * Cliente mínimo de Mercado Pago (Checkout Pro) para una cuenta de Colombia (COP).
 *
 * Flujo de un pago:
 *  1. El servidor crea una preferencia con el paquete y el número de orden como external_reference.
 *  2. El panel redirige al usuario a init_point, donde paga con tarjeta, PSE, Efecty o saldo.
 *  3. Mercado Pago llama al webhook con el id del pago. El aviso no se da por bueno: se consulta
 *     el pago a la API con nuestro token y solo esa respuesta da o quita Premium. La página de
 *     vuelta (back_urls) solo informa al usuario.
 *
 * Variables de entorno: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET (opcional, valida x-signature) y MP_TEST.
 */
import crypto from 'crypto';
import type { OrderStatus } from '../utils/memberships';

const API = 'https://api.mercadopago.com';

/** Credenciales y modo de Mercado Pago leídos del entorno. */
export interface MercadoPagoEnv {
  accessToken: string;
  /** Clave para validar x-signature; null si no está configurada. */
  webhookSecret: string | null;
  /** Modo prueba: las órdenes se guardan con test=true y el historial las marca como PRUEBA. */
  test: boolean;
}

/** Lee la configuración del entorno. Devuelve null si falta el token (pagos desactivados). */
export function mercadoPagoEnv(): MercadoPagoEnv | null {
  const { MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, MP_TEST } = process.env;
  if (!MP_ACCESS_TOKEN) return null;
  // Modo prueba por defecto: hace falta MP_TEST=false explícito para cobrar de verdad.
  return { accessToken: MP_ACCESS_TOKEN, webhookSecret: MP_WEBHOOK_SECRET || null, test: MP_TEST !== 'false' };
}

// Timeout de 10 s para que una API lenta no deje colgada la petición del panel o del webhook.
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

/**
 * Crea la preferencia de pago y devuelve la URL del checkout (init_point).
 * El número de orden se usa también como clave de idempotencia, así un reintento no duplica la preferencia.
 */
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

/** Campos del pago de la API de Mercado Pago que usa el bot; la respuesta trae muchos más. */
export interface MpPayment {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string | null;
  transaction_amount: number;
  currency_id: string;
  live_mode?: boolean;
}

/** Consulta un pago a la API. Devuelve null si no existe o no es de nuestra cuenta (la API da 404). */
export async function getPayment(env: MercadoPagoEnv, paymentId: string): Promise<MpPayment | null> {
  const res = await mpFetch(env, `/v1/payments/${encodeURIComponent(paymentId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Mercado Pago respondió ${res.status} al consultar el pago ${paymentId}`);
  return (await res.json()) as MpPayment;
}

/**
 * Pagos asociados a una orden (external_reference), del más reciente al más antiguo.
 * Se usa para recuperar pagos cuyo webhook nunca llegó.
 */
export async function searchPayments(env: MercadoPagoEnv, externalReference: string): Promise<MpPayment[]> {
  const qs = new URLSearchParams({ external_reference: externalReference, sort: 'date_created', criteria: 'desc', limit: '10' });
  const res = await mpFetch(env, `/v1/payments/search?${qs}`);
  if (!res.ok) throw new Error(`Mercado Pago respondió ${res.status} al buscar los pagos de ${externalReference}`);
  const data = (await res.json()) as { results?: MpPayment[] };
  return data.results ?? [];
}

/**
 * Comprueba con la API a qué cuenta pertenece el token y si cuadra con MP_TEST y con el país.
 *
 * Los vendedores de prueba tienen tokens APP_USR- igual que los reales y sus pagos llegan con
 * live_mode=true, así que lo único que los distingue es la etiqueta "test_user" de la cuenta.
 *
 * @returns El aviso para el log, o null si todo cuadra.
 */
export async function checkAccount(env: MercadoPagoEnv): Promise<string | null> {
  const res = await mpFetch(env, '/users/me');
  if (!res.ok) return `Mercado Pago rechazó MP_ACCESS_TOKEN al consultar la cuenta (${res.status}): revisa el token.`;
  const me = (await res.json()) as { id?: number; nickname?: string; site_id?: string; tags?: string[] };
  const isTestUser = (me.tags ?? []).includes('test_user');
  const who = `${me.nickname ?? '?'} (id ${me.id ?? '?'})`;
  if (!env.test && isTestUser) {
    return `MP_TEST=false pero MP_ACCESS_TOKEN es de un usuario de prueba, ${who}: los pagos no son reales y quedarían registrados como reales. Usa las credenciales de producción de tu cuenta.`;
  }
  if (env.test && !isTestUser) {
    return `MP_TEST=true pero MP_ACCESS_TOKEN es de una cuenta real, ${who}: los cobros serían de verdad y quedarían marcados como prueba. Pon MP_TEST=false.`;
  }
  if (me.site_id && me.site_id !== 'MCO') return `La cuenta de Mercado Pago ${who} es de ${me.site_id}, no de Colombia (MCO): los pagos en COP fallarían.`;
  console.log(`💳 Mercado Pago: cuenta ${who}${isTestUser ? ' [usuario de prueba]' : ''}, modo ${env.test ? 'prueba' : 'producción'}.`);
  return null;
}

/**
 * Detecta un token de prueba (TEST-...) con MP_TEST=false, que daría Premium por pagos que no son reales.
 * A diferencia de checkAccount, no llama a la API.
 */
export function credentialsMismatch(env: MercadoPagoEnv): string | null {
  if (!env.test && env.accessToken.startsWith('TEST-')) {
    return 'MP_TEST=false pero MP_ACCESS_TOKEN es de prueba (TEST-...): los pagos no serían reales. Usa las credenciales de producción.';
  }
  return null;
}

/**
 * Valida la cabecera x-signature ("ts=...,v1=...") de un webhook:
 * HMAC-SHA256(secret, "id:<data.id>;request-id:<x-request-id>;ts:<ts>;").
 * Las partes que no vienen se omiten del manifiesto, como indica la documentación de Mercado Pago.
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
  // Mercado Pago firma los ids alfanuméricos en minúsculas.
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  // timingSafeEqual lanza si las longitudes difieren, de ahí la comprobación previa.
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** Traduce el estado de un pago de Mercado Pago al de nuestras órdenes. null significa que la orden no cambia. */
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
      return null; // in_mediation y similares: se espera a que se resuelvan.
  }
}
