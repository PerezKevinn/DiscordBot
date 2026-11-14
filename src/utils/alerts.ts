import { Client, Events } from 'discord.js';

/**
 * Avisos de errores a un canal privado de Discord mediante un webhook (ALERT_WEBHOOK_URL).
 * Sin esa variable solo se escriben en el log, como antes.
 *
 * - Nunca lanza: un fallo al avisar no debe tumbar el bot.
 * - Agrupa errores repetidos (el mismo mensaje solo se avisa una vez cada 10 min)
 *   y pone un tope de avisos para no saturar el canal si algo entra en bucle.
 */

const REPEAT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ALERTS_PER_WINDOW = 15;
const recent = new Map<string, number>();
let windowStart = 0;
let sentInWindow = 0;
let suppressed = 0;

function webhookUrl(): string | null {
  const url = process.env.ALERT_WEBHOOK_URL?.trim();
  return url && /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url) ? url : null;
}

function describe(err: unknown): { message: string; detail: string } {
  if (err instanceof Error) return { message: err.message || err.name, detail: err.stack ?? `${err.name}: ${err.message}` };
  const text = typeof err === 'string' ? err : JSON.stringify(err) ?? String(err);
  return { message: text, detail: text };
}

async function post(payload: object) {
  const url = webhookUrl();
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'MassUp · Alertas', allowed_mentions: { parse: [] }, ...payload }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.warn('[Alertas] No se pudo enviar el aviso a Discord:', (e as Error).message);
  }
}

/** Registra el error en el log y, si hay webhook, avisa en Discord. */
export async function reportError(context: string, err: unknown): Promise<void> {
  console.error(`❌ [${context}]`, err);
  if (!webhookUrl()) return;

  const { message, detail } = describe(err);
  const now = Date.now();
  const key = `${context}|${message}`.slice(0, 300);
  const last = recent.get(key);
  if (last && now - last < REPEAT_WINDOW_MS) return;
  recent.set(key, now);
  for (const [k, at] of recent) if (now - at > REPEAT_WINDOW_MS) recent.delete(k);

  if (now - windowStart > REPEAT_WINDOW_MS) {
    if (suppressed > 0) {
      void post({ content: `⚠️ Se omitieron ${suppressed} avisos más en los últimos 10 minutos. Revisa \`pm2 logs massup\`.` });
    }
    windowStart = now;
    sentInWindow = 0;
    suppressed = 0;
  }
  if (sentInWindow >= MAX_ALERTS_PER_WINDOW) {
    suppressed++;
    return;
  }
  sentInWindow++;

  await post({
    embeds: [
      {
        color: 0xe5484d,
        title: `Error · ${context}`.slice(0, 256),
        description: '```\n' + detail.slice(0, 3800).replace(/```/g, "'''") + '\n```',
        timestamp: new Date(now).toISOString(),
      },
    ],
  });
}

/** Aviso informativo (arranques, etc.). */
export async function reportInfo(text: string): Promise<void> {
  console.log(`ℹ️ ${text}`);
  await post({ content: text.slice(0, 1900) });
}

/**
 * Captura los errores que se escaparían sin control. Una excepción no capturada deja el
 * proceso en un estado dudoso: se avisa y se sale para que pm2 lo reinicie limpio.
 */
export function installErrorHandlers(client: Client) {
  process.on('unhandledRejection', (reason) => {
    void reportError('Promesa rechazada sin capturar', reason);
  });
  process.on('uncaughtException', (err) => {
    const exit = () => process.exit(1);
    setTimeout(exit, 4000).unref();
    void reportError('Excepción no capturada (el bot se reinicia)', err).finally(exit);
  });
  client.on(Events.Error, (err) => void reportError('Cliente de Discord', err));
  client.on(Events.ShardError, (err, shardId) => void reportError(`Conexión con Discord (shard ${shardId})`, err));
  client.on(Events.Warn, (msg) => console.warn('[Discord]', msg));
}
