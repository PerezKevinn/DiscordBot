import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';
import type { Me } from './types';
import { GuildPicker } from './components/GuildPicker';
import { GuildPanel } from './components/GuildPanel';
import { ToastProvider } from './components/Toast';

/** Ruta mínima con el hash: #/ (servidores) o #/g/<id>/<pestaña> */
function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const m = hash.match(/^#\/g\/(\d{15,25})(?:\/([a-z]+))?/);
  return { guildId: m?.[1] ?? null, tab: m?.[2] ?? 'pings' };
}

export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<'loading' | 'login' | 'ready' | 'error'>('loading');
  const route = useHashRoute();
  const loginError = new URLSearchParams(window.location.search).get('error') === 'login';

  const load = useCallback(async () => {
    try {
      setMe(await api.me());
      // Volver a la pantalla que se quería abrir antes de iniciar sesión (p. ej. desde el botón "Configurar")
      const pending = sessionStorage.getItem('massup_after_login');
      if (pending) {
        sessionStorage.removeItem('massup_after_login');
        if (!window.location.hash && /^#\/g\/\d{15,25}\/[a-z]+$/.test(pending)) window.location.hash = pending;
      }
      setState('ready');
    } catch (err) {
      setState(err instanceof ApiError && err.status === 401 ? 'login' : 'error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === 'loading') return <div className="login"><p className="muted">Cargando…</p></div>;

  if (state === 'login') {
    return (
      <div className="login">
        <div>
          <img src="/avatar.png" alt="" />
          <h1>Panel de MassUp</h1>
          <p className="muted">Administra los pings, contenidos, compos y builds de tu gremio.</p>
          {loginError && <p className="notice">No se pudo iniciar sesión. Inténtalo de nuevo.</p>}
          <a
            className="btn btn-discord"
            href="/auth/login"
            onClick={() => window.location.hash && sessionStorage.setItem('massup_after_login', window.location.hash)}
          >
            Entrar con Discord
          </a>
          <p className="muted small" style={{ marginTop: 16 }}>
            Solo leemos tu usuario y la lista de tus servidores. Nunca actuamos en tu nombre.
          </p>
        </div>
      </div>
    );
  }

  if (state === 'error' || !me) {
    return (
      <div className="login">
        <div>
          <h2>No se pudo conectar con el panel</h2>
          <button onClick={() => void load()}>Reintentar</button>
        </div>
      </div>
    );
  }

  const logout = async () => {
    await api.logout().catch(() => null);
    window.location.hash = '';
    setState('login');
  };

  return (
    <ToastProvider>
      <header className="topbar">
        <a className="brand" href="#/">
          <img src="/avatar.png" alt="" />
          MassUp
        </a>
        <span className="spacer" />
        <span className="user">
          {me.user.avatar && <img src={me.user.avatar} alt="" />}
          {me.user.name}
        </span>
        <button className="btn-ghost btn-sm" onClick={() => void logout()}>Salir</button>
      </header>
      <main className="page">
        {route.guildId ? (
          <GuildPanel key={route.guildId} guildId={route.guildId} tab={route.tab} />
        ) : (
          <GuildPicker guilds={me.guilds} />
        )}
      </main>
    </ToastProvider>
  );
}
