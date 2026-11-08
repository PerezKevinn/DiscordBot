import { useState } from 'react';
import { api } from '../api';
import type { GuildData } from '../types';
import type { Save } from './GuildPanel';

const MAX_LOGO_BYTES = 4 * 1024 * 1024;

export function BrandingTab({ data, save }: { data: GuildData; save: Save }) {
  const premium = data.plan.limits.customBranding;
  const [b, setB] = useState(data.branding);
  const dirty =
    b.guildName !== data.branding.guildName ||
    b.guildTag !== data.branding.guildTag ||
    b.motto !== data.branding.motto ||
    b.color !== data.branding.color;

  const onLogo = (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > MAX_LOGO_BYTES) {
      window.alert('El logo debe ser PNG, JPG o WEBP de máximo 4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => void save(() => api.uploadLogo(data.guild.id, String(reader.result)), 'Logo actualizado');
    reader.readAsDataURL(file);
  };

  return (
    <div className="stack">
      {!premium && (
        <p className="notice">
          💎 La marca propia es una función <strong>Premium</strong>. En el plan gratis los pings usan el nombre y el icono
          de tu servidor de Discord.
        </p>
      )}
      <fieldset disabled={!premium} style={{ border: 'none', padding: 0, margin: 0 }} className="stack">
        <div className="card stack">
          <h2>Nombre y estilo</h2>
          <div className="grid-2">
            <label className="field">
              Nombre del gremio
              <input value={b.guildName} maxLength={40} onChange={(e) => setB({ ...b, guildName: e.target.value })} />
            </label>
            <label className="field">
              Siglas
              <input value={b.guildTag} maxLength={8} placeholder="[KOS]" onChange={(e) => setB({ ...b, guildTag: e.target.value })} />
            </label>
            <label className="field">
              Lema
              <input value={b.motto} maxLength={80} onChange={(e) => setB({ ...b, motto: e.target.value })} />
            </label>
            <label className="field">
              Color de los mensajes
              <input type="color" value={b.color} onChange={(e) => setB({ ...b, color: e.target.value.toUpperCase() })} />
            </label>
          </div>
          <div className="row">
            <button className="btn-primary" disabled={!dirty} onClick={() => void save(() => api.saveBranding(data.guild.id, b))}>
              Guardar marca
            </button>
          </div>
        </div>

        <div className="card stack">
          <h2>Logo del banner</h2>
          <p className="muted">
            {data.branding.customLogo
              ? 'Tienes un logo propio. Se recorta en cuadrado y aparece en el banner de cada ping.'
              : 'Ahora se usa el icono de tu servidor de Discord.'}
          </p>
          <div className="row">
            <label className="btn">
              Subir logo
              <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => onLogo(e.target.files?.[0])} />
            </label>
            {data.branding.customLogo && (
              <button className="btn-danger" onClick={() => void save(() => api.deleteLogo(data.guild.id), 'Logo quitado')}>
                Quitar logo
              </button>
            )}
          </div>
        </div>
      </fieldset>
    </div>
  );
}
