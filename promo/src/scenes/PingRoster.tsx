import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { BotHeader, Caption, DiscordWindow, Emoji, Gold, Mention, Stage, useVertical } from '../common';
import { C, FONT_BODY } from '../theme';

type Member = { name: string; at: number };
type Role = { emoji: string; name: string; max: number; weapon: string; members: Member[] };

// Compo real de «Gankeo en Caminos de Avalon» (plantilla por defecto, party de 7).
// Empieza en 4/7, como la maqueta de la web, y se llena en directo.
const ROLES: Role[] = [
  { emoji: '⛓️', name: 'Tanque de atrape', max: 2, weapon: 'Maza pesada / Patas de oso', members: [{ name: 'Vortex', at: -1 }, { name: 'Kael', at: 152 }] },
  { emoji: '✨', name: 'Sanador', max: 1, weapon: 'Bastón sagrado / Bastón de infortunio', members: [{ name: 'Aurelia', at: -1 }] },
  { emoji: '🔮', name: 'Soporte de purga', max: 1, weapon: 'Casco de demonio / Invocador oscuro', members: [{ name: 'Bruno', at: 132 }] },
  {
    emoji: '🗡️',
    name: 'Daño',
    max: 3,
    weapon: 'Sangradora / Brazales de batalla / Hacha de guerra',
    members: [{ name: 'Nyx', at: -1 }, { name: 'Draven', at: -1 }, { name: 'Lyra', at: 172 }],
  },
];
const BENCH_AT = 196; // Sylas pide Daño con la party llena → Banca
const SCENE2_AT = 110; // cambia el texto en pantalla a «Roster por roles»

const bar = (n: number, max: number, len = 10) => {
  const f = Math.round((n / max) * len);
  return '▰'.repeat(f) + '▱'.repeat(len - f);
};

