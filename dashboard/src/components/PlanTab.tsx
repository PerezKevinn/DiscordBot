import { useEffect, useState } from 'react';
import { api } from '../api';
import { cop, EVENT_LABELS, fmtDate, type GuildData, type PremiumPackage } from '../types';
import type { Save } from './GuildPanel';
import { useToast } from './Toast';

type EpaycoGlobal = { checkout: { configure(o: { sessionId: string; type: 'standard' | 'onpage'; test: boolean }): { open(): void } } };

/** Carga el checkout de ePayco solo cuando hace falta. */
function loadEpayco(): Promise<EpaycoGlobal> {
  const w = window as unknown as { ePayco?: EpaycoGlobal };
  if (w.ePayco) return Promise.resolve(w.ePayco);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.epayco.co/checkout-v2.js';
    s.onload = () => (w.ePayco ? resolve(w.ePayco) : reject(new Error('ePayco no cargó')));
    s.onerror = () => reject(new Error('No se pudo cargar el checkout de ePayco'));
    document.head.appendChild(s);
  });
}

const SOURCE_LABEL = { manual: 'Premium concedido', code: 'Código canjeado', payment: 'Premium pagado' } as const;

export function PlanTab({ data, save }: { data: GuildData; save: Save }) {
  const { plan } = data;
  const premium = plan.tier === 'premium';
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const [returning, setReturning] = useState<'waiting' | 'paid' | 'rejected' | 'pending' | null>(null);
  const toast = useToast();
  const lifetime = Boolean(plan.timed && !plan.timed.until);

  // Al volver de ePayco: esperar la confirmación (llega servidor a servidor, puede tardar unos segundos)
  useEffect(() => {
    const invoice = new URLSearchParams(window.location.search).get('pago');
    if (!invoice) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    setReturning('waiting');
    let tries = 0;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      tries++;
      const r = await api.order(data.guild.id, invoice).catch(() => null);
      if (r?.status === 'paid') {
        setReturning('paid');
        void save(() => api.guild(data.guild.id), '¡Pago aprobado! Premium activado');
        return;
      }
      if (r?.status === 'rejected' || r?.status === 'reversed') return setReturning('rejected');
      if (tries >= 40) return setReturning('pending');
      setTimeout(() => void tick(), 3000);
    };
    void tick();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buy = async (pkg: PremiumPackage) => {
    setPaying(pkg.id);
    try {
      const [{ sessionId, test }, ePayco] = await Promise.all([api.checkout(data.guild.id, pkg.id), loadEpayco()]);
      ePayco.checkout.configure({ sessionId, type: 'standard', test }).open();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setPaying(null);
    }
  };

  const redeem = async () => {
    setBusy(true);
    const ok = await save(() => api.redeem(data.guild.id, code.trim()), 'Código canjeado: ¡Premium activado!');
    setBusy(false);
    if (ok) setCode('');
  };

  return (
    <div className="stack">
      <div className="card stack">
        <div className="card-head" style={{ marginBottom: 0 }}>
          <h2 style={{ margin: 0 }}>Tu plan</h2>
          <span className={`badge${premium ? ' premium' : ''}`}>{premium ? '💎 Premium' : 'Plan gratis'}</span>
        </div>

        {premium ? (
          <div className="list">
            {plan.subscription && (
              <div className="list-item">
                <span className="emoji">💳</span>
                <div style={{ flex: 1 }}>
                  <strong>Suscripción de Discord</strong>
                  <div className="muted small">
                    {plan.subscription.endsAt
                      ? `Cancelada: sigue activa hasta el ${fmtDate(plan.subscription.endsAt)}`
                      : 'Activa. Se renueva sola.'}{' '}
                    Quien paga la gestiona en Discord → Ajustes de usuario → Suscripciones.
                  </div>
                </div>
              </div>
            )}
            {plan.timed && (
              <div className="list-item">
                <span className="emoji">🎟️</span>
                <div style={{ flex: 1 }}>
                  <strong>{SOURCE_LABEL[plan.timed.source]}</strong>
                  <div className="muted small">
                    {plan.timed.until ? `Hasta el ${fmtDate(plan.timed.until)}` : 'De por vida'}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Ahora tienes {plan.limits.maxActivePings} pings abiertos a la vez y {plan.limits.maxContentTypes} contenidos. Con
            Premium tienes más de ambos, marca y logo propios y pings sin el pie del bot.
          </p>
        )}

        {plan.storeUrl && !plan.subscription && (
          <div className="row">
            <a className="btn btn-primary" href={plan.storeUrl} target="_blank" rel="noopener">
              💎 Suscribirse a Premium
            </a>
            <span className="muted small">El pago lo gestiona Discord. También puedes usar <code>/plan</code> en tu servidor.</span>
          </div>
        )}
      </div>

      {returning && (
        <p className="notice">
          {returning === 'waiting' && '⏳ Esperando la confirmación de ePayco… Puede tardar unos segundos.'}
          {returning === 'paid' && '✅ Pago aprobado. Tu Premium ya está activo.'}
          {returning === 'rejected' && '❌ El pago no se aprobó. No se te cobró; puedes intentarlo de nuevo.'}
          {returning === 'pending' &&
            '⏳ El pago sigue pendiente (por ejemplo, PSE o efectivo). Cuando ePayco lo confirme, el Premium se activa solo.'}
        </p>
      )}

      {plan.payments && (
        <div className="card stack">
          <div className="card-head" style={{ marginBottom: 0 }}>
            <h2 style={{ margin: 0 }}>{premium ? 'Añadir tiempo de Premium' : 'Comprar Premium'}</h2>
            {plan.payments.test && <span className="badge">Modo prueba</span>}
          </div>
          <p className="muted" style={{ margin: 0 }}>
            Pago único con tarjeta, PSE, Nequi o efectivo a través de ePayco. Los días se suman al Premium que ya tengas; no hay
            renovación automática, te avisamos antes de que venza.
          </p>
          {lifetime ? (
            <p className="muted" style={{ margin: 0 }}>Este servidor ya tiene Premium de por vida.</p>
          ) : (
            <div className="packages">
              {plan.payments.packages.map((p) => {
                const monthly = Math.round(p.priceCop / (p.days / 30));
                return (
                  <div key={p.id} className="package">
                    <strong>{p.label}</strong>
                    <div className="package-price">{cop(p.priceCop)}</div>
                    <div className="muted small">{p.days > 30 ? `${cop(monthly)} al mes` : `${p.days} días`}</div>
                    <button className="btn-primary" disabled={paying !== null} onClick={() => void buy(p)}>
                      {paying === p.id ? 'Abriendo…' : 'Pagar'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="card stack">
        <h2 style={{ margin: 0 }}>Canjear un código</h2>
        <p className="muted" style={{ margin: 0 }}>Si tienes un código de Premium, se suma al tiempo que ya tengas.</p>
        <div className="row">
          <input
            value={code}
            placeholder="MASS-XXXX-XXXX"
            maxLength={32}
            style={{ maxWidth: 260, fontFamily: 'monospace', textTransform: 'uppercase' }}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && code.trim().length >= 8 && !busy && void redeem()}
          />
          <button className="btn-primary" disabled={code.trim().length < 8 || busy} onClick={() => void redeem()}>
            Canjear
          </button>
        </div>
      </div>

      {plan.history.length > 0 && (
        <div className="card">
          <h2>Historial</h2>
          <div className="list">
            {plan.history.map((e, i) => (
              <div key={i} className="list-item">
                <div style={{ flex: 1 }}>
                  <strong>{EVENT_LABELS[e.type]}</strong>
                  {e.days !== undefined && e.type !== 'revoke' && (
                    <span className="muted"> · {e.days === null ? 'de por vida' : `${e.days} días`}</span>
                  )}
                  {e.code && <span className="muted small"> · {e.code}</span>}
                </div>
                <span className="muted small">{fmtDate(e.at, true)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
