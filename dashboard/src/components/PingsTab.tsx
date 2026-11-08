import { api } from '../api';
import type { GuildData } from '../types';
import type { Save } from './GuildPanel';

function relative(unix: number) {
  const diff = Math.round((unix * 1000 - Date.now()) / 60000);
  if (Math.abs(diff) < 1) return 'ahora';
  const abs = Math.abs(diff);
  const text = abs >= 60 ? `${Math.floor(abs / 60)} h ${abs % 60} min` : `${abs} min`;
  return diff > 0 ? `en ${text}` : `hace ${text}`;
}

export function PingsTab({ data, save }: { data: GuildData; save: Save }) {
  const channelName = (id: string) => data.discord.channels.find((c) => c.id === id)?.name ?? 'canal';

  const close = (pingId: string, status: 'CLOSED' | 'CANCELLED') => {
    const verb = status === 'CLOSED' ? 'cerrar (GG)' : 'cancelar';
    if (!window.confirm(`¿Seguro que quieres ${verb} este ping? Se borrarán su voz y su hilo.`)) return;
    void save(() => api.closePing(data.guild.id, pingId, status), status === 'CLOSED' ? 'Ping cerrado' : 'Ping cancelado');
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2 style={{ margin: 0 }}>Pings abiertos</h2>
          <span className="muted small">
            {data.pings.length} de {data.plan.limits.maxActivePings} permitidos por tu plan
          </span>
        </div>
        {data.pings.length === 0 ? (
          <p className="empty">No hay pings abiertos. Tira uno en Discord con <code>/ping</code>.</p>
        ) : (
          <div className="list">
            {data.pings.map((p) => (
              <div key={p.id} className="list-item">
                <div style={{ flex: 1, minWidth: 220 }}>
                  <strong>{p.title}</strong>{' '}
                  <span className="badge">{p.status === 'OPEN' ? 'Abierto' : 'En ruta'}</span>
                  <div className="muted small">
                    #{channelName(p.channelId)} · Caller {p.callerName} · salida {relative(p.startTimeUnix)} ·{' '}
                    {p.joined}
                    {p.max ? `/${p.max}` : ''} anotados
                  </div>
                </div>
                <a className="btn btn-sm" href={p.url} target="_blank" rel="noopener">Ver en Discord</a>
                <button className="btn-sm" onClick={() => close(p.id, 'CLOSED')}>GG</button>
                <button className="btn-sm btn-danger" onClick={() => close(p.id, 'CANCELLED')}>Cancelar</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
