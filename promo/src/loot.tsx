import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Emoji, Mention } from './common';
import { Embed, Reveal, Small, silver, useCount, useFlash } from './discord';
import { DButton } from './common';
import { C } from './theme';

/**
 * Ejemplo del reparto. Los números salen de computeSplit() del bot (src/utils/loot.ts) con
 * total 12.500.000, reparaciones 400.000, recargo 10 %, vendedor 5 %, 7 jugadores y redondeo a 1.000
 * (ver scripts/lootNumbers.ts).
 */
export const LOOT = {
  total: 12_500_000,
  repairs: 400_000,
  taxPct: 10,
  guildTax: 1_210_000,
  sellerPct: 5,
  sellerFee: 605_000,
  net: 10_285_000,
  players: 7,
  perPlayer: 1_469_000,
  remainder: 2_000,
  guildTotal: 1_212_000,
  seller: 'Draven',
  repairsBy: 'Vortex',
};

export const PLAYERS: Array<{ name: string; amount: number; tag?: string }> = [
  { name: 'Vortex', amount: LOOT.perPlayer + LOOT.repairs, tag: 'reparaciones' },
  { name: 'Kael', amount: LOOT.perPlayer },
  { name: 'Aurelia', amount: LOOT.perPlayer },
  { name: 'Bruno', amount: LOOT.perPlayer },
  { name: 'Nyx', amount: LOOT.perPlayer },
  { name: 'Draven', amount: LOOT.perPlayer + LOOT.sellerFee, tag: 'vendedor' },
  { name: 'Lyra', amount: LOOT.perPlayer },
];

const line: React.CSSProperties = { fontSize: 24, lineHeight: 1.5, color: '#dbdee1' };

/**
 * Mensaje público «💰 Loot · …» tal como lo publica el bot.
 * `at`: fotograma en que empiezan a aparecer las líneas (cada 9 fotogramas una).
 * `paidAt`: fotograma en que empiezan a marcarse pagos (uno cada 6). `logAt`: aparece el log.
 * `compact`: sin la lista de jugadores (para el video de novedades).
 */
export const LootPublic: React.FC<{ at: number; paidAt?: number; logAt?: number; compact?: boolean }> = ({ at, paidAt, logAt, compact }) => {
  const frame = useCurrentFrame();
  const step = 9;
  const total = useCount(LOOT.total, at, 16);
  const per = useCount(LOOT.perPlayer, at + step * 5, 16);
  const perFlash = useFlash(at + step * 5 + 16, 20);
  const paid = paidAt === undefined ? 0 : Math.max(0, Math.min(PLAYERS.length, Math.floor((frame - paidAt) / 6) + 1));
  const allPaid = paid === PLAYERS.length;
  const listAt = at + step * 7;
  return (
    <Embed author="TU GREMIO [TAG] • Reparto de loot" title={<><Emoji>💰</Emoji> Loot · Gankeo en Caminos de Avalon</>}>
      <Reveal at={at} style={line}>
        <Emoji>💵</Emoji> Total vendido: <b>{total}</b>
      </Reveal>
      <Reveal at={at + step} style={line}>
        <Emoji>🔧</Emoji> − Reparaciones: {silver(LOOT.repairs)} → <Mention>@{LOOT.repairsBy}</Mention>
      </Reveal>
      <Reveal at={at + step * 2} style={line}>
        <Emoji>🏰</Emoji> − Recargo del gremio ({LOOT.taxPct} %): {silver(LOOT.guildTax)}
      </Reveal>
      <Reveal at={at + step * 3} style={line}>
        <Emoji>🤝</Emoji> − Vendedor ({LOOT.sellerPct} %): {silver(LOOT.sellerFee)} → <Mention>@{LOOT.seller}</Mention>
      </Reveal>
      <Reveal at={at + step * 4} style={line}>
        <Emoji>🟰</Emoji> A repartir: <b>{silver(LOOT.net)}</b> entre <b>{LOOT.players}</b> jugadores
      </Reveal>
      <Reveal at={at + step * 5} style={{ ...line, fontSize: 30 }}>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: 8,
            background: `rgba(227,192,96,${0.08 + perFlash * 0.3})`,
            color: C.gold,
            fontWeight: 800,
          }}
        >
          <Emoji>💰</Emoji> {per} cada uno
        </span>
      </Reveal>
      <Reveal at={at + step * 6}>
        <Small>
          Sobrante del redondeo ({silver(LOOT.remainder)}) al gremio · el gremio recibe {silver(LOOT.guildTotal)} en total
        </Small>
      </Reveal>

      {!compact && (
        <Reveal at={listAt} style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 22, color: '#f2f3f5', marginBottom: 4 }}>
            <Emoji>👥</Emoji> Jugadores · {paid}/{PLAYERS.length} pagados
          </div>
          {PLAYERS.map((p, i) => {
            const isPaid = i < paid;
            return (
              <div key={p.name} style={{ fontSize: 22, lineHeight: 1.5 }}>
                <Emoji>{isPaid ? '✅' : '⏳'}</Emoji> <Mention>@{p.name}</Mention> — <b>{silver(p.amount)}</b>
                {p.tag && <i style={{ color: '#b5bac1' }}> (+{p.tag})</i>}
              </div>
            );
          })}
        </Reveal>
      )}

      {logAt !== undefined && frame >= logAt && (
        <Reveal at={logAt} style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 22, color: '#f2f3f5', marginBottom: 4 }}>
            <Emoji>📦</Emoji> ¿Quién tiene el loot? (log)
          </div>
          {LOOTERS.map((l, i) => (
            <Reveal key={l.name} at={logAt + 6 + i * 7} style={{ fontSize: 22, lineHeight: 1.5 }}>
              <b>{l.name}</b> {l.user && <Mention>@{l.name}</Mention>} — {l.count} {l.count === 1 ? 'ítem' : 'ítems'}
              {l.warn && <span style={{ color: '#f0b232' }}> · {l.warn}</span>}
            </Reveal>
          ))}
          <Small>📄 loot-events.txt · 33 recogidas por la party</Small>
        </Reveal>
      )}

      {!compact && <Small>{allPaid ? '✅ Pagado a todos' : `Pagados ${paid}/${PLAYERS.length}`} · TU GREMIO</Small>}
    </Embed>
  );
};

export const LOOTERS: Array<{ name: string; count: number; user: boolean; warn?: string }> = [
  { name: 'Lyra', count: 14, user: true },
  { name: 'Nyx', count: 9, user: true },
  { name: 'Bruno', count: 6, user: true },
  { name: 'Sylas', count: 3, user: true, warn: '⚠️ no está en el reparto' },
  { name: 'Zorak', count: 1, user: false, warn: '❔ sin cuenta de Discord' },
];

export const LootButtons: React.FC<{ pressedPay?: boolean }> = ({ pressedPay }) => (
  <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
    <DButton label={<><Emoji>💸</Emoji> Marcar pagos</>} color={C.dGreen} pressed={pressedPay} />
    <DButton label={<><Emoji>✏️</Emoji> Editar</>} />
  </div>
);
