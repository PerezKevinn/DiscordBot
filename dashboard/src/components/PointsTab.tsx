import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { fmtDate, PERIOD_LABEL } from '../types';
import type { GuildData, PointsData, PointsEditor, RankingPeriod } from '../types';
import { useToast } from './Toast';

type Run = (fn: () => Promise<PointsData>, okText?: string) => Promise<boolean>;

const MEDALS = ['🥇', '🥈', '🥉'];

export function PointsTab({ data }: { data: GuildData }) {
  const guildId = data.guild.id;
  const [period, setPeriod] = useState<RankingPeriod>('total');
  const [points, setPoints] = useState<PointsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<{ userId: string; name: string } | null>(null);
  const toast = useToast();

  useEffect(() => {
    api.points(guildId, period).then(setPoints, (e: Error) => setError(e.message));
  }, [guildId, period]);

  const run: Run = useCallback(
    async (fn, okText = 'Guardado') => {
      try {
        setPoints(await fn());
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
  if (!points) return <p className="muted">Cargando puntos…</p>;

  const pendingCount = points.pending.filter((p) => p.awarded === null).length;

  return (
    <div className="stack">
      <SettingsCard points={points} run={(fn) => run(fn)} guildId={guildId} period={period} />

      {points.settings.enabled && (
        <>
          <div className="card stack">
            <div className="card-head">
              <h2 style={{ margin: 0 }}>Salidas por puntuar{pendingCount ? ` (${pendingCount})` : ''}</h2>
              <span className="muted small">Salidas terminadas con GG en los últimos 3 días</span>
            </div>
            {points.pending.length === 0 ? (
              <p className="empty">No hay salidas terminadas recientes. Al dar GG a una salida aparecerá aquí.</p>
            ) : (
              <div className="list">
                {points.pending.map((p) => (
                  <div key={p.pingId} className="list-item">
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <strong>{p.title}</strong>{' '}
                      {p.awarded === null ? <span className="badge">Sin puntos</span> : <span className="badge premium">{p.awarded} pts repartidos</span>}
                      <div className="muted small">
                        {p.contentName} · Caller {p.callerName} · {p.participants} participantes · terminó {fmtDate(p.closedAt, true)}
                      </div>
                    </div>
                    <button className={`btn-sm${p.awarded === null ? ' btn-primary' : ''}`} onClick={() => setEditing(p.pingId)}>
                      {p.awarded === null ? 'Repartir puntos' : 'Corregir'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <RankingCard points={points} period={period} setPeriod={setPeriod} onAdjust={setAdjusting} run={run} guildId={guildId} />

          <HistoryCard points={points} run={run} guildId={guildId} period={period} />
        </>
      )}

      {editing && (
        <AwardEditor
          guildId={guildId}
          pingId={editing}
          onClose={() => setEditing(null)}
          onSave={async (entries) => {
            if (await run(() => api.saveActivityPoints(guildId, period, editing, entries), 'Puntos guardados')) setEditing(null);
          }}
        />
      )}

      {adjusting && (
        <AdjustDialog
          target={adjusting}
          onClose={() => setAdjusting(null)}
          onSave={async (body) => {
            if (await run(() => api.adjustPoints(guildId, period, body), 'Ajuste guardado')) setAdjusting(null);
          }}
        />
      )}
    </div>
  );
}

function SettingsCard({ points, run, guildId, period }: { points: PointsData; run: (fn: () => Promise<PointsData>) => Promise<boolean>; guildId: string; period: RankingPeriod }) {
  const [s, setS] = useState(points.settings);
  useEffect(() => setS(points.settings), [points.settings]);
  const dirty = JSON.stringify(s) !== JSON.stringify(points.settings);
  const valid = Number.isInteger(s.defaultAward) && Number.isInteger(s.maxPerActivity) && s.maxPerActivity >= 1 && s.defaultAward >= 0 && s.defaultAward <= s.maxPerActivity;

  return (
    <div className="card stack">
      <div className="card-head">
        <h2 style={{ margin: 0 }}>Puntos de actividad</h2>
        <label className="row small" style={{ gap: 8 }}>
          <input type="checkbox" style={{ width: 18, height: 18 }} checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} />
          Activados
        </label>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        Al terminar una salida (GG), el Caller o un oficial reparte puntos a cada participante desde Discord (botón <strong>🏆 Repartir puntos</strong>) o desde aquí.
        Los jugadores ven su puesto con <code>/puntos</code> y la tabla con <code>/ranking</code>. Los puntos solo sirven para el ranking.
      </p>
      {s.enabled && (
        <div className="grid-2">
          <label className="field">
            Puntos por defecto a cada participante
            <input type="number" min={0} max={s.maxPerActivity} value={s.defaultAward} onChange={(e) => setS({ ...s, defaultAward: Math.trunc(Number(e.target.value)) })} />
          </label>
          <label className="field">
            Máximo por jugador en una salida
            <input type="number" min={1} max={10000} value={s.maxPerActivity} onChange={(e) => setS({ ...s, maxPerActivity: Math.trunc(Number(e.target.value)) })} />
          </label>
        </div>
      )}
      {s.enabled && !valid && <p className="notice">Los puntos por defecto no pueden superar el máximo.</p>}
      <div className="row">
        <span className="spacer" />
        <button className="btn-primary" disabled={!dirty || !valid} onClick={() => void run(() => api.savePointsSettings(guildId, period, s))}>
          Guardar
        </button>
      </div>
    </div>
  );
}

function RankingCard({ points, period, setPeriod, onAdjust, run, guildId }: {
  points: PointsData;
  period: RankingPeriod;
  setPeriod: (p: RankingPeriod) => void;
  onAdjust: (t: { userId: string; name: string }) => void;
  run: Run;
  guildId: string;
}) {
  const [adjustId, setAdjustId] = useState('');
  const newSeason = () => {
    if (!window.confirm('¿Empezar una temporada nueva? El ranking vuelve a cero para todos. El historial se conserva.')) return;
    void run(() => api.newSeason(guildId, period), 'Temporada nueva');
  };

  return (
    <div className="card stack">
      <div className="card-head">
        <h2 style={{ margin: 0 }}>Ranking</h2>
        <div className="row" style={{ gap: 6 }}>
          {(Object.keys(PERIOD_LABEL) as RankingPeriod[]).map((p) => (
            <button
              key={p}
              className={`btn-sm${points.period === p ? ' btn-primary' : ''}`}
              disabled={!points.pro && p !== 'total'}
              title={!points.pro && p !== 'total' ? 'Premium' : undefined}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        {points.period === 'total' ? `Temporada desde ${points.seasonStart ? fmtDate(points.seasonStart) : 'el principio'}.` : `Puntos de los ${PERIOD_LABEL[points.period].toLowerCase()}.`}
        {!points.pro && ` En Discord, /ranking muestra el top ${points.rankingSize}. Premium añade ranking semanal y mensual, temporadas, ajustes manuales y top 25.`}
      </p>
      {points.ranking.length === 0 ? (
        <p className="empty">Todavía nadie tiene puntos en este periodo.</p>
      ) : (
        <div className="list">
          {points.ranking.map((r) => (
            <div key={r.userId} className="list-item">
              <strong style={{ width: 40 }}>{MEDALS[r.rank - 1] ?? `${r.rank}.`}</strong>
              <div style={{ flex: 1, minWidth: 140 }}>
                {r.name}
                <div className="muted small">{r.activities} {r.activities === 1 ? 'actividad' : 'actividades'}</div>
              </div>
              <strong>{r.points} pts</strong>
              {points.pro && <button className="btn-sm" onClick={() => onAdjust({ userId: r.userId, name: r.name })}>Ajustar</button>}
            </div>
          ))}
        </div>
      )}
      {points.pro && (
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input
            style={{ maxWidth: 260 }}
            value={adjustId}
            onChange={(e) => setAdjustId(e.target.value.trim())}
            placeholder="ID de usuario para ajustar a otro"
          />
          <button className="btn-sm" disabled={!/^\d{15,25}$/.test(adjustId)} onClick={() => onAdjust({ userId: adjustId, name: `usuario ${adjustId}` })}>
            Ajustar
          </button>
          <span className="spacer" />
          <button className="btn-sm btn-danger" onClick={newSeason}>Empezar temporada nueva</button>
        </div>
      )}
    </div>
  );
}

function HistoryCard({ points, run, guildId, period }: { points: PointsData; run: Run; guildId: string; period: RankingPeriod }) {
  const [open, setOpen] = useState<string | null>(null);
  const undo = (id: string, title: string) => {
    if (!window.confirm(`¿Deshacer “${title}”? Se quitan esos puntos del ranking.`)) return;
    void run(() => api.deletePointsAward(guildId, period, id), 'Deshecho');
  };
  return (
    <div className="card stack">
      <div className="card-head">
        <h2 style={{ margin: 0 }}>Historial</h2>
        <span className="muted small">{points.pro ? 'Últimos 100 movimientos' : 'Últimos 10 movimientos (Premium: 100)'}</span>
      </div>
      {points.awards.length === 0 ? (
        <p className="empty">Sin movimientos todavía.</p>
      ) : (
        <div className="list">
          {points.awards.map((a) => (
            <div key={a.id} className="list-item" style={{ flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <strong>{a.kind === 'adjust' ? `Ajuste · ${a.entries[0]?.name}` : a.title}</strong>{' '}
                <span className="badge">{a.total > 0 ? '+' : ''}{a.total} pts</span>
                <div className="muted small">
                  {fmtDate(a.at, true)} · por {a.byName ?? a.by}
                  {a.kind === 'activity' && ` · ${a.entries.length} jugadores`}
                  {a.updatedAt && ' · corregido'}
                  {a.note && ` · ${a.note}`}
                </div>
                {open === a.id && (
                  <div className="small" style={{ marginTop: 6 }}>
                    {a.entries.map((e) => `${e.name}: ${e.points}`).join(' · ')}
                  </div>
                )}
              </div>
              {a.kind === 'activity' && (
                <button className="btn-sm btn-ghost" onClick={() => setOpen(open === a.id ? null : a.id)}>
                  {open === a.id ? 'Ocultar' : 'Ver jugadores'}
                </button>
              )}
              <button className="btn-sm btn-danger" onClick={() => undo(a.id, a.kind === 'adjust' ? 'Ajuste' : a.title)}>Deshacer</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AwardEditor({ guildId, pingId, onClose, onSave }: {
  guildId: string;
  pingId: string;
  onClose: () => void;
  onSave: (entries: Array<{ userId: string; points: number }>) => Promise<void>;
}) {
  const [editor, setEditor] = useState<PointsEditor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.pointsEditor(guildId, pingId).then(setEditor, (e: Error) => setError(e.message));
  }, [guildId, pingId]);

  const setPts = (userId: string, value: number) =>
    setEditor((ed) => ed && { ...ed, entries: ed.entries.map((e) => (e.userId === userId ? { ...e, points: value } : e)) });

  const invalid = editor?.entries.some((e) => !Number.isInteger(e.points) || e.points < 0 || e.points > editor.max) ?? true;
  const total = editor?.entries.reduce((s, e) => s + (e.points || 0), 0) ?? 0;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Repartir puntos">
        <div className="modal-head">
          <div className="row">
            <h3 style={{ margin: 0 }}>🏆 {editor?.title ?? 'Puntos'}</h3>
            <span className="spacer" />
            <button className="btn-sm btn-ghost" onClick={onClose} aria-label="Cerrar">✕</button>
          </div>
          {editor && editor.entries.length > 0 && (
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <input style={{ maxWidth: 120 }} type="number" min={0} max={editor.max} value={all} onChange={(e) => setAll(e.target.value)} placeholder="Puntos" />
              <button
                className="btn-sm"
                disabled={all === '' || !Number.isInteger(Number(all)) || Number(all) < 0 || Number(all) > editor.max}
                onClick={() => setEditor({ ...editor, entries: editor.entries.map((e) => ({ ...e, points: Number(all) })) })}
              >
                Poner a todos
              </button>
              <span className="muted small">0 = sin puntos · máximo {editor.max} por jugador</span>
            </div>
          )}
        </div>
        <div className="modal-body stack">
          {error ? (
            <p className="error">{error}</p>
          ) : !editor ? (
            <p className="muted">Cargando participantes…</p>
          ) : editor.entries.length === 0 ? (
            <p className="empty">Nadie se anotó en esta salida. Puedes añadir jugadores desde Discord con el botón 🏆 Repartir puntos.</p>
          ) : (
            <>
              <div className="list">
                {editor.entries.map((e) => (
                  <div key={e.userId} className="list-item">
                    <span style={{ flex: 1 }}>{e.name}</span>
                    <input
                      style={{ width: 100 }}
                      type="number"
                      min={0}
                      max={editor.max}
                      value={Number.isNaN(e.points) ? '' : e.points}
                      onChange={(ev) => setPts(e.userId, ev.target.value === '' ? NaN : Math.trunc(Number(ev.target.value)))}
                      aria-label={`Puntos de ${e.name}`}
                    />
                  </div>
                ))}
              </div>
              <div className="row">
                <span className="muted small">{total} pts en total</span>
                <span className="spacer" />
                <button className="btn-ghost" onClick={onClose}>Cancelar</button>
                <button
                  className="btn-primary"
                  disabled={invalid || busy}
                  onClick={async () => {
                    setBusy(true);
                    await onSave(editor.entries.map(({ userId, points }) => ({ userId, points })));
                    setBusy(false);
                  }}
                >
                  Guardar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AdjustDialog({ target, onClose, onSave }: {
  target: { userId: string; name: string };
  onClose: () => void;
  onSave: (body: { userId: string; points: number; note?: string }) => Promise<void>;
}) {
  const [pts, setPts] = useState('');
  const [note, setNote] = useState('');
  const n = Number(pts);
  const ok = pts !== '' && Number.isInteger(n) && n !== 0 && Math.abs(n) <= 100000;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Ajustar puntos" style={{ width: 'min(440px, 100%)' }}>
        <div className="modal-head">
          <div className="row">
            <h3 style={{ margin: 0 }}>Ajustar a {target.name}</h3>
            <span className="spacer" />
            <button className="btn-sm btn-ghost" onClick={onClose} aria-label="Cerrar">✕</button>
          </div>
        </div>
        <div className="modal-body stack">
          <label className="field">
            Puntos (negativo para restar)
            <input type="number" value={pts} onChange={(e) => setPts(e.target.value)} placeholder="Ej: 20 o -15" autoFocus />
          </label>
          <label className="field">
            Motivo (opcional)
            <input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="Ej: ayudó a organizar la ZvZ" />
          </label>
          <div className="row">
            <span className="spacer" />
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" disabled={!ok} onClick={() => void onSave({ userId: target.userId, points: n, note: note || undefined })}>
              Guardar ajuste
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
