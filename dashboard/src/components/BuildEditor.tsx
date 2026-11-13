import { useState } from 'react';
import { BUILD_SLOTS, iconUrl, type ItemSlot, type RoleBuild } from '../types';
import { ItemPicker, useCatalog } from './ItemPicker';

/**
 * Fila de 9 huecos (arma, mano secundaria, cabeza…) como en el inventario del juego.
 * Con `base` es un swap: solo se guardan los huecos que cambian y los demás muestran,
 * en tenue, lo que se hereda de la build principal.
 */
export function BuildEditor({ build, onChange, base }: { build: RoleBuild; onChange: (b: RoleBuild) => void; base?: RoleBuild }) {
  const catalog = useCatalog();
  const [picking, setPicking] = useState<ItemSlot | null>(null);
  const byId = (id?: string) => (id && catalog ? catalog.find((i) => i.id === id) : undefined);
  const isSwap = Boolean(base);
  // En un swap manda el arma del swap; si no la cambia, la de la build principal
  const weapon = build.weapon ?? base?.weapon;
  const twoHanded = Boolean(weapon?.startsWith('2H_'));

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
          const own = byId(build[slot]);
          const inherited = !own && isSwap ? byId(base?.[slot]) : undefined;
          const item = own ?? inherited;
          const disabled = slot === 'offhand' && twoHanded;
          const caption = disabled ? 'Dos manos' : own ? own.name : inherited ? 'Igual' : isSwap ? 'Sin cambio' : '—';
          return (
            <div key={slot}>
              <button
                type="button"
                className={`slot${disabled ? ' disabled' : ''}${inherited ? ' inherited' : ''}${isSwap && own ? ' swapped' : ''}`}
                disabled={disabled}
                onClick={() => setPicking(slot)}
                title={
                  disabled
                    ? 'Arma a dos manos'
                    : own
                      ? `${label}: ${own.name}${isSwap ? ' (cambia en este swap)' : ''}`
                      : inherited
                        ? `${label}: igual que la build principal (${inherited.name}). Clic para cambiarlo en este swap.`
                        : `Elegir ${label.toLowerCase()}`
                }
              >
                {item ? <img src={iconUrl(item, 96)} alt={item.name} /> : <span className="slot-label">{label}</span>}
              </button>
              <div className="slot-caption">{caption}</div>
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
