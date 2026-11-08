import { useState } from 'react';
import { BUILD_SLOTS, iconUrl, type ItemSlot, type RoleBuild } from '../types';
import { ItemPicker, useCatalog } from './ItemPicker';

/** Fila de 9 huecos (arma, mano secundaria, cabeza…) como en el inventario del juego. */
export function BuildEditor({ build, onChange }: { build: RoleBuild; onChange: (b: RoleBuild) => void }) {
  const catalog = useCatalog();
  const [picking, setPicking] = useState<ItemSlot | null>(null);
  const byId = (id?: string) => (id && catalog ? catalog.find((i) => i.id === id) : undefined);
  const twoHanded = Boolean(build.weapon?.startsWith('2H_'));

  const pick = (slot: ItemSlot, id: string | null) => {
    const next = { ...build };
    if (id) next[slot] = id;
    else delete next[slot];
    // Un arma a dos manos no lleva mano secundaria
    if (slot === 'weapon' && id?.startsWith('2H_')) delete next.offhand;
    onChange(next);
    setPicking(null);
  };

  return (
    <>
      <div className="build">
        {BUILD_SLOTS.map(({ slot, label }) => {
          const item = byId(build[slot]);
          const disabled = slot === 'offhand' && twoHanded;
          return (
            <div key={slot}>
              <button
                type="button"
                className={`slot${disabled ? ' disabled' : ''}`}
                disabled={disabled}
                onClick={() => setPicking(slot)}
                title={disabled ? 'Arma a dos manos' : item ? `${label}: ${item.name}` : `Elegir ${label.toLowerCase()}`}
              >
                {item ? <img src={iconUrl(item, 96)} alt={item.name} /> : <span className="slot-label">{label}</span>}
              </button>
              <div className="slot-caption">{disabled ? 'Dos manos' : item?.name ?? '—'}</div>
            </div>
          );
        })}
      </div>
      {picking && (
        <ItemPicker slot={picking} selected={build[picking]} onPick={(id) => pick(picking, id)} onClose={() => setPicking(null)} />
      )}
    </>
  );
}
