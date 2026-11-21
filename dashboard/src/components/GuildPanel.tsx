/** Panel de un servidor: navegación lateral, la sección elegida y el guardado común que usan todas ellas. */
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import type { GuildData } from '../types';
import { GuildNav, NAV, NAV_IDS } from './GuildNav';
import { useToast } from './Toast';
import { PingsTab } from './PingsTab';
import { SettingsTab } from './SettingsTab';
import { ContentsTab } from './ContentsTab';
import { BrandingTab } from './BrandingTab';
import { PlanTab } from './PlanTab';
import { PointsTab } from './PointsTab';
import { LootTab } from './LootTab';
import { TicketsTab } from './TicketsTab';

/**
 * Ejecuta una llamada que devuelve el servidor actualizado, sustituye los datos y muestra un aviso.
 * Devuelve false si falló; el error ya se ha mostrado.
 */
export type Save = (fn: () => Promise<GuildData>, okText?: string) => Promise<boolean>;

/** Carga los datos del servidor y muestra la sección indicada en la URL. */
export function GuildPanel({ guildId, tab }: { guildId: string; tab: string }) {
  const [data, setData] = useState<GuildData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.guild(guildId).then(setData, (e: Error) => setError(e.message));
  }, [guildId]);

  const save: Save = useCallback(
    async (fn, okText = 'Guardado') => {
      try {
        setData(await fn());
        toast(okText);
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          // Sesión caducada: los cambios del editor siguen guardados como borrador en el navegador.
          setExpired(true);
          toast('Tu sesión caducó. Inicia sesión para guardar; tus cambios no se pierden.', true);
          return false;
        }
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

  const current = NAV_IDS.includes(tab) ? tab : NAV_IDS[0];

  return (
    <div className="guild-layout">
      <GuildNav data={data} current={current} />
      <div className="guild-main">
        <h1 className="section-title">{NAV.flatMap((g) => g.items).find((i) => i.id === current)?.label}</h1>
        {expired && (
          <p className="notice row">
            🔒 Tu sesión caducó. Tus cambios sin guardar están a salvo en este navegador: inicia sesión y podrás recuperarlos.
            <span className="spacer" />
            <a
              className="btn btn-sm btn-primary"
              href="/auth/login"
              onClick={() => {
                // Vuelve a esta misma pestaña del panel después de iniciar sesión.
                try {
                  sessionStorage.setItem('massup_after_login', window.location.hash);
                } catch {
                  // Sin almacenamiento: tras el login se vuelve al inicio.
                }
              }}
            >
              Iniciar sesión
            </a>
          </p>
        )}

        {current === 'pings' && <PingsTab data={data} save={save} />}
        {current === 'contenidos' && <ContentsTab data={data} save={save} />}
        {current === 'ajustes' && <SettingsTab data={data} save={save} />}
        {current === 'puntos' && <PointsTab data={data} />}
        {current === 'loot' && <LootTab data={data} />}
        {current === 'tickets' && <TicketsTab data={data} save={save} />}
        {current === 'marca' && <BrandingTab data={data} save={save} />}
        {current === 'plan' && <PlanTab data={data} save={save} />}
      </div>
    </div>
  );
}
