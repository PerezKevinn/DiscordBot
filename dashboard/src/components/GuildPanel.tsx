import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { GuildData } from '../types';
import { GuildIcon } from './GuildPicker';
import { useToast } from './Toast';
import { PingsTab } from './PingsTab';
import { SettingsTab } from './SettingsTab';
import { ContentsTab } from './ContentsTab';
import { BrandingTab } from './BrandingTab';
import { PlanTab } from './PlanTab';
import { PointsTab } from './PointsTab';

const TABS = [
  { id: 'pings', label: 'Pings activos' },
  { id: 'contenidos', label: 'Contenidos y builds' },
  { id: 'ajustes', label: 'Ajustes' },
  { id: 'puntos', label: 'Puntos' },
  { id: 'marca', label: 'Marca' },
  { id: 'plan', label: 'Plan' },
];

export type Save = (fn: () => Promise<GuildData>, okText?: string) => Promise<boolean>;

export function GuildPanel({ guildId, tab }: { guildId: string; tab: string }) {
  const [data, setData] = useState<GuildData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    api.guild(guildId).then(setData, (e: Error) => setError(e.message));
  }, [guildId]);

  /** Ejecuta un guardado, actualiza los datos y avisa. */
  const save: Save = useCallback(
    async (fn, okText = 'Guardado') => {
      try {
        setData(await fn());
        toast(okText);
        return true;
      } catch (e) {
        toast((e as Error).message, true);
        return false;
      }
    },
    [toast]
  );

  if (error) {
    return (
      <div className="card empty">
        <p>{error}</p>
        <a className="btn" href="#/">Volver a mis servidores</a>
      </div>
    );
  }
  if (!data) return <p className="muted">Cargando servidor…</p>;

  const current = TABS.some((t) => t.id === tab) ? tab : 'pings';

  return (
    <div>
      <div className="guild-head">
        <GuildIcon name={data.guild.name} icon={data.guild.icon} size={52} />
        <div>
          <h1 style={{ margin: 0 }}>{data.guild.name}</h1>
          <span className={`badge${data.plan.tier === 'premium' ? ' premium' : ''}`}>
            {data.plan.tier === 'premium' ? '💎 Premium' : 'Plan gratis'}
          </span>
        </div>
        <span className="spacer" />
        <a className="btn btn-sm" href="#/">Cambiar de servidor</a>
      </div>

      <nav className="tabs">
        {TABS.map((t) => (
          <a key={t.id} className={`tab btn${t.id === current ? ' active' : ''}`} href={`#/g/${guildId}/${t.id}`}>
            {t.label}
            {t.id === 'pings' && data.pings.length > 0 ? ` (${data.pings.length})` : ''}
          </a>
        ))}
      </nav>

      {current === 'pings' && <PingsTab data={data} save={save} />}
      {current === 'contenidos' && <ContentsTab data={data} save={save} />}
      {current === 'ajustes' && <SettingsTab data={data} save={save} />}
      {current === 'puntos' && <PointsTab data={data} />}
      {current === 'marca' && <BrandingTab data={data} save={save} />}
      {current === 'plan' && <PlanTab data={data} save={save} />}
    </div>
  );
}
