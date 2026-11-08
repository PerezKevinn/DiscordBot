import type { Me } from '../types';

export function GuildIcon({ name, icon, size = 44 }: { name: string; icon: string | null; size?: number }) {
  if (icon) return <img src={icon} alt="" style={{ width: size, height: size }} />;
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
  return (
    <span className="guild-avatar" style={{ width: size, height: size }}>
      {initials}
    </span>
  );
}

export function GuildPicker({ guilds }: { guilds: Me['guilds'] }) {
  const withBot = guilds.filter((g) => g.botPresent);
  const withoutBot = guilds.filter((g) => !g.botPresent);

  return (
    <div className="stack">
      <div>
        <h1>Tus servidores</h1>
        <p className="muted">Solo aparecen los servidores donde tienes el permiso Gestionar servidor.</p>
      </div>

      {withBot.length === 0 && withoutBot.length === 0 && (
        <div className="card empty">No administras ningún servidor de Discord.</div>
      )}

      {withBot.length > 0 && (
        <div className="guild-grid">
          {withBot.map((g) => (
            <a key={g.id} className="guild-card btn" href={`#/g/${g.id}/pings`}>
              <GuildIcon name={g.name} icon={g.icon} />
              <span>{g.name}</span>
            </a>
          ))}
        </div>
      )}

      {withoutBot.length > 0 && (
        <>
          <h3 style={{ marginTop: 12 }}>Añadir MassUp</h3>
          <div className="guild-grid">
            {withoutBot.map((g) => (
              <a key={g.id} className="guild-card btn off" href={g.inviteUrl} target="_blank" rel="noopener">
                <GuildIcon name={g.name} icon={g.icon} />
                <span>
                  {g.name}
                  <br />
                  <span className="muted small">Invitar el bot →</span>
                </span>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
