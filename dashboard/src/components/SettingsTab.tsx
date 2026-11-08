import { useState } from 'react';
import { api } from '../api';
import type { GuildData } from '../types';
import type { Save } from './GuildPanel';

type Settings = GuildData['settings'];

function RoleSelect({ value, onChange, roles, emptyLabel }: {
  value: string | null;
  onChange: (v: string | null) => void;
  roles: GuildData['discord']['roles'];
  emptyLabel: string;
}) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{emptyLabel}</option>
      {roles.map((r) => (
        <option key={r.id} value={r.id}>
          @{r.name}
          {r.mentionable ? '' : ' (no mencionable)'}
        </option>
      ))}
    </select>
  );
}

export function SettingsTab({ data, save }: { data: GuildData; save: Save }) {
  const [s, setS] = useState<Settings>(data.settings);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((prev) => ({ ...prev, [k]: v }));
  const dirty = JSON.stringify(s) !== JSON.stringify(data.settings);
  const { roles, channels, categories } = data.discord;

  const submit = async () => {
    // Para quitar un rol de aviso hay que enviarlo como null
    const pingRoles: Record<string, string | null> = { ...s.pingRoles };
    for (const id of Object.keys(data.settings.pingRoles)) if (!(id in s.pingRoles)) pingRoles[id] = null;
    await save(() => api.saveSettings(data.guild.id, { ...s, pingRoles: pingRoles as Record<string, string> }));
  };

  return (
    <div className="stack">
      <div className="card stack">
        <h2>Quién y dónde</h2>
        <div className="grid-2">
          <label className="field">
            Rol de Caller (quién puede tirar pings)
            <RoleSelect value={s.callerRoleId} onChange={(v) => set('callerRoleId', v)} roles={roles} emptyLabel="Cualquier miembro" />
          </label>
          <label className="field">
            Canal de pings por defecto
            <select value={s.pingTargetChannelId ?? ''} onChange={(e) => set('pingTargetChannelId', e.target.value || null)}>
              <option value="">Donde se use /ping</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                  {c.botCanSend ? '' : ' (el bot no puede escribir)'}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Categoría de las voces temporales
            <select value={s.voiceCategoryId ?? ''} onChange={(e) => set('voiceCategoryId', e.target.value || null)}>
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Rol de aviso por defecto
            <RoleSelect value={s.defaultPingRoleId} onChange={(v) => set('defaultPingRoleId', v)} roles={roles} emptyLabel="Ninguno" />
          </label>
        </div>
        {!s.callerRoleId && Object.keys(s.pingRoles).length > 0 && (
          <p className="notice">⚠️ Cualquier miembro puede tirar pings que avisan a tus roles. Elige un rol de Caller para limitarlo.</p>
        )}
      </div>

      <div className="card stack">
        <h2>A quién avisa cada contenido</h2>
        <div className="list">
          {data.contents.map((c) => (
            <div key={c.id} className="list-item">
              <span className="emoji">{c.emoji}</span>
              <span style={{ flex: 1, minWidth: 160 }}>{c.name}</span>
              <div style={{ minWidth: 220 }}>
                <RoleSelect
                  value={s.pingRoles[c.id] ?? null}
                  onChange={(v) => {
                    const next = { ...s.pingRoles };
                    if (v) next[c.id] = v;
                    else delete next[c.id];
                    set('pingRoles', next);
                  }}
                  roles={roles}
                  emptyLabel="Usar el aviso por defecto"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="row">
        <button className="btn-primary" disabled={!dirty} onClick={() => void submit()}>Guardar cambios</button>
        {dirty && <button className="btn-ghost" onClick={() => setS(data.settings)}>Descartar</button>}
      </div>
    </div>
  );
}
