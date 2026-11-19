/**
 * Navegación del panel de un servidor: barra lateral agrupada por secciones en escritorio y menú
 * desplegable en móvil. Para añadir un módulo nuevo basta con añadir una entrada a NAV y su
 * componente en GuildPanel.
 */
import { useEffect, useState, type ReactNode } from 'react';
import type { GuildData } from '../types';
import { GuildIcon } from './GuildPicker';

/** Entrada del menú. badge devuelve un contador opcional a partir de los datos del servidor. */
export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: (data: GuildData) => number | null;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Iconos de trazo de 24×24; heredan el color del texto.
const svg = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
const ICONS = {
  pings: svg(<><path d="M14.5 17.5 3 6V3h3l11.5 11.5" /><path d="m13 19 6-6" /><path d="m16 16 4 4" /><path d="m19 21 2-2" /></>),
  points: svg(<><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M17 5h3v2a3 3 0 0 1-3 3" /><path d="M7 5H4v2a3 3 0 0 0 3 3" /></>),
  tickets: svg(<><path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4V8z" /><path d="M9 6v12" strokeDasharray="2 2" /></>),
  contents: svg(<><path d="M12 3 3 8l9 5 9-5-9-5z" /><path d="m3 13 9 5 9-5" /></>),
  settings: svg(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>),
  brand: svg(<><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z" /><path d="m9 12 2 2 4-4" /></>),
  plan: svg(<><path d="M6 3h12l4 6-10 12L2 9l4-6z" /><path d="M2 9h20" /><path d="m12 21-4-12 4-6 4 6-4 12" /></>),
  chevron: svg(<path d="m6 9 6 6 6-6" />),
};

/** Secciones del panel, en orden. */
export const NAV: NavGroup[] = [
  {
    label: 'Actividad',
    items: [
      { id: 'pings', label: 'Pings activos', icon: ICONS.pings, badge: (d) => d.pings.length || null },
      { id: 'puntos', label: 'Puntos', icon: ICONS.points },
    ],
  },
  {
    label: 'Gremio',
    items: [{ id: 'tickets', label: 'Tickets', icon: ICONS.tickets, badge: (d) => d.tickets.open.length || null }],
  },
  {
    label: 'Configuración',
    items: [
      { id: 'contenidos', label: 'Contenidos y builds', icon: ICONS.contents },
      { id: 'ajustes', label: 'Ajustes', icon: ICONS.settings },
      { id: 'marca', label: 'Marca', icon: ICONS.brand },
    ],
  },
  {
    label: 'Cuenta',
    items: [{ id: 'plan', label: 'Plan', icon: ICONS.plan }],
  },
];

/** Ids de todas las secciones; la primera es la que se abre por defecto. */
export const NAV_IDS = NAV.flatMap((g) => g.items.map((i) => i.id));

/** Barra lateral (escritorio) o menú desplegable (móvil) con las secciones del servidor. */
export function GuildNav({ data, current }: { data: GuildData; current: string }) {
  const [open, setOpen] = useState(false);
  // Al cambiar de sección en móvil, el menú se cierra solo.
  useEffect(() => setOpen(false), [current]);

  const active = NAV.flatMap((g) => g.items).find((i) => i.id === current);
  const premium = data.plan.tier === 'premium';

  return (
    <aside className="side">
      <div className="side-guild">
        <GuildIcon name={data.guild.name} icon={data.guild.icon} size={40} />
        <div className="side-guild-text">
          <strong title={data.guild.name}>{data.guild.name}</strong>
          <span className={`badge${premium ? ' premium' : ''}`}>{premium ? '💎 Premium' : 'Plan gratis'}</span>
        </div>
      </div>
      <a className="side-switch" href="#/">Cambiar de servidor</a>

      <button className="side-toggle" aria-expanded={open} aria-controls="side-nav" onClick={() => setOpen((v) => !v)}>
        {active?.icon}
        <span>{active?.label ?? 'Secciones'}</span>
        <span className="spacer" />
        <span className={`side-chevron${open ? ' open' : ''}`}>{ICONS.chevron}</span>
      </button>

      <nav id="side-nav" className={`side-nav${open ? ' open' : ''}`} aria-label="Secciones del servidor">
        {NAV.map((g) => (
          <div key={g.label} className="side-group">
            <span className="side-label">{g.label}</span>
            {g.items.map((item) => {
              const badge = item.badge?.(data) ?? null;
              return (
                <a
                  key={item.id}
                  href={`#/g/${data.guild.id}/${item.id}`}
                  className={`side-item${item.id === current ? ' active' : ''}`}
                  aria-current={item.id === current ? 'page' : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {badge !== null && <span className="side-count">{badge}</span>}
                </a>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
