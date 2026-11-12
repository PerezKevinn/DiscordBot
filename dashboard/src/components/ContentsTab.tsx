import { useState } from 'react';
import { api } from '../api';
import type { Content, GuildData, Role } from '../types';
import type { Save } from './GuildPanel';
import { BuildEditor } from './BuildEditor';

const COMMON_EMOJIS = ['🛡️', '⚔️', '⛓️', '💚', '✨', '🌿', '🍃', '🔮', '⚡', '🗡️', '🔥', '💥', '🏹', '❄️', '👁️', '🔍', '⛏️', '🐎', '💰', '🚩'];

const blankRole = (): Role => ({ name: '', weapons: '', emoji: '⚔️', maxSlots: 1, description: '', build: {} });
const blankContent = (): Content => ({
  id: '',
  name: '',
  emoji: '🔥',
  subtitle: 'OBJETIVO DEL GREMIO',
  accentColor: '#D4AF37',
  defaultGearTier: 'Equivalente T8',
  defaultMount: 'Garrapresta',
  defaultZone: 'Escondite (HO)',
  createVoice: true,
  createThread: true,
  roles: [
    { ...blankRole(), name: 'Tanque', emoji: '🛡️' },
    { ...blankRole(), name: 'Sanador', emoji: '💚' },
    { ...blankRole(), name: 'Daño', emoji: '🗡️', maxSlots: 3 },
  ],
});

/** Copia de un contenido como contenido nuevo: misma compo y builds, sin ids. */
const duplicateContent = (c: Content): Content => {
  const copy = structuredClone(c);
  const suffix = ' (copia)';
  return {
    ...copy,
    id: '',
    name: `${copy.name.slice(0, 60 - suffix.length)}${suffix}`,
    roles: copy.roles.map(({ id: _id, ...r }) => r),
  };
};

export function ContentsTab({ data, save }: { data: GuildData; save: Save }) {
  const [editing, setEditing] = useState<Content | null>(null);
  const atLimit = data.contents.length >= data.plan.limits.maxContentTypes;

  if (editing) {
    return (
      <ContentEditor
        key={editing.id || `nuevo-${editing.name}`}
        data={data}
        initial={editing}
        save={save}
        onDone={() => setEditing(null)}
        onDuplicate={atLimit ? undefined : (c) => setEditing(duplicateContent(c))}
      />
    );
  }

  const builds = (c: Content) => c.roles.filter((r) => Object.keys(r.build).length > 0).length;

  return (
    <div className="stack">
      <div className="row">
        <p className="muted" style={{ margin: 0 }}>
          {data.contents.length} de {data.plan.limits.maxContentTypes} contenidos. Haz clic en uno para editar su compo y sus builds.
        </p>
        <span className="spacer" />
        <button className="btn-primary" disabled={atLimit} onClick={() => setEditing(blankContent())}>+ Nuevo contenido</button>
      </div>
      <div className="list">
        {data.contents.map((c) => {
          const slots = c.roles.some((r) => r.maxSlots === 0) ? null : c.roles.reduce((a, r) => a + r.maxSlots, 0);
          return (
            <div key={c.id} className="list-item clickable" onClick={() => setEditing(structuredClone(c))} role="button" tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setEditing(structuredClone(c))}>
              <span className="emoji">{c.emoji}</span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <strong>{c.name}</strong>
                <div className="muted small">
                  {c.roles.map((r) => `${r.emoji} ${r.name}`).join(' · ')}
                </div>
              </div>
              <span className="muted small">{c.roles.length} roles{slots ? ` · ${slots} cupos` : ''}</span>
              <span className={`badge${builds(c) > 0 ? ' ok' : ''}`}>🧩 {builds(c)}/{c.roles.length} builds</span>
              <button
                className="btn-sm btn-ghost"
                disabled={atLimit}
                title={atLimit ? 'Llegaste al límite de contenidos de tu plan' : 'Crear un contenido nuevo con esta compo y sus builds'}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(duplicateContent(c));
                }}
                onKeyDown={(e) => e.stopPropagation()}
              >
                ⧉ Duplicar
              </button>
            </div>
          );
        })}
      </div>
      <div className="row">
        <button
          className="btn-ghost btn-sm"
          onClick={() =>
            window.confirm('Esto vuelve a las plantillas por defecto y borra tus contenidos personalizados y sus builds. ¿Seguro?') &&
            void save(() => api.resetContents(data.guild.id), 'Plantillas restablecidas')
          }
        >
          Restablecer plantillas por defecto
        </button>
      </div>
    </div>
  );
}

