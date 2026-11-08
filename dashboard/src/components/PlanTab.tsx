import { useState } from 'react';
import { api } from '../api';
import { EVENT_LABELS, fmtDate, type GuildData } from '../types';
import type { Save } from './GuildPanel';

export function PlanTab({ data, save }: { data: GuildData; save: Save }) {
  const { plan } = data;
  const premium = plan.tier === 'premium';
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

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
                  <strong>{plan.timed.source === 'code' ? 'Código canjeado' : 'Premium concedido'}</strong>
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
