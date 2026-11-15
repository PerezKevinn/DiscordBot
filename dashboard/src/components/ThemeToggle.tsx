/** Botón para cambiar entre tema claro y oscuro. */
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const current = (): Theme => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

/** Botón luna/sol: cambia el tema y lo recuerda en localStorage; public/theme.js lo aplica al cargar. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(current);

  useEffect(() => {
    // Si el sistema cambia de tema y el usuario no eligió uno, lo aplica theme.js; aquí solo se refleja.
    const obs = new MutationObserver(() => setTheme(current()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#0b0e14' : '#f5f7fa');
    try {
      localStorage.setItem('massup-theme', next);
    } catch {
      // Sin almacenamiento: la elección solo dura esta visita.
    }
    setTheme(next);
  };

  const label = `Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`;
  return (
    <button type="button" className={`theme-toggle ${className}`.trim()} onClick={toggle} aria-label={label} title={label}>
      <svg className="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
      </svg>
      <svg className="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    </button>
  );
}