function ContentEditor({
  data,
  initial,
  save,
  onDone,
  onDuplicate,
}: {
  data: GuildData;
  initial: Content;
  save: Save;
  onDone: () => void;
  /** Sin valor = no se puede duplicar (límite del plan) */
  onDuplicate?: (c: Content) => void;
}) {
  const [c, setC] = useState<Content>(initial);
  const isNew = !initial.id;
  const set = <K extends keyof Content>(k: K, v: Content[K]) => setC((p) => ({ ...p, [k]: v }));
  const setRole = (i: number, patch: Partial<Role>) =>
    setC((p) => ({ ...p, roles: p.roles.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const duplicateRole = (i: number) =>
    setC((p) => {
      if (p.roles.length >= 20) return p;
      const { id: _id, ...copy } = structuredClone(p.roles[i]);
      const roles = [...p.roles];
      roles.splice(i + 1, 0, copy);
      return { ...p, roles };
    });
  const moveRole = (i: number, d: -1 | 1) =>
    setC((p) => {
      const roles = [...p.roles];
      const j = i + d;
      if (j < 0 || j >= roles.length) return p;
      [roles[i], roles[j]] = [roles[j], roles[i]];
      return { ...p, roles };
    });

  const submit = async () => {
    const { id, ...rest } = c;
    const body = { ...rest, createVoice: c.createVoice !== false, createThread: c.createThread !== false };
    const ok = await save(
      () => (isNew ? api.createContent(data.guild.id, body) : api.saveContent(data.guild.id, id, body)),
      isNew ? 'Contenido creado' : 'Contenido guardado'
    );
    if (ok) onDone();
  };

  const remove = () => {
    if (!window.confirm(`¿Borrar "${initial.name}"? No se puede deshacer.`)) return;
    void save(() => api.deleteContent(data.guild.id, initial.id), 'Contenido borrado').then((ok) => ok && onDone());
  };

  const total = c.roles.some((r) => r.maxSlots === 0) ? null : c.roles.reduce((a, r) => a + r.maxSlots, 0);

  return (
    <div className="stack">
      <div className="row">
        <button className="btn-ghost" onClick={onDone}>← Volver</button>
        <h2 style={{ margin: 0 }}>{isNew ? 'Nuevo contenido' : `${initial.emoji} ${initial.name}`}</h2>
      </div>

      <div className="card stack">
        <h3>Datos del contenido</h3>
        <div className="grid-3">
          <label className="field">
            Nombre
            <input value={c.name} maxLength={60} onChange={(e) => set('name', e.target.value)} placeholder="Gankeo en Tierras Lejanas" />
          </label>
          <label className="field">
            Emoji
            <input value={c.emoji} maxLength={16} onChange={(e) => set('emoji', e.target.value)} />
          </label>
          <label className="field">
            Color del banner
            <input type="color" value={c.accentColor} onChange={(e) => set('accentColor', e.target.value.toUpperCase())} />
          </label>
          <label className="field">
            Subtítulo del banner
            <input value={c.subtitle} maxLength={60} onChange={(e) => set('subtitle', e.target.value)} />
          </label>
          <label className="field">
            IP / build por defecto
            <input value={c.defaultGearTier} maxLength={100} onChange={(e) => set('defaultGearTier', e.target.value)} />
          </label>
          <label className="field">
            Montura por defecto
            <input value={c.defaultMount} maxLength={100} onChange={(e) => set('defaultMount', e.target.value)} />
          </label>
          <label className="field">
            Lugar de masa por defecto
            <input value={c.defaultZone} maxLength={100} onChange={(e) => set('defaultZone', e.target.value)} />
          </label>
        </div>
        <div className="row" style={{ gap: 24 }}>
          <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 18, height: 18 }} checked={c.createVoice !== false}
              onChange={(e) => set('createVoice', e.target.checked)} />
            Crear canal de voz temporal al publicar
          </label>
          <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 18, height: 18 }} checked={c.createThread !== false}
              onChange={(e) => set('createThread', e.target.checked)} />
            Crear hilo de builds al publicar
          </label>
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          Todo esto es lo que usa cada <code>/ping</code> de este contenido: en Discord solo se elige la hora y el canal.
        </p>
      </div>

      <div className="card stack">
        <div className="card-head" style={{ margin: 0 }}>
          <h3 style={{ margin: 0 }}>Compo y builds</h3>
          <span className="muted small">{c.roles.length} roles · {total ? `${total} cupos` : 'algún rol sin límite'}</span>
          <span className="spacer" />
          <button className="btn-sm" disabled={c.roles.length >= 20} onClick={() => set('roles', [...c.roles, blankRole()])}>+ Añadir rol</button>
        </div>

        {c.roles.map((r, i) => (
          <div key={r.id ?? `nuevo-${i}`} className="role-card">
            <div className="role-top">
              <label className="field">
                Emoji
                <select value={r.emoji} onChange={(e) => setRole(i, { emoji: e.target.value })}>
                  {[...new Set([r.emoji, ...COMMON_EMOJIS])].map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Nombre del rol
                <input value={r.name} maxLength={60} onChange={(e) => setRole(i, { name: e.target.value })} placeholder="Tanque, Sanador, Daño…" />
              </label>
              <label className="field">
                Armas sugeridas (texto)
                <input value={r.weapons} maxLength={80} onChange={(e) => setRole(i, { weapons: e.target.value })} placeholder="Opcional si pones build" />
              </label>
              <label className="field">
                Cupos
                <select value={r.maxSlots} onChange={(e) => setRole(i, { maxSlots: Number(e.target.value) })}>
                  <option value={0}>Sin límite</option>
                  {Array.from({ length: 30 }, (_, n) => n + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <div className="row" style={{ gap: 4 }}>
                <button className="btn-icon btn-ghost" title="Subir" disabled={i === 0} onClick={() => moveRole(i, -1)}>↑</button>
                <button className="btn-icon btn-ghost" title="Bajar" disabled={i === c.roles.length - 1} onClick={() => moveRole(i, 1)}>↓</button>
                <button className="btn-icon btn-ghost" title="Duplicar rol con su build" disabled={c.roles.length >= 20}
                  onClick={() => duplicateRole(i)}>⧉</button>
                <button className="btn-icon btn-danger" title="Quitar rol" disabled={c.roles.length <= 1}
                  onClick={() => set('roles', c.roles.filter((_, j) => j !== i))}>✕</button>
              </div>
            </div>
            <label className="field">
              Descripción (se ve al elegir el rol en Discord)
              <input value={r.description} maxLength={100} onChange={(e) => setRole(i, { description: e.target.value })} />
            </label>
            <BuildEditor build={r.build} onChange={(build) => setRole(i, { build })} />
          </div>
        ))}
      </div>

      <div className="row">
        <button className="btn-primary" onClick={() => void submit()}>{isNew ? 'Crear contenido' : 'Guardar cambios'}</button>
        <button className="btn-ghost" onClick={onDone}>Cancelar</button>
        <span className="spacer" />
        {!isNew && (
          <button
            className="btn-ghost"
            disabled={!onDuplicate}
            title={onDuplicate ? 'Crear un contenido nuevo con esta compo y sus builds (incluye cambios sin guardar)' : 'Llegaste al límite de contenidos de tu plan'}
            onClick={() => onDuplicate?.(c)}
          >
            ⧉ Duplicar contenido
          </button>
        )}
        {!isNew && <button className="btn-danger" onClick={remove}>Borrar contenido</button>}
      </div>
    </div>
  );
}
