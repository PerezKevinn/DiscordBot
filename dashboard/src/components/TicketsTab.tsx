/**
 * Pestaña "Tickets": ajustes generales, tipos de ticket (con preguntas y reclutamiento), paneles
 * con su botón de publicar y la lista de tickets abiertos. Todo se guarda de una vez; publicar un
 * panel necesita los cambios guardados.
 */
import { useState } from 'react';
import { api } from '../api';
import type { GuildData, TicketPanel, TicketQuestion, TicketsData, TicketType } from '../types';
import type { Save } from './GuildPanel';

type Editable = Omit<TicketsData, 'open' | 'issues'>;
type Roles = GuildData['discord']['roles'];

// Mismos límites que el bot (src/panel/validation.ts y handlers/ticketHandler.ts).
const MAX_QUESTIONS = 5;
const MAX_RECRUIT_QUESTIONS = 3;

const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const SERVER_OPTIONS: Array<{ value: TicketsData['albionServer']; label: string }> = [
  { value: 'americas', label: 'América' },
  { value: 'europe', label: 'Europa' },
  { value: 'asia', label: 'Asia' },
  { value: 'ask', label: 'Que lo elija el aspirante' },
];

const STYLE_OPTIONS: Array<{ value: TicketType['buttonStyle']; label: string }> = [
  { value: 'primary', label: 'Azul' },
  { value: 'secondary', label: 'Gris' },
  { value: 'success', label: 'Verde' },
  { value: 'danger', label: 'Rojo' },
];

