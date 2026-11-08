import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { BUILD_SLOTS, iconUrl, type CatalogItem, type ItemSlot } from '../types';

// El catálogo (≈450 ítems) se carga una vez y se busca en el navegador
let catalogPromise: Promise<CatalogItem[]> | null = null;
export function useCatalog() {
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  useEffect(() => {
    catalogPromise ??= api.items();
    catalogPromise.then(setItems, () => {
      catalogPromise = null;
    });
  }, []);
  return items;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function ItemPicker({ slot, selected, onPick, onClose }: {
  slot: ItemSlot;
  selected?: string;
  onPick: (id: string | null) => void;
  onClose: () => void;
}) {
  const catalog = useCatalog();
  const [q, setQ] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const label = BUILD_SLOTS.find((s) => s.slot === slot)?.label ?? slot;

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const results = useMemo(() => {
    if (!catalog) return [];
    const pool = catalog.filter((i) => i.slot === slot);
    const n = norm(q.trim());
    if (!n) return pool;
    return pool.filter((i) => norm(i.name).includes(n) || norm(i.en).includes(n));
  }, [catalog, slot, q]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={`Elegir ${label}`}>
        <div className="modal-head">
          <div className="row">
            <h3 style={{ margin: 0 }}>Elegir {label.toLowerCase()}</h3>
            <span className="spacer" />
            {selected && (
              <button className="btn-sm btn-danger" onClick={() => onPick(null)}>Quitar</button>
            )}
            <button className="btn-sm btn-ghost" onClick={onClose} aria-label="Cerrar">✕</button>
          </div>
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busca en español o inglés: maza, incubus, bastón sagrado…"
          />
        </div>
        <div className="modal-body">
          {!catalog ? (
            <p className="muted">Cargando ítems…</p>
          ) : results.length === 0 ? (
            <p className="empty">No hay resultados para “{q}”.</p>
          ) : (
            <div className="item-grid">
              {results.map((i) => (
                <button
                  key={i.id}
                  className={`item-btn${i.id === selected ? ' selected' : ''}`}
                  onClick={() => onPick(i.id)}
                  title={i.en}
                >
                  <img src={iconUrl(i, 64)} alt="" loading="lazy" />
                  <span>
                    {i.name}
                    {i.tier ? <span className="muted"> · T{i.tier}</span> : null}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