const Pop: React.FC<{ at: number; children: React.ReactNode }> = ({ at, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (at >= 0 && frame < at) return null;
  const s = at < 0 ? 1 : spring({ frame: frame - at, fps, config: { damping: 9, stiffness: 180 } });
  return <span style={{ display: 'inline-block', transform: `scale(${s})`, marginRight: 8 }}>{children}</span>;
};

/** 7–15 s · El ping sale, avisa a @Gankeo y la gente se anota por rol hasta llenar la party */
export const PingRoster: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vertical = useVertical();

  const enter = spring({ frame, fps, config: { damping: 200 } });
  const mentionGlow = interpolate(frame, [10, 22, 60, 90], [0, 1, 1, 0.2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const joined = ROLES.reduce((acc, r) => acc + r.members.filter((m) => m.at < 0 || frame >= m.at).length, 0);
  const total = ROLES.reduce((acc, r) => acc + r.max, 0);
  const full = joined >= total;
  const bench = frame >= BENCH_AT;

  // Notificación del rol avisado
  const notif = spring({ frame: frame - 18, fps, config: { damping: 14 } });
  const notifOut = interpolate(frame, [92, 104], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Al pasar al roster, la maqueta se acerca un poco a los roles
  const base = vertical ? 0.9 : 0.78;
  const zoom = base * interpolate(frame, [SCENE2_AT, SCENE2_AT + 20], [1, 1.03], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const capA = frame < SCENE2_AT;

  const line = { fontSize: 25, lineHeight: 1.5, color: '#dbdee1' } as const;

  return (
    <>
      <Stage
        caption={
          capA ? (
            <Caption
              key="a"
              step="Paso 2 · Aviso"
              title={
                <>
                  Avisa solo al <Gold>rol que toca</Gold>
                </>
              }
              sub={<>Gankeo avisa a @Gankeo. Sin molestar a todos con @everyone.</>}
            />
          ) : (
            <Caption
              key="b"
              step="Paso 3 · Roster"
              delay={SCENE2_AT}
              title={
                <>
                  Cada uno en <Gold>su rol</Gold>
                </>
              }
              sub="Cupos por rol y banca automática cuando se llena."
            />
          )
        }
      >
        <div style={{ transform: `translateY(${(1 - enter) * 80}px) scale(${zoom})`, opacity: enter, transformOrigin: vertical ? '50% 0%' : '50% 50%' }}>
          <DiscordWindow>
            <BotHeader />
            <div style={{ fontSize: 26, marginBottom: 14, color: '#dbdee1' }}>
              <Mention glow={mentionGlow}>@Gankeo</Mention> — <b>¡SALE GANKEO EN CAMINOS DE AVALON! ANÓTENSE ABAJO Y VAYAN EQUIPÁNDOSE</b>
            </div>
            <div
              style={{
                background: C.dEmbed,
                borderLeft: `6px solid ${C.goldDeep}`,
                borderRadius: 8,
                padding: '18px 22px 20px',
              }}
            >
              <div style={{ fontSize: 20, color: '#dbdee1', fontWeight: 600 }}>TU GREMIO [TAG] • Gankeo en Caminos de Avalon</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#f2f3f5', margin: '8px 0 6px' }}>
                <Emoji>🌀</Emoji> GANKEO EN CAMINOS DE AVALON
              </div>
              <div style={line}>
                <Emoji>🟢</Emoji> <b>Abierto</b> — ¡anótate en tu rol!
              </div>
              <div style={line}>
                <Emoji>⏰</Emoji> <b>Salida:</b> 21:15 · en 15 minutos
              </div>
              <div style={line}>
                <Emoji>📍</Emoji> <b>Masa en:</b> Brecilien / Portal de Caminos
              </div>
              <div style={line}>
                <Emoji>🛡️</Emoji> <b>IP / Build:</b> Equivalente T7 / T8
              </div>
              <div style={{ ...line, color: full ? C.gold : line.color, fontWeight: full ? 700 : 400 }}>
                <Emoji>👥</Emoji> <b>Party:</b> {joined}/{total} <span style={{ letterSpacing: 1 }}>{bar(joined, total)}</span>
                {full ? '  · completa 🔒' : ''}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 18px', marginTop: 12 }}>
                {ROLES.map((r) => {
                  const n = r.members.filter((m) => m.at < 0 || frame >= m.at).length;
                  const lastJoin = Math.max(...r.members.map((m) => m.at));
                  const hl = interpolate(frame, [lastJoin, lastJoin + 18], [1, 0], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  });
                  return (
                    <div
                      key={r.name}
                      style={{
                        fontSize: 22,
                        borderRadius: 8,
                        padding: '6px 8px',
                        background: lastJoin > 0 && frame >= lastJoin ? `rgba(227,192,96,${0.18 * hl})` : 'transparent',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: '#f2f3f5' }}>
                        <Emoji>{r.emoji}</Emoji> {r.name} · {n}/{r.max}
                      </div>
                      <div style={{ color: '#b5bac1', fontSize: 19, margin: '2px 0 6px' }}>{r.weapon}</div>
                      <div>
                        {r.members.map((m) => (
                          <Pop key={m.name} at={m.at}>
                            <Mention>@{m.name}</Mention>
                          </Pop>
                        ))}
                        {n === 0 && <span style={{ color: '#80848e' }}>—</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {bench && (
                <div style={{ fontSize: 22, marginTop: 12, padding: '6px 8px' }}>
                  <div style={{ fontWeight: 700, color: '#f2f3f5' }}>
                    <Emoji>🔄</Emoji> Banca · 1
                  </div>
                  <Pop at={BENCH_AT}>
                    <Mention>@Sylas</Mention>
                  </Pop>
                  <span style={{ color: '#b5bac1', fontSize: 19 }}> Daño</span>
                </div>
              )}
              <Img src={staticFile(`banner-${Math.min(7, Math.max(4, joined))}.png`)} style={{ width: '100%', borderRadius: 6, marginTop: 14 }} />
            </div>
            <div
              style={{
                marginTop: 12,
                background: C.dSelect,
                borderRadius: 10,
                padding: '16px 20px',
                fontSize: 24,
                color: '#b5bac1',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>
                <Emoji>⚔️</Emoji> ¿De qué vas? Elige tu rol...
              </span>
              <span>⌄</span>
            </div>
          </DiscordWindow>
        </div>
      </Stage>

      {/* Notificación del aviso al rol */}
      <AbsoluteFill style={{ pointerEvents: 'none', fontFamily: FONT_BODY }}>
        <div
          style={{
            position: 'absolute',
            right: vertical ? 70 : 90,
            top: vertical ? 620 : 70,
            opacity: Math.min(notif, notifOut),
            transform: `translateY(${(1 - notif) * -40}px)`,
            background: 'rgba(19,24,34,0.96)',
            border: `2px solid ${C.gold}`,
            borderRadius: 18,
            padding: '18px 26px',
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            fontSize: 28,
            color: C.text,
            fontWeight: 600,
          }}
        >
          <Emoji size={40}>🔔</Emoji>
          <div>
            <div style={{ color: C.gold }}>@Gankeo</div>
            <div style={{ fontSize: 22, color: C.muted, fontWeight: 500 }}>MassUp te mencionó en #pings</div>
          </div>
        </div>
      </AbsoluteFill>
    </>
  );
};
