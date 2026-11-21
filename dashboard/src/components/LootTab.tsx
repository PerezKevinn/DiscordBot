/**
 * Pestaña "Reparto de loot": ajustes por defecto (recargo del gremio, pago al vendedor, redondeo y
 * rol de tesorería), salidas sin repartir e historial con los pagos. El reparto se crea en Discord
 * (botón 💰 del Mando o /loot repartir), donde también se importa el log del loot logger.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { fmtDate } from '../types';
import type { GuildData, LootData, LootSettings } from '../types';
import { useToast } from './Toast';

type Run = (fn: () => Promise<LootData>, okText?: string) => Promise<boolean>;

const ROUND_OPTIONS = [1, 100, 1000, 10000, 100000];
const MAX_PCT = 90;

/** Plata con separador de miles, como en el bot: 12.500.000. */
const silver = (n: number) => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const pct = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

/** Carga los repartos de loot del servidor y muestra sus secciones. */
export function LootTab({ data }: { data: GuildData }) {
  const guildId = data.guild.id;
  const [loot, setLoot] = useState<LootData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    api.loot(guildId).then(setLoot, (e: Error) => setError(e.message));
  }, [guildId]);

  const run: Run = useCallback(
    async (fn, okText = 'Guardado') => {
      try {
        setLoot(await fn());
        toast(okText);
        return true;
      } catch (e) {
        toast((e as Error).message, true);
        return false;
      }
    },
    [toast]
  );

  if (error) return <div className="card empty"><p>{error}</p></div>;
  if (!loot) return <p className="muted">Cargando repartos…</p>;

  return (
    <div className="stack">
      <SettingsCard loot={loot} data={data} run={run} />
      {loot.settings.enabled && (
        <>
          <PendingCard loot={loot} />
          <HistoryCard loot={loot} run={run} guildId={guildId} />
        </>
      )}
    </div>
  );
}

function SettingsCard({ loot, data, run }: { loot: LootData; data: GuildData; run: Run }) {
  const [s, setS] = useState<LootSettings>(loot.settings);
  useEffect(() => setS(loot.settings), [loot.settings]);
  const dirty = JSON.stringify(s) !== JSON.stringify(loot.settings);
  const valid = s.guildTaxPct >= 0 && s.sellerPct >= 0 && s.guildTaxPct + s.sellerPct <= MAX_PCT;
  const num = (v: string) => Math.round(Math.max(0, Number(v.replace(',', '.')) || 0) * 100) / 100;

  return (
    <div className="card stack">
      <div className="card-head">
        <h2 style={{ margin: 0 }}>Reparto de loot</h2>
        <label className="row small" style={{ gap: 8 }}>
          <input type="checkbox" style={{ width: 18, height: 18 }} checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} />
          Activado
        </label>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        Al terminar una salida (GG), el Caller pulsa <strong>💰 Repartir loot</strong> en el Mando (o usa <code>/loot repartir</code>), escribe el total de plata
        que sacaron al vender y el bot lo reparte <strong>a partes iguales</strong> entre los que fueron, después de los descuentos. Los jugadores ven lo que les
        deben con <code>/loot pendientes</code>. Estos son los valores por defecto; el Caller puede cambiarlos en cada reparto.
      </p>
      {s.enabled && (
        <>
          <div className="grid-2">
            <label className="field">
              Recargo del gremio (%)
              <input type="number" min={0} max={MAX_PCT} step={0.5} value={s.guildTaxPct} onChange={(e) => setS({ ...s, guildTaxPct: num(e.target.value) })} />
              <span className="muted small">Lo que se queda el banco del gremio, sobre el total menos reparaciones.</span>
            </label>
            <label className="field">
              Pago al vendedor (%)
              <input type="number" min={0} max={MAX_PCT} step={0.5} value={s.sellerPct} onChange={(e) => setS({ ...s, sellerPct: num(e.target.value) })} />
              <span className="muted small">Para quien vende el loot en el mercado, además de su parte.</span>
            </label>
            <label className="field">
              Redondear cada parte a
              <select value={s.roundTo} onChange={(e) => setS({ ...s, roundTo: Number(e.target.value) })}>
                {ROUND_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r === 1 ? 'Sin redondeo (1 de plata)' : `${silver(r)} de plata`}</option>
                ))}
              </select>
              <span className="muted small">Se redondea hacia abajo; lo que sobra va al gremio.</span>
            </label>
            <label className="field">
              Rol de tesorería
              <select value={s.managerRoleId ?? ''} onChange={(e) => setS({ ...s, managerRoleId: e.target.value || null })}>
                <option value="">Ninguno</option>
                {data.discord.roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <span className="muted small">Puede repartir, editar y marcar pagos en cualquier salida. El Caller y los oficiales ya pueden.</span>
            </label>
          </div>
          {!valid && <p className="notice">El recargo y el pago al vendedor juntos no pueden pasar del {MAX_PCT} %.</p>}
          <p className="muted small" style={{ margin: 0 }}>
            📄 <strong>Loot logger</strong>{loot.pro ? '' : ' (💎 Premium)'}: en el editor de Discord, <strong>Importar log</strong> lee el archivo de AO Loot Logger y
            muestra quién tiene cada ítem y quién looteó sin estar en el reparto. Explica cómo instalarlo a tus Callers con <code>/loot guia publicar:true</code>.
          </p>
        </>
      )}
      <div className="row">
        <span className="spacer" />
        <button className="btn-primary" disabled={!dirty || !valid} onClick={() => void run(() => api.saveLootSettings(data.guild.id, s))}>
          Guardar
        </button>
      </div>
    </div>
  );
}

