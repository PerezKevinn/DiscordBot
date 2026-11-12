import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { cop, EVENT_LABELS, fmtDate, type AdminGuild, type AdminOverview, type PaymentOrder, type RedeemCode } from '../types';
import { GuildIcon } from './GuildPicker';
import { useToast } from './Toast';

const DAY = 24 * 60 * 60 * 1000;
type Filter = 'all' | 'premium' | 'expiring' | 'free';

const CODE_STATUS: Record<RedeemCode['status'], { label: string; cls: string }> = {
  active: { label: 'Activo', cls: 'badge ok' },
  used: { label: 'Usado', cls: 'badge' },
  expired: { label: 'Caducado', cls: 'badge' },
  disabled: { label: 'Desactivado', cls: 'badge danger' },
};

/** Panel del dueño del bot: membresías de todos los servidores, códigos e historial. */
export function AdminPanel() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'servidores' | 'pagos' | 'codigos' | 'historial'>('servidores');
  const toast = useToast();

  const load = () => api.adminOverview().then(setData, (e: Error) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);

  if (error) return <div className="card empty">{error}</div>;
  if (!data) return <p className="muted">Cargando administración…</p>;

  const run = async <T,>(fn: () => Promise<T>, ok: string, apply: (r: T) => void) => {
    try {
      apply(await fn());
      toast(ok);
      return true;
    } catch (e) {
      toast((e as Error).message, true);
      return false;
    }
  };

  const updateGuild = (g: AdminGuild, history: AdminOverview['history']) =>
    setData((d) => d && { ...d, guilds: d.guilds.map((x) => (x.id === g.id ? g : x)), history });

  return (
    <div className="stack">
      <div className="row">
        <h1 style={{ margin: 0 }}>Administración</h1>
        <span className="spacer" />
        <button className="btn-sm" onClick={() => void load()}>Actualizar</button>
      </div>

      {!data.skuConfigured && (
        <p className="notice">
          Falta <code>PREMIUM_SKU_ID</code> en el <code>.env</code>: las suscripciones de Discord no se están leyendo. Crea el SKU en
          Developer Portal → Monetización y pon su ID.
        </p>
      )}

      <div className="stats">
        <Stat label="Servidores" value={data.stats.guilds} />
        <Stat label="Premium" value={data.stats.premium} accent />
        <Stat label="Por suscripción" value={data.stats.subscriptions} />
        <Stat label="Por tiempo / código" value={data.stats.timed} />
        <Stat label="Vencen en 7 días" value={data.stats.expiringSoon} />
      </div>

      <nav className="tabs">
        {(
          [
            ['servidores', 'Servidores'],
            ['pagos', 'Pagos'],
            ['codigos', `Códigos (${data.codes.filter((c) => c.status === 'active').length})`],
            ['historial', 'Historial'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={`tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'servidores' && (
        <GuildsSection
          guilds={data.guilds}
          onAction={(guildId, body, ok) => run(() => api.adminPlan(guildId, body), ok, (r) => updateGuild(r.guild, r.history))}
        />
      )}
      {tab === 'codigos' && (
        <CodesSection
          codes={data.codes}
          onCreate={(body) => {
            let created: RedeemCode[] = [];
            return run(
              () => api.createCodes(body),
              body.count > 1 ? `${body.count} códigos creados` : 'Código creado',
              (r) => {
                created = r.created;
                setData((d) => d && { ...d, codes: r.codes });
              }
            ).then(() => created);
          }}
          onToggle={(c) =>
            void run(() => api.setCodeDisabled(c.code, !c.disabled), c.disabled ? 'Código reactivado' : 'Código desactivado', (r) =>
              setData((d) => d && { ...d, codes: r.codes })
            )
          }
          onDelete={(c) =>
            window.confirm(`¿Borrar el código ${c.code}?`) &&
            void run(() => api.deleteCode(c.code), 'Código borrado', (r) => setData((d) => d && { ...d, codes: r.codes }))
          }
        />
      )}
      {tab === 'pagos' && <PaymentsSection payments={data.payments} />}
      {tab === 'historial' && <HistorySection history={data.history} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={`card stat${accent ? ' accent' : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="muted small">{label}</div>
    </div>
  );
}

// ---------- Servidores ----------
type PlanBody = Parameters<typeof api.adminPlan>[1];

function GuildsSection({
  guilds,
  onAction,
}: {
  guilds: AdminGuild[];
  onAction: (guildId: string, body: PlanBody, ok: string) => Promise<boolean>;
}) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(() => {
    const now = Date.now();
    const text = q.trim().toLowerCase();
    return guilds.filter((g) => {
      if (text && !g.name.toLowerCase().includes(text) && !g.id.includes(text)) return false;
      if (filter === 'premium') return g.tier === 'premium';
      if (filter === 'free') return g.tier === 'free';
      if (filter === 'expiring') return g.tier === 'premium' && g.endsAt !== null && g.endsAt - now < 7 * DAY;
      return true;
    });
  }, [guilds, q, filter]);

  return (
    <div className="card stack">
      <div className="row">
        <input placeholder="Buscar por nombre o ID" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} />
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} style={{ maxWidth: 200 }}>
          <option value="all">Todos</option>
          <option value="premium">Premium</option>
          <option value="expiring">Vencen en 7 días</option>
          <option value="free">Gratis</option>
        </select>
        <span className="muted small">{list.length} servidores</span>
      </div>

      {list.length === 0 ? (
        <p className="empty">Ningún servidor coincide.</p>
      ) : (
        <div className="list">
          {list.map((g) => (
            <div key={g.id} className="list-item" style={{ opacity: g.botPresent ? 1 : 0.6 }}>
              <GuildIcon name={g.name} icon={g.icon} size={36} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <strong>{g.name}</strong>{' '}
                <span className={`badge${g.tier === 'premium' ? ' premium' : ''}`}>{g.tier === 'premium' ? 'Premium' : 'Gratis'}</span>
                {!g.botPresent && <span className="badge"> Bot fuera</span>}
                <div className="muted small">
                  {g.id}
                  {g.members !== null && ` · ${g.members} miembros`}
                  {g.subscription?.active && ` · 💳 suscripción${g.subscription.endsAt ? ` (cancelada, hasta ${fmtDate(g.subscription.endsAt)})` : ''}`}
                  {g.timed && ` · 🎟️ ${{ code: 'código', manual: 'manual', payment: 'pagado' }[g.timed.source]} ${g.timed.until ? `hasta ${fmtDate(g.timed.until)}` : 'de por vida'}`}
                </div>
              </div>
              <button className="btn-sm" onClick={() => setOpen(open === g.id ? null : g.id)}>
                {open === g.id ? 'Cerrar' : 'Gestionar'}
              </button>
              {open === g.id && <GuildActions guild={g} onAction={(body, ok) => onAction(g.id, body, ok)} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GuildActions({ guild, onAction }: { guild: AdminGuild; onAction: (body: PlanBody, ok: string) => Promise<boolean> }) {
  const [days, setDays] = useState(30);
  const [note, setNote] = useState('');
  const lifetime = Boolean(guild.timed && !guild.timed.until);
  const n = note.trim() || undefined;

  return (
    <div className="admin-actions">
      <div className="row">
        <label className="field" style={{ width: 110 }}>
          Días
          <input type="number" min={1} max={3650} value={days} onChange={(e) => setDays(Math.max(1, Math.min(3650, Number(e.target.value) || 1)))} />
        </label>
        <label className="field" style={{ flex: 1, minWidth: 180 }}>
          Nota (opcional)
          <input value={note} maxLength={120} placeholder="Ej: pagó por transferencia" onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      <div className="row">
        {[30, 90, 365].map((d) => (
          <button key={d} className="btn-sm" disabled={lifetime} onClick={() => void onAction({ action: 'extend', days: d, note: n }, `+${d} días`)}>
            +{d} días
          </button>
        ))}
        <button className="btn-sm" disabled={lifetime} onClick={() => void onAction({ action: 'extend', days, note: n }, `+${days} días`)}>
          Sumar {days} días
        </button>
        <button className="btn-sm" onClick={() => void onAction({ action: 'grant', days, note: n }, `Premium por ${days} días`)}>
          Fijar {days} días desde hoy
        </button>
        <button className="btn-sm btn-primary" onClick={() => void onAction({ action: 'grant', days: null, note: n }, 'Premium de por vida')}>
          De por vida
        </button>
        {guild.timed && (
          <button
            className="btn-sm btn-danger"
            onClick={() => window.confirm(`¿Quitar el Premium concedido a ${guild.name}?`) && void onAction({ action: 'revoke', note: n }, 'Premium retirado')}
          >
            Quitar Premium
          </button>
        )}
      </div>
      {guild.subscription?.active && (
        <p className="muted small" style={{ margin: 0 }}>
          La suscripción de Discord no se puede quitar desde aquí: la cancela quien paga (o tú, con un reembolso desde el Developer Portal).
        </p>
      )}
    </div>
  );
}

// ---------- Códigos ----------
function CodesSection({
  codes,
  onCreate,
  onToggle,
  onDelete,
}: {
  codes: RedeemCode[];
  onCreate: (body: { days: number | null; maxUses: number; count: number; expiresInDays?: number | null; note?: string }) => Promise<RedeemCode[]>;
  onToggle: (c: RedeemCode) => void;
  onDelete: (c: RedeemCode) => void;
}) {
  const [days, setDays] = useState(30);
  const [lifetime, setLifetime] = useState(false);
  const [maxUses, setMaxUses] = useState(1);
  const [count, setCount] = useState(1);
  const [expires, setExpires] = useState<number | ''>('');
  const [note, setNote] = useState('');
  const [created, setCreated] = useState<RedeemCode[]>([]);
  const [showAll, setShowAll] = useState(false);
  const toast = useToast();

  const create = async () => {
    const r = await onCreate({
      days: lifetime ? null : days,
      maxUses,
      count,
      expiresInDays: expires === '' ? null : expires,
      note: note.trim() || undefined,
    });
    if (r.length) setCreated(r);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copiado');
    } catch {
      toast('No se pudo copiar', true);
    }
  };

  const visible = showAll ? codes : codes.filter((c) => c.status === 'active');

  return (
    <div className="stack">
      <div className="card stack">
        <h2 style={{ margin: 0 }}>Crear códigos</h2>
        <div className="grid-3">
          <label className="field">
            Duración (días)
            <input type="number" min={1} max={3650} value={days} disabled={lifetime} onChange={(e) => setDays(Math.max(1, Math.min(3650, Number(e.target.value) || 1)))} />
          </label>
          <label className="field">
            Usos por código
            <input type="number" min={1} max={1000} value={maxUses} onChange={(e) => setMaxUses(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))} />
          </label>
          <label className="field">
            Cantidad de códigos
            <input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
          </label>
          <label className="field">
            Caduca en (días, vacío = nunca)
            <input
              type="number"
              min={1}
              max={3650}
              value={expires}
              onChange={(e) => setExpires(e.target.value === '' ? '' : Math.max(1, Math.min(3650, Number(e.target.value) || 1)))}
            />
          </label>
          <label className="field">
            Nota
            <input value={note} maxLength={120} placeholder="Ej: sorteo noviembre" onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
        <div className="row">
          <label className="row small" style={{ gap: 6 }}>
            <input type="checkbox" checked={lifetime} onChange={(e) => setLifetime(e.target.checked)} style={{ width: 'auto' }} />
            De por vida
          </label>
          <span className="spacer" />
          <button className="btn-primary" onClick={() => void create()}>
            Crear {count > 1 ? `${count} códigos` : 'código'}
          </button>
        </div>

        {created.length > 0 && (
          <div className="notice stack" style={{ gap: 8 }}>
            <div className="row">
              <strong>Recién creados</strong>
              <span className="spacer" />
              <button className="btn-sm" onClick={() => void copy(created.map((c) => c.code).join('\n'))}>Copiar todos</button>
            </div>
            <div className="code-list">
              {created.map((c) => (
                <code key={c.code}>{c.code}</code>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2 style={{ margin: 0 }}>Códigos</h2>
          <span className="spacer" />
          <label className="row small" style={{ gap: 6 }}>
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} style={{ width: 'auto' }} />
            Mostrar usados, caducados y desactivados
          </label>
        </div>
        {visible.length === 0 ? (
          <p className="empty">No hay códigos {showAll ? '' : 'activos'}.</p>
        ) : (
          <div className="list">
            {visible.map((c) => (
              <div key={c.code} className="list-item">
                <div style={{ flex: 1, minWidth: 240 }}>
                  <code className="code-big">{c.code}</code> <span className={CODE_STATUS[c.status].cls}>{CODE_STATUS[c.status].label}</span>
                  <div className="muted small">
                    {c.days === null ? 'De por vida' : `${c.days} días`} · {c.uses.length}/{c.maxUses} usos · creado {fmtDate(c.createdAt)}
                    {c.expiresAt && ` · caduca ${fmtDate(c.expiresAt)}`}
                    {c.note && ` · ${c.note}`}
                  </div>
                  {c.uses.length > 0 && (
                    <div className="muted small">Canjeado en: {c.uses.map((u) => u.guildName ?? u.guildId).join(', ')}</div>
                  )}
                </div>
                <button className="btn-sm" onClick={() => void copy(c.code)}>Copiar</button>
                <button className="btn-sm" onClick={() => onToggle(c)}>{c.disabled ? 'Reactivar' : 'Desactivar'}</button>
                {c.uses.length === 0 && (
                  <button className="btn-sm btn-danger" onClick={() => onDelete(c)}>Borrar</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Pagos ----------
const ORDER_STATUS: Record<PaymentOrder['status'], { label: string; cls: string }> = {
  created: { label: 'Iniciado', cls: 'badge' },
  pending: { label: 'Pendiente', cls: 'badge' },
  paid: { label: 'Aprobado', cls: 'badge ok' },
  rejected: { label: 'Rechazado', cls: 'badge danger' },
  reversed: { label: 'Reversado', cls: 'badge danger' },
};

function PaymentsSection({ payments }: { payments: AdminOverview['payments'] }) {
  if (!payments.enabled) {
    return (
      <p className="notice">
        Los pagos con Mercado Pago están desactivados. Pon <code>MP_ACCESS_TOKEN</code> (y opcionalmente{' '}
        <code>MP_WEBHOOK_SECRET</code>) en el <code>.env</code>.
      </p>
    );
  }
  return (
    <div className="stack">
      <div className="stats">
        <Stat label="Ingresos 30 días (sin pruebas)" value={`$${payments.revenue30d.toLocaleString('es-CO')}`} accent />
        <Stat label="Pagos aprobados" value={payments.orders.filter((o) => o.status === 'paid').length} />
        <Stat label="Pendientes" value={payments.orders.filter((o) => o.status === 'pending').length} />
      </div>
      {payments.test && (
        <p className="notice">
          Modo prueba activo (<code>MP_TEST</code>): las órdenes se marcan como prueba. Usa credenciales de una cuenta de prueba
          de Mercado Pago, y para cobrar de verdad pon las credenciales reales y <code>MP_TEST=false</code>.
        </p>
      )}
      <div className="card">
        <h2>Pagos</h2>
        {payments.orders.length === 0 ? (
          <p className="empty">Todavía no hay pagos.</p>
        ) : (
          <div className="list">
            {payments.orders.map((o) => (
              <div key={o.invoice} className="list-item">
                <div style={{ flex: 1, minWidth: 240 }}>
                  <strong>{cop(o.amount)}</strong> <span className={ORDER_STATUS[o.status].cls}>{ORDER_STATUS[o.status].label}</span>
                  {o.test && <span className="badge"> Prueba</span>}
                  <div className="muted small">
                    {o.guildName ?? o.guildId} · {o.days} días · {o.invoice}
                    {o.paymentRef && ` · ${o.provider === 'mercadopago' ? 'pago MP' : 'ref ePayco'} ${o.paymentRef}`} · usuario {o.userId}
                  </div>
                </div>
                <span className="muted small">{fmtDate(o.paidAt ?? o.updatedAt, true)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Historial ----------
function HistorySection({ history }: { history: AdminOverview['history'] }) {
  const [q, setQ] = useState('');
  const text = q.trim().toLowerCase();
  const list = text
    ? history.filter((e) => e.guildId.includes(text) || (e.guildName ?? '').toLowerCase().includes(text) || (e.code ?? '').toLowerCase().includes(text))
    : history;

  return (
    <div className="card stack">
      <input placeholder="Filtrar por servidor, ID o código" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} />
      {list.length === 0 ? (
        <p className="empty">Sin movimientos todavía.</p>
      ) : (
        <div className="list">
          {list.map((e, i) => (
            <div key={i} className="list-item">
              <div style={{ flex: 1, minWidth: 240 }}>
                <strong>{EVENT_LABELS[e.type]}</strong>
                {e.days !== undefined && e.type !== 'revoke' && <span className="muted"> · {e.days === null ? 'de por vida' : `${e.days} días`}</span>}
                <div className="muted small">
                  {e.guildName ?? e.guildId}
                  {e.until ? ` · hasta ${fmtDate(e.until)}` : e.until === null && (e.type === 'grant' || e.type === 'code_redeemed') ? ' · sin vencimiento' : ''}
                  {e.code && ` · ${e.code}`}
                  {e.actorId && ` · usuario ${e.actorId}`}
                  {e.note && ` · ${e.note}`}
                </div>
              </div>
              <span className="muted small">{fmtDate(e.at, true)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