function blankType(recruitment: boolean): TicketType {
  return {
    id: newId('t_'),
    name: recruitment ? 'Aplicar al gremio' : 'Soporte',
    emoji: recruitment ? '⚔️' : '🎫',
    description: recruitment ? 'Únete a nosotros: te pediremos tu personaje.' : 'Dudas, problemas o reportes.',
    buttonStyle: recruitment ? 'success' : 'primary',
    mode: 'channel',
    categoryId: null,
    threadChannelId: null,
    staffRoleIds: [],
    pingStaff: true,
    welcome: recruitment
      ? '¡Gracias por aplicar! Abajo tienes la ficha de tu personaje. Un reclutador revisará tu solicitud pronto.'
      : 'Gracias por escribir. Cuéntanos con detalle y el staff te atenderá pronto.',
    questions: recruitment
      ? [
          { id: newId('q_'), label: '¿Qué contenido te gusta hacer?', placeholder: 'ZvZ, gankeo, grupales, recolección…', style: 'short', required: true },
          { id: newId('q_'), label: '¿En qué horario juegas?', placeholder: 'Ej.: 20:00–00:00 UTC', style: 'short', required: false },
        ]
      : [],
    recruitment,
    acceptRoleIds: [],
    removeRoleIds: [],
    setNickname: recruitment,
  };
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
      <input type="checkbox" style={{ width: 18, height: 18 }} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

/** Varios roles: los elegidos como insignias con ✕ y un desplegable para añadir. */
function RolesPicker({ value, onChange, roles, placeholder }: { value: string[]; onChange: (v: string[]) => void; roles: Roles; placeholder: string }) {
  const byId = new Map(roles.map((r) => [r.id, r]));
  return (
    <div className="stack" style={{ gap: 6 }}>
      {value.length > 0 && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {value.map((id) => (
            <span key={id} className="badge">
              @{byId.get(id)?.name ?? 'rol borrado'}{' '}
              <button className="btn-ghost btn-sm" style={{ padding: '0 4px' }} onClick={() => onChange(value.filter((v) => v !== id))} aria-label="Quitar">
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      {value.length < 10 && (
        <select value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])}>
          <option value="">{placeholder}</option>
          {roles.filter((r) => !value.includes(r.id)).map((r) => (
            <option key={r.id} value={r.id}>@{r.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}

function QuestionsEditor({ questions, max, onChange }: { questions: TicketQuestion[]; max: number; onChange: (q: TicketQuestion[]) => void }) {
  const set = (i: number, patch: Partial<TicketQuestion>) => onChange(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  return (
    <div className="stack">
      {questions.map((q, i) => (
        <div key={q.id} className="list-item" style={{ flexWrap: 'wrap', gap: 8 }}>
          <input style={{ flex: 2, minWidth: 180 }} value={q.label} maxLength={45} placeholder="Pregunta" onChange={(e) => set(i, { label: e.target.value })} />
          <input style={{ flex: 2, minWidth: 180 }} value={q.placeholder} maxLength={100} placeholder="Ejemplo de respuesta (opcional)" onChange={(e) => set(i, { placeholder: e.target.value })} />
          <select style={{ width: 130 }} value={q.style} onChange={(e) => set(i, { style: e.target.value as TicketQuestion['style'] })}>
            <option value="short">Respuesta corta</option>
            <option value="paragraph">Párrafo</option>
          </select>
          <Check checked={q.required} onChange={(v) => set(i, { required: v })}>Obligatoria</Check>
          <button className="btn-icon btn-danger" onClick={() => onChange(questions.filter((_, j) => j !== i))} aria-label="Borrar pregunta">🗑️</button>
        </div>
      ))}
      <div className="row">
        <button
          className="btn-sm"
          disabled={questions.length >= max}
          onClick={() => onChange([...questions, { id: newId('q_'), label: '', placeholder: '', style: 'short', required: true }])}
        >
          + Pregunta
        </button>
        <span className="muted small">{questions.length} de {max}. Discord admite 5 campos por formulario.</span>
      </div>
    </div>
  );
}

function TypeEditor({ t, data, onChange, onDelete }: { t: TicketType; data: GuildData; onChange: (t: TicketType) => void; onDelete: () => void }) {
  const set = <K extends keyof TicketType>(k: K, v: TicketType[K]) => onChange({ ...t, [k]: v });
  const { roles, channels, categories } = data.discord;
  const maxQ = t.recruitment ? MAX_RECRUIT_QUESTIONS : MAX_QUESTIONS;
  return (
    <div className="stack">
      <div className="grid-2">
        <label className="field">
          Nombre del botón
          <input value={t.name} maxLength={40} onChange={(e) => set('name', e.target.value)} />
        </label>
        <div className="row" style={{ gap: 8 }}>
          <label className="field" style={{ width: 90 }}>
            Emoji
            <input value={t.emoji} maxLength={64} onChange={(e) => set('emoji', e.target.value)} />
          </label>
          <label className="field" style={{ flex: 1 }}>
            Color del botón
            <select value={t.buttonStyle} onChange={(e) => set('buttonStyle', e.target.value as TicketType['buttonStyle'])}>
              {STYLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
        <label className="field">
          Descripción en el panel
          <input value={t.description} maxLength={100} onChange={(e) => set('description', e.target.value)} />
        </label>
        <label className="field">
          Dónde se abre
          <select value={t.mode} onChange={(e) => set('mode', e.target.value as TicketType['mode'])}>
            <option value="channel">Canal privado</option>
            <option value="thread">Hilo privado</option>
          </select>
        </label>
        {t.mode === 'channel' ? (
          <label className="field">
            Categoría de los canales
            <select value={t.categoryId ?? ''} onChange={(e) => set('categoryId', e.target.value || null)}>
              <option value="">La del canal del panel</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        ) : (
          <label className="field">
            Canal donde se crean los hilos
            <select value={t.threadChannelId ?? ''} onChange={(e) => set('threadChannelId', e.target.value || null)}>
              <option value="">El canal del panel</option>
              {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </label>
        )}
        <div className="field">
          Roles de staff (ven y gestionan el ticket)
          <RolesPicker value={t.staffRoleIds} onChange={(v) => set('staffRoleIds', v)} roles={roles} placeholder="Añadir rol de staff…" />
        </div>
      </div>
      <Check checked={t.pingStaff || t.mode === 'thread'} onChange={(v) => set('pingStaff', v)}>
        Mencionar al staff al abrir{t.mode === 'thread' ? ' (obligatorio en hilos: es lo que los añade al hilo)' : ''}
      </Check>
      <label className="field">
        Mensaje de bienvenida
        <textarea rows={3} value={t.welcome} maxLength={1500} onChange={(e) => set('welcome', e.target.value)} />
      </label>

      <div className="card stack" style={{ margin: 0 }}>
        <Check
          checked={t.recruitment}
          onChange={(v) => onChange({ ...t, recruitment: v, questions: v ? t.questions.slice(0, MAX_RECRUIT_QUESTIONS) : t.questions })}
        >
          <b>Ticket de reclutamiento</b>: pide el personaje de Albion y publica su ficha (PvP, PvE, recolección, gremios)
        </Check>
        {t.recruitment && (
          <div className="grid-2">
            <div className="field">
              Roles que se dan al aceptar
              <RolesPicker value={t.acceptRoleIds} onChange={(v) => set('acceptRoleIds', v)} roles={roles} placeholder="Añadir rol…" />
            </div>
            <div className="field">
              Roles que se quitan al aceptar
              <RolesPicker value={t.removeRoleIds} onChange={(v) => set('removeRoleIds', v)} roles={roles} placeholder="Añadir rol (p. ej. Invitado)…" />
            </div>
            <Check checked={t.setNickname} onChange={(v) => set('setNickname', v)}>Poner el nombre del personaje como apodo</Check>
          </div>
        )}
      </div>

      <h3 style={{ margin: 0 }}>Preguntas del formulario</h3>
      {t.recruitment && <p className="muted small" style={{ margin: 0 }}>El nombre del personaje (y el servidor, si lo elige el aspirante) se piden siempre.</p>}
      <QuestionsEditor questions={t.questions} max={maxQ} onChange={(q) => set('questions', q)} />

      <div className="row">
        <span className="spacer" />
        <button className="btn-danger btn-sm" onClick={onDelete}>Borrar tipo</button>
      </div>
    </div>
  );
}

function PanelEditor({ p, types, data, dirty, onChange, onDelete, onPublish }: {
  p: TicketPanel;
  types: TicketType[];
  data: GuildData;
  dirty: boolean;
  onChange: (p: TicketPanel) => void;
  onDelete: () => void;
  onPublish: () => void;
}) {
  const set = <K extends keyof TicketPanel>(k: K, v: TicketPanel[K]) => onChange({ ...p, [k]: v });
  const saved = data.tickets.panels.some((x) => x.id === p.id);
  return (
    <div className="card stack" style={{ margin: 0 }}>
      <div className="grid-2">
        <label className="field">
          Canal
          <select value={p.channelId} onChange={(e) => set('channelId', e.target.value)}>
            <option value="">Elige un canal…</option>
            {data.discord.channels.map((c) => (
              <option key={c.id} value={c.id}>#{c.name}{c.botCanSend ? '' : ' (el bot no puede escribir)'}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Título
          <input value={p.title} maxLength={100} onChange={(e) => set('title', e.target.value)} />
        </label>
      </div>
      <label className="field">
        Texto
        <textarea rows={2} value={p.description} maxLength={1500} onChange={(e) => set('description', e.target.value)} />
      </label>
      <div className="field">
        Botones del panel
        <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
          {types.map((t) => (
            <Check
              key={t.id}
              checked={p.typeIds.includes(t.id)}
              onChange={(v) => set('typeIds', v ? [...p.typeIds, t.id] : p.typeIds.filter((id) => id !== t.id))}
            >
              {t.emoji} {t.name || 'Sin nombre'}
            </Check>
          ))}
          {types.length === 0 && <span className="muted">Crea antes un tipo de ticket.</span>}
        </div>
      </div>
      <div className="row">
        <button className="btn-primary btn-sm" disabled={dirty || !saved} onClick={onPublish} title={dirty ? 'Guarda los cambios antes de publicar' : undefined}>
          {p.url ? 'Actualizar en Discord' : 'Publicar en Discord'}
        </button>
        {p.url && <a className="btn btn-sm" href={p.url} target="_blank" rel="noreferrer">Ver mensaje</a>}
        {dirty && <span className="muted small">Guarda los cambios para publicar.</span>}
        <span className="spacer" />
        <button className="btn-danger btn-sm" onClick={onDelete}>Borrar panel</button>
      </div>
    </div>
  );
}

/** Pestaña de tickets. */
export function TicketsTab({ data, save }: { data: GuildData; save: Save }) {
  const initial = (): Editable => {
    const { open: _o, issues: _i, ...rest } = data.tickets;
    void _o;
    void _i;
    return { ...rest, panels: rest.panels.map(({ url: _u, ...p }) => (void _u, p)) };
  };
  const [s, setS] = useState<Editable>(initial);
  const [openType, setOpenType] = useState<string | null>(null);
  const dirty = JSON.stringify(s) !== JSON.stringify(initial());
  const limits = data.plan.limits;
  const premium = data.plan.tier === 'premium';

  const setType = (id: string, t: TicketType) => setS((prev) => ({ ...prev, types: prev.types.map((x) => (x.id === id ? t : x)) }));
  const setPanel = (id: string, p: TicketPanel) => setS((prev) => ({ ...prev, panels: prev.panels.map((x) => (x.id === id ? p : x)) }));

  const addType = (recruitment: boolean) => {
    const t = blankType(recruitment);
    setS((prev) => ({ ...prev, types: [...prev.types, t] }));
    setOpenType(t.id);
  };

  const submit = async () => {
    if (await save(() => api.saveTickets(data.guild.id, s), 'Tickets guardados')) setOpenType(null);
  };

  // Tras guardar, data cambia: el estado local se rehace con lo que devolvió el servidor.
  const [seen, setSeen] = useState(data);
  if (seen !== data) {
    setSeen(data);
    setS(initial());
  }

  return (
    <div className="stack">
      {data.tickets.issues.length > 0 && (
        <div className="notice stack" style={{ gap: 4 }}>
          <b>⚠️ Revisa los permisos del bot</b>
          {data.tickets.issues.map((i) => (
            // Los avisos vienen con **negrita** de Discord: las partes impares van en negrita.
            <span key={i}>{i.split('**').map((part, n) => (n % 2 ? <b key={n}>{part}</b> : part))}</span>
          ))}
          <span className="muted small">Si el bot entró antes de que existieran los tickets, vuelve a invitarlo desde el panel o da esos permisos a su rol.</span>
        </div>
      )}

      <div className="card stack">
        <h2>General</h2>
        <div className="grid-2">
          <label className="field">
            Canal de registro (aperturas, cierres y transcripciones)
            <select value={s.logChannelId ?? ''} onChange={(e) => setS({ ...s, logChannelId: e.target.value || null })}>
              <option value="">Sin registro</option>
              {data.discord.channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </label>
          <label className="field">
            Servidor de Albion del gremio
            <select value={s.albionServer} onChange={(e) => setS({ ...s, albionServer: e.target.value as TicketsData['albionServer'] })}>
              {SERVER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
        <Check checked={s.dmUser} onChange={(v) => setS({ ...s, dmUser: v })}>Avisar al autor por mensaje privado al cerrar, aceptar o rechazar</Check>
        <p className="muted small" style={{ margin: 0 }}>
          Transcripción {limits.htmlTranscripts ? 'en HTML con formato' : 'en texto plano (💎 Premium: HTML con formato)'}. Ficha de Albion{' '}
          {limits.albionGuildHistory ? 'con gremios anteriores' : 'sin gremios anteriores (💎 Premium)'}.
        </p>
      </div>

      <div className="card stack">
        <div className="row">
          <h2 style={{ margin: 0 }}>Tipos de ticket</h2>
          <span className="muted">{s.types.length} de {limits.maxTicketTypes}</span>
          <span className="spacer" />
          <button className="btn-sm" disabled={s.types.length >= limits.maxTicketTypes} onClick={() => addType(true)}>+ Reclutamiento</button>
          <button className="btn-sm" disabled={s.types.length >= limits.maxTicketTypes} onClick={() => addType(false)}>+ Otro tipo</button>
        </div>
        {s.types.length >= limits.maxTicketTypes && !premium && (
          <p className="muted small" style={{ margin: 0 }}>💎 Premium permite 10 tipos de ticket y 5 paneles.</p>
        )}
        {s.types.length === 0 && <p className="muted">Aún no hay tipos. Empieza por uno de reclutamiento.</p>}
        <div className="list">
          {s.types.map((t) => (
            <div key={t.id} className="stack" style={{ gap: 8 }}>
              <button className="list-item" style={{ textAlign: 'left', width: '100%' }} onClick={() => setOpenType(openType === t.id ? null : t.id)}>
                <span className="emoji">{t.emoji}</span>
                <span style={{ flex: 1 }}>
                  <b>{t.name || 'Sin nombre'}</b>
                  {t.recruitment && <span className="badge premium" style={{ marginLeft: 8 }}>Reclutamiento</span>}
                  <span className="muted small" style={{ marginLeft: 8 }}>{t.mode === 'channel' ? 'Canal' : 'Hilo'} · {t.questions.length} preguntas</span>
                </span>
                <span className="muted">{openType === t.id ? '▲' : '▼'}</span>
              </button>
              {openType === t.id && (
                <div className="card" style={{ margin: 0 }}>
                  <TypeEditor
                    t={t}
                    data={data}
                    onChange={(nt) => setType(t.id, nt)}
                    onDelete={() => setS((prev) => ({
                      ...prev,
                      types: prev.types.filter((x) => x.id !== t.id),
                      panels: prev.panels.map((p) => ({ ...p, typeIds: p.typeIds.filter((id) => id !== t.id) })),
                    }))}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card stack">
        <div className="row">
          <h2 style={{ margin: 0 }}>Paneles</h2>
          <span className="muted">{s.panels.length} de {limits.maxTicketPanels}</span>
          <span className="spacer" />
          <button
            className="btn-sm"
            disabled={s.panels.length >= limits.maxTicketPanels || s.types.length === 0}
            onClick={() =>
              setS((prev) => ({
                ...prev,
                panels: [...prev.panels, { id: newId('p_'), channelId: '', title: 'Tickets', description: 'Pulsa un botón para abrir un ticket.', typeIds: prev.types.map((t) => t.id) }],
              }))
            }
          >
            + Panel
          </button>
        </div>
        <p className="muted small" style={{ margin: 0 }}>El panel es el mensaje con los botones. Guarda y pulsa «Publicar en Discord».</p>
        {s.panels.map((p) => (
          <PanelEditor
            key={p.id}
            p={{ ...p, url: data.tickets.panels.find((x) => x.id === p.id && x.channelId === p.channelId)?.url ?? null }}
            types={s.types}
            data={data}
            dirty={dirty}
            onChange={({ url: _u, ...np }) => (void _u, setPanel(p.id, np))}
            onDelete={() => setS((prev) => ({ ...prev, panels: prev.panels.filter((x) => x.id !== p.id) }))}
            onPublish={() => void save(() => api.publishTicketPanel(data.guild.id, p.id), 'Panel publicado')}
          />
        ))}
      </div>

      <div className="row">
        <button className="btn-primary" disabled={!dirty} onClick={() => void submit()}>Guardar cambios</button>
        {dirty && <button className="btn-ghost" onClick={() => setS(initial())}>Descartar</button>}
      </div>

      <div className="card stack">
        <h2>Tickets abiertos ({data.tickets.open.length})</h2>
        {data.tickets.open.length === 0 ? (
          <p className="muted">No hay tickets abiertos.</p>
        ) : (
          <div className="list">
            {data.tickets.open.map((o) => (
              <div key={o.id} className="list-item">
                <span className="muted">#{o.number}</span>
                <span style={{ flex: 1 }}>
                  <b>{o.typeName}</b> · {o.userName}
                  {o.character && <span className="muted"> · 🧙 {o.character}</span>}
                </span>
                {o.claimed ? <span className="badge premium">Atendido</span> : <span className="badge">Sin atender</span>}
                <a className="btn btn-sm" href={o.url} target="_blank" rel="noreferrer">Abrir</a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