function PendingCard({ loot }: { loot: LootData }) {
  return (
    <div className="card stack">
      <div className="card-head">
        <h2 style={{ margin: 0 }}>Salidas sin repartir{loot.pending.length ? ` (${loot.pending.length})` : ''}</h2>
        <span className="muted small">Terminadas con GG en los últimos 3 días</span>
      </div>
      {loot.pending.length === 0 ? (
        <p className="empty">No hay salidas terminadas sin reparto.</p>
      ) : (
        <>
          <div className="list">
            {loot.pending.map((p) => (
              <div key={p.pingId} className="list-item">
                <div style={{ flex: 1, minWidth: 200 }}>
                  <strong>{p.title}</strong> <span className="badge">Sin repartir</span>
                  <div className="muted small">{p.contentName} · Caller {p.callerName} · terminó {fmtDate(p.closedAt, true)}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="muted small" style={{ margin: 0 }}>Se reparten desde Discord: <code>/loot repartir</code> o el botón 💰 del Mando.</p>
        </>
      )}
    </div>
  );
}

function HistoryCard({ loot, run, guildId }: { loot: LootData; run: Run; guildId: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const remove = (id: string, title: string) => {
    if (!window.confirm(`¿Borrar el reparto de “${title}”? También se borra su mensaje en Discord. No se puede deshacer.`)) return;
    void run(() => api.deleteLootSplit(guildId, id), 'Reparto borrado');
  };
  return (
    <div className="card stack">
      <div className="card-head">
        <h2 style={{ margin: 0 }}>Historial</h2>
        <div className="row" style={{ gap: 8 }}>
          <span className="muted small">{loot.historyDays ? `Últimos ${loot.historyDays} días (Premium: todo)` : 'Todo el historial'}</span>
          {loot.pro ? (
            <a className="btn btn-sm" href={api.lootCsvUrl(guildId)} download>Exportar CSV</a>
          ) : (
            <button className="btn-sm" disabled title="Premium">Exportar CSV 💎</button>
          )}
        </div>
      </div>
      {loot.splits.length === 0 ? (
        <p className="empty">Todavía no hay repartos.</p>
      ) : (
        <div className="list">
          {loot.splits.map((s) => {
            const paid = s.members.filter((m) => m.paid).length;
            const b = s.breakdown;
            return (
              <div key={s.id} className="list-item" style={{ flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <strong>{s.title}</strong>{' '}
                  <span className={`badge${paid === s.members.length ? ' premium' : ''}`}>{paid === s.members.length ? 'Pagado' : `${paid}/${s.members.length} pagados`}</span>
                  <div className="muted small">
                    {fmtDate(s.at, true)} · {silver(b.total)} de plata → <strong>{silver(b.perPlayer)}</strong> c/u · {b.players} jugadores
                    {s.byName && ` · por ${s.byName}`}
                  </div>
                </div>
                <button className="btn-sm btn-ghost" onClick={() => setOpen(open === s.id ? null : s.id)}>{open === s.id ? 'Ocultar' : 'Detalle'}</button>
                {s.messageUrl && <a className="btn btn-sm btn-ghost" href={s.messageUrl} target="_blank" rel="noreferrer">Ver en Discord</a>}
                <button className="btn-sm btn-danger" onClick={() => remove(s.id, s.title)}>Borrar</button>
                {open === s.id && (
                  <div className="stack small" style={{ width: '100%', marginTop: 8 }}>
                    <div className="muted">
                      Total {silver(b.total)}
                      {b.repairs > 0 && ` − reparaciones ${silver(b.repairs)}${s.repairsName ? ` (${s.repairsName})` : ''}`}
                      {s.guildTaxPct > 0 && ` − gremio ${pct(s.guildTaxPct)} % (${silver(b.guildTax)})`}
                      {s.sellerPct > 0 && ` − vendedor ${pct(s.sellerPct)} % (${silver(b.sellerFee)}${s.sellerName ? `, ${s.sellerName}` : ''})`}
                      {` = ${silver(b.net)} a repartir.`}
                      {b.remainder > 0 && ` Sobrante del redondeo al gremio: ${silver(b.remainder)}.`}
                    </div>
                    <div className="list">
                      {s.members.map((m) => (
                        <label key={m.userId} className="list-item" style={{ gap: 10 }}>
                          <input
                            type="checkbox"
                            style={{ width: 18, height: 18 }}
                            checked={m.paid}
                            onChange={(e) => void run(() => api.setLootPaid(guildId, s.id, m.userId, e.target.checked), e.target.checked ? 'Marcado como pagado' : 'Marcado como pendiente')}
                          />
                          <span style={{ flex: 1 }}>{m.name}</span>
                          <strong>{silver(m.amount)}</strong>
                        </label>
                      ))}
                    </div>
                    {s.looters.length > 0 && (
                      <div className="muted">📦 Loot según el log: {s.looters.map((l) => `${l.name} (${l.count})`).join(' · ')}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
