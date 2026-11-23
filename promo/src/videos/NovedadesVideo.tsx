import React from 'react';
import { AbsoluteFill, Img, Sequence, interpolate, interpolateColors, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background, Caption, Cursor, DButton, Emoji, Gold, Mention, SceneFade, Stage, useVertical } from '../common';
import { Card, DSelect, Embed, Small, useFlash } from '../discord';
import { LootPublic } from '../loot';
import { Outro } from '../scenes/Outro';
import { C, FONT_BODY, FONT_DISPLAY } from '../theme';

/** Tiempos del video «MassUp ahora hace más» (30 fps, 35 s) */
export const TN = {
  hook: { from: 0, dur: 90 },
  hora: { from: 90, dur: 180 },
  swaps: { from: 270, dur: 150 },
  loot: { from: 420, dur: 160 },
  tickets: { from: 580, dur: 180 },
  panel: { from: 760, dur: 140 },
  outro: { from: 900, dur: 150 },
};
export const NOVEDADES_TOTAL = 1050;

// ---------- Gancho ----------
const ICONS = ['⏰', '🧩', '💰', '🎫', '🖥️', '💎'];
export const NovHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vertical = useVertical();
  const t = spring({ frame, fps, config: { damping: 200 } });
  const n = Math.min(6, Math.max(0, Math.floor((frame - 24) / 6) + 1));
  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        textAlign: 'center',
        padding: vertical ? '0 80px 220px' : '0 140px',
        fontFamily: FONT_BODY,
        color: C.text,
      }}
    >
      <div style={{ color: C.gold, fontSize: vertical ? 34 : 30, letterSpacing: 8, fontWeight: 700, opacity: t }}>NUEVA ACTUALIZACIÓN</div>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: vertical ? 96 : 88,
          lineHeight: 1.1,
          marginTop: 24,
          opacity: t,
          transform: `translateY(${(1 - t) * 40}px)`,
        }}
      >
        MassUp ya no solo <Gold>tira pings</Gold>
      </div>
      <div style={{ display: 'flex', gap: vertical ? 22 : 30, marginTop: 60, flexWrap: 'wrap', justifyContent: 'center' }}>
        {ICONS.map((ic, i) => {
          const s = spring({ frame: frame - 24 - i * 6, fps, config: { damping: 11, stiffness: 170 } });
          return (
            <div
              key={ic}
              style={{
                width: vertical ? 120 : 110,
                height: vertical ? 120 : 110,
                borderRadius: 26,
                background: C.surface,
                border: `2px solid rgba(227,192,96,0.45)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${s})`,
                fontSize: vertical ? 64 : 58,
              }}
            >
              <Emoji>{ic}</Emoji>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 50, fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: vertical ? 70 : 64, color: C.gold, opacity: n > 0 ? 1 : 0 }}>
        +{n} novedades
      </div>
    </AbsoluteFill>
  );
};

// ---------- Novedad 1: cambiar la hora desde el Mando ----------
const TIME_OPEN = 34;
const MINUTE_PICK = 70;
const SAVE = 104;
export const NovHora: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vertical = useVertical();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const minute = frame >= MINUTE_PICK ? 45 : 15;
  const nueva = `21:${minute} UTC`;
  const saved = frame >= SAVE + 6;
  const flash = useFlash(MINUTE_PICK, 16);
  const msg = spring({ frame: frame - SAVE - 8, fps, config: { damping: 200 } });
  const line: React.CSSProperties = { fontSize: 23, lineHeight: 1.5 };
  return (
    <Stage
      caption={
        <Caption
          step="Novedad 1 · Mando del Caller"
          title={
            <>
              Cambia la hora <Gold>sin cerrar</Gold> el ping
            </>
          }
          sub="Los anotados, la voz y el hilo se mantienen, y se avisa en el hilo."
        />
      }
    >
      <div style={{ position: 'relative', opacity: enter, transform: `translateY(${(1 - enter) * 60}px) scale(${vertical ? 1 : 0.9})` }}>
        <Card ephemeral>
          {frame < TIME_OPEN + 6 || saved ? (
            <>
              {saved && (
                <div style={{ fontSize: 24, marginBottom: 12, color: '#f2f3f5' }}>
                  ✅ Salida movida a <b>21:45 UTC</b> (en 45 minutos).
                </div>
              )}
              <Embed title={<><Emoji>👑</Emoji> Gankeo en Caminos de Avalon</>}>
                <div style={line}>📍 #pings · 🟢 Abierto</div>
                <div style={line}>
                  👥 <b>7/7</b> anotados · 0 en banca
                </div>
                <div style={line}>⏰ Salida en {saved ? 45 : 15} minutos</div>
                <div style={{ ...line, marginTop: 8 }}>
                  <b>Cambiar hora:</b> mueve la salida sin cerrar el ping
                </div>
                <Small>Solo tú ves esto. Si lo cierras, vuelve a abrirlo con /mando.</Small>
              </Embed>
              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                <DButton label={<><Emoji>⚔️</Emoji> En ruta</>} color={C.dBlurple} />
                <DButton label={<><Emoji>📢</Emoji> ¡A voz!</>} />
                <DButton label={<><Emoji>🔒</Emoji> GG</>} color={C.dGreen} />
                <DButton label={<><Emoji>🗑️</Emoji> Cancelar</>} color={C.dRed} />
              </div>
              <div style={{ marginTop: 10 }}>
                <DButton label={<><Emoji>⏰</Emoji> Cambiar hora</>} pressed={frame >= TIME_OPEN && frame < TIME_OPEN + 8} />
              </div>
            </>
          ) : (
            <>
              <Embed title={<><Emoji>⏰</Emoji> Cambiar hora · Gankeo en Caminos de Avalon</>}>
                <div style={line}>
                  Ahora: <b>21:15 UTC</b> · 21:15 (en 15 minutos)
                </div>
                <div style={{ ...line, color: flash > 0 ? C.gold : undefined }}>
                  Nueva: <b>{nueva}</b> · 21:{minute} (en {minute} minutos)
                </div>
                <Small>Si la hora elegida ya pasó hoy, la salida queda para mañana. Los anotados se mantienen y se avisa en el hilo.</Small>
              </Embed>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                <DSelect>21:xx UTC</DSelect>
                <DSelect highlight={flash}>{nueva}</DSelect>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <div style={{ opacity: minute === 15 ? 0.5 : 1 }}>
                  <DButton label={<><Emoji>✅</Emoji> Guardar {nueva}</>} color={C.dGreen} pressed={frame >= SAVE && frame < SAVE + 8} />
                </div>
                <DButton label="Volver" />
              </div>
            </>
          )}
        </Card>

        {/* Aviso en el hilo del ping */}
        {frame >= SAVE + 8 && (
          <div
            style={{
              marginTop: 22,
              opacity: msg,
              transform: `translateY(${(1 - msg) * 30}px)`,
              background: C.dChat,
              borderRadius: 18,
              padding: '18px 26px',
              fontFamily: FONT_BODY,
              color: '#dbdee1',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              border: `2px solid rgba(227,192,96,0.35)`,
            }}
          >
            <div style={{ fontSize: 20, color: '#949ba4', fontWeight: 700, marginBottom: 6 }}>🧵 ⚔️ Gankeo en Caminos de Avalon — Draven</div>
            <div style={{ fontSize: 24, lineHeight: 1.45 }}>
              <b style={{ color: C.gold }}>MassUp</b> · <Emoji>⏰</Emoji> El Caller cambió la hora de salida: <b>21:45 UTC</b> · 21:45 (en 45 minutos). Antes era 21:15.
            </div>
          </div>
        )}

        <Cursor
          path={[
            { f: 0, x: 700, y: 640 },
            { f: TIME_OPEN - 4, x: 160, y: 470 },
            { f: MINUTE_PICK - 6, x: 420, y: 428 },
            { f: SAVE - 6, x: 200, y: 506 },
            { f: SAVE + 30, x: 640, y: 760 },
          ]}
          clicks={[TIME_OPEN, MINUTE_PICK, SAVE]}
        />
      </div>
    </Stage>
  );
};

// ---------- Novedad 2: swaps en la tarjeta de builds ----------
export const NovSwaps: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vertical = useVertical();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const w = vertical ? 860 : 820;
  const k = w / 906; // escala de la imagen real (906×676)
  const box = (y: number, h: number, at: number) => {
    const s = spring({ frame: frame - at, fps, config: { damping: 14 } });
    const pulse = 0.5 + 0.5 * Math.sin((frame - at) / 6);
    return (
      <div
        style={{
          position: 'absolute',
          left: 16 * k,
          top: y * k,
          width: 874 * k,
          height: h * k,
          borderRadius: 10,
          border: `4px solid rgba(227,192,96,${0.5 + pulse * 0.5})`,
          boxShadow: `0 0 ${30 * pulse}px rgba(227,192,96,0.6)`,
          opacity: frame >= at ? s : 0,
        }}
      />
    );
  };
  return (
    <Stage
      caption={
        <Caption
          step="Novedad 2 · Builds"
          title={
            <>
              <Gold>Swaps</Gold> en las builds
            </>
          }
          sub="Hasta 3 por rol («Boss», «Falce 3»…) con solo lo que cambia. Se editan en el panel y salen en el hilo."
        />
      }
    >
      <div style={{ opacity: enter, transform: `translateY(${(1 - enter) * 60}px)` }}>
        <div
          style={{
            width: w + 60,
            background: C.dChat,
            borderRadius: 22,
            padding: '20px 30px 30px',
            fontFamily: FONT_BODY,
            boxShadow: '0 30px 70px rgba(0,0,0,0.55)',
          }}
        >
          <div style={{ fontSize: 22, color: '#949ba4', fontWeight: 700, marginBottom: 12 }}>🧵 ⚔️ Gankeo en Caminos de Avalon — Draven</div>
          <div style={{ position: 'relative', width: w }}>
            <Img src={staticFile('builds-swaps.png')} style={{ width: w, borderRadius: 8, display: 'block' }} />
            {box(146, 70, 30)}
            {box(496, 146, 52)}
          </div>
        </div>
      </div>
    </Stage>
  );
};

// ---------- Novedad 3: reparto de loot ----------
export const NovLoot: React.FC = () => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const vertical = useVertical();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  return (
    <Stage
      caption={
        <Caption
          step="Novedad 3 · Loot"
          title={
            <>
              Reparto de loot <Gold>a partes iguales</Gold>
            </>
          }
          sub="Tras el GG: plata, reparaciones, recargo del gremio y vendedor. Con Premium, importa AO Loot Logger."
        />
      }
    >
      <div style={{ opacity: enter, transform: `translateY(${(1 - enter) * 60}px) scale(${vertical ? 1 : 0.9})` }}>
        <Card time="hoy a las 23:40">
          <LootPublic at={12} compact />
        </Card>
      </div>
    </Stage>
  );
};

// ---------- Novedad 4: tickets de reclutamiento con ficha de Albion ----------
const ACCEPT = 112;
export const NovTickets: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vertical = useVertical();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const ficha = spring({ frame: frame - 22, fps, config: { damping: 200 } });
  const ok = spring({ frame: frame - ACCEPT - 6, fps, config: { damping: 14 } });
  const col = { fontSize: 21, lineHeight: 1.45 } as const;
  const head = { fontWeight: 700, color: '#f2f3f5', fontSize: 22, marginBottom: 2 } as const;
  return (
    <Stage
      caption={
        <Caption
          step="Novedad 4 · Tickets"
          title={
            <>
              Recluta con su <Gold>ficha de Albion</Gold>
            </>
          }
          sub="PvP, PvE, recolección, gremio y alianza. Al aceptar, el bot le da los roles y el apodo."
        />
      }
    >
      <div
        style={{
          position: 'relative',
          opacity: enter,
          transform: `translateY(${(1 - enter) * 60}px) scale(${vertical ? 1 : 0.8})`,
          transformOrigin: vertical ? '50% 0%' : '50% 50%',
        }}
      >
        <Card time="hoy a las 19:02">
          <Embed author="TU GREMIO [TAG] • Tickets" title={<><Emoji>🛡️</Emoji> Reclutamiento · #0042</>}>
            <div style={{ fontSize: 22 }}>
              <b>🧙 Personaje</b>
              <br />
              <b>Kaelthorn</b> · América
            </div>
          </Embed>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <DButton label={<><Emoji>🙋</Emoji> Atender</>} />
            <DButton label={<><Emoji>🔒</Emoji> Cerrar</>} />
            <DButton label={<><Emoji>✅</Emoji> Aceptar</>} color={C.dGreen} pressed={frame >= ACCEPT && frame < ACCEPT + 8} />
            <DButton label={<><Emoji>❌</Emoji> Rechazar</>} color={C.dRed} />
          </div>

          <div style={{ opacity: ficha, transform: `translateY(${(1 - ficha) * 30}px)`, marginTop: 18 }}>
            <Embed author="TU GREMIO [TAG] • Ficha de Albion" title={<><Emoji>⚔️</Emoji> Kaelthorn · América</>}>
              <div style={{ fontSize: 22, marginBottom: 12 }}>
                🛡️ <b>Iron Wolves</b> · [WOLF] Northern Pact · 87 miembros
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div style={col}>
                  <div style={head}>⚔️ PvP</div>
                  Kills <b>48,2 M</b>
                  <br />
                  Muertes <b>9,1 M</b>
                  <br />
                  Ratio <b>5,3</b>
                </div>
                <div style={col}>
                  <div style={head}>🐉 PvE · 132 M</div>
                  Avalon <b>61 M</b>
                  <br />
                  Outlands <b>44 M</b>
                  <br />
                  Hellgate <b>27 M</b>
                </div>
                <div style={col}>
                  <div style={head}>⛏️ Recolección · 18,5 M</div>
                  Fibra <b>9,2 M</b>
                  <br />
                  Piel <b>6 M</b>
                  <br />
                  Mineral <b>3,3 M</b>
                </div>
              </div>
            </Embed>
          </div>

          {frame >= ACCEPT + 6 && (
            <div style={{ marginTop: 16, transform: `scale(${0.9 + ok * 0.1})`, opacity: ok, transformOrigin: 'left center' }}>
              <Embed style={{ borderLeftColor: '#23a55a' }}>
                <div style={{ fontSize: 24 }}>
                  ✅ <Mention>@Kaelthorn</Mention> ha sido <b>aceptado</b> por <Mention>@Oficial</Mention>. ¡Bienvenido!
                </div>
              </Embed>
            </div>
          )}
        </Card>
        <Cursor
          path={[
            { f: 0, x: 760, y: 700 },
            { f: ACCEPT - 8, x: 520, y: 300 },
            { f: ACCEPT + 40, x: 700, y: 500 },
          ]}
          clicks={[ACCEPT]}
        />
      </div>
    </Stage>
  );
};

// ---------- Novedad 5: panel web nuevo ----------
const NAV: Array<{ group: string; items: string[] }> = [
  { group: 'Actividad', items: ['Pings activos', 'Puntos', 'Reparto de loot'] },
  { group: 'Gremio', items: ['Tickets'] },
  { group: 'Configuración', items: ['Contenidos y builds', 'Ajustes', 'Marca'] },
  { group: 'Cuenta', items: ['Plan'] },
];
const THEME_AT = 52;
const RECOVER = 100;
export const NovPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vertical = useVertical();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const d = interpolate(frame, [THEME_AT, THEME_AT + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const col = (light: string, dark: string) => interpolateColors(d, [0, 1], [light, dark]);
  const bg = col('#f5f7fa', '#0b0e14');
  const surface = col('#ffffff', '#131822');
  const border = col('#e0e5ed', '#212836');
  const text = col('#121722', '#eef1f6');
  const muted = col('#4a5568', '#a9b3c4');
  const accent = col('#2c5aa0', '#e3c060');
  const recovered = frame >= RECOVER + 4;
  const sideW = vertical ? 270 : 300;
  return (
    <Stage
      caption={
        <Caption
          step="Novedad 5 · Panel web"
          title={
            <>
              Panel nuevo, <Gold>claro u oscuro</Gold>
            </>
          }
          sub="Por secciones y con borradores: si caduca la sesión, no pierdes los cambios."
        />
      }
    >
      <div
        style={{
          position: 'relative',
          width: vertical ? 920 : 1000,
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 40px 90px rgba(0,0,0,0.6)',
          fontFamily: FONT_BODY,
          opacity: enter,
          transform: `translateY(${(1 - enter) * 60}px)`,
        }}
      >
        {/* barra del navegador */}
        <div style={{ background: '#1e2230', padding: '12px 18px', display: 'flex', gap: 10, alignItems: 'center' }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <span key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c, display: 'inline-block' }} />
          ))}
          <span style={{ marginLeft: 14, background: '#2a2f40', color: '#c8cfdc', borderRadius: 8, padding: '6px 16px', fontSize: 19 }}>
            🔒 panel.massup.shop
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 24 }}>
            <Emoji>{d < 0.5 ? '☀️' : '🌙'}</Emoji>
          </span>
        </div>
        <div style={{ display: 'flex', background: bg, minHeight: vertical ? 720 : 640 }}>
          {/* barra lateral por secciones */}
          <div style={{ width: sideW, background: surface, borderRight: `1px solid ${border}`, padding: '22px 18px' }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 28, color: accent, marginBottom: 18 }}>MassUp</div>
            {NAV.map((g) => (
              <div key={g.group} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 15, letterSpacing: 2, color: muted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{g.group}</div>
                {g.items.map((it) => {
                  const active = it === 'Contenidos y builds';
                  return (
                    <div
                      key={it}
                      style={{
                        fontSize: 19,
                        padding: '7px 10px',
                        borderRadius: 8,
                        color: active ? text : muted,
                        fontWeight: active ? 700 : 500,
                        background: active ? col('rgba(44,90,160,0.10)', 'rgba(227,192,96,0.12)') : 'transparent',
                      }}
                    >
                      {it}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {/* contenido */}
          <div style={{ flex: 1, padding: '26px 26px', color: text }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 32, marginBottom: 18 }}>Contenidos y builds</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 19, color: muted }}>← Volver</span>
              <span style={{ fontSize: 24, fontWeight: 700 }}>
                <Emoji>🌀</Emoji> Gankeo en Caminos de Avalon
              </span>
            </div>
            {!recovered ? (
              <div
                style={{
                  background: col('rgba(214,174,69,0.14)', 'rgba(227,192,96,0.12)'),
                  border: `1px solid ${col('#d6ae45', '#e3c060')}`,
                  borderRadius: 12,
                  padding: '16px 18px',
                  fontSize: 20,
                  lineHeight: 1.45,
                }}
              >
                ✏️ Tienes cambios sin guardar hace 2 min. ¿Quieres recuperarlos?
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <span
                    style={{
                      background: accent,
                      color: d > 0.5 ? '#1a1306' : '#ffffff',
                      borderRadius: 8,
                      padding: '8px 18px',
                      fontWeight: 700,
                      transform: frame >= RECOVER && frame < RECOVER + 6 ? 'scale(0.94)' : undefined,
                      display: 'inline-block',
                    }}
                  >
                    Recuperar
                  </span>
                  <span style={{ border: `1px solid ${border}`, borderRadius: 8, padding: '8px 18px', color: muted }}>Descartar</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 20, color: accent, fontWeight: 700 }}>✏️ Cambios sin guardar · recuperados</div>
            )}
            {/* roles de la compo */}
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['⛓️', 'Tanque de atrape', '2'],
                ['✨', 'Sanador', '1'],
                ['🔮', 'Soporte de purga', '1'],
                ['🗡️', 'Daño', '3'],
              ].map(([e, n, c]) => (
                <div
                  key={n}
                  style={{
                    background: surface,
                    border: `1px solid ${border}`,
                    borderRadius: 10,
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 20,
                  }}
                >
                  <span>
                    <Emoji>{e}</Emoji> {n}
                  </span>
                  <span style={{ color: muted }}>{c} {c === '1' ? 'cupo' : 'cupos'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <Cursor
          path={[
            { f: 0, x: 860, y: 600 },
            { f: THEME_AT - 8, x: vertical ? 870 : 950, y: 30 },
            { f: RECOVER - 8, x: sideW + 70, y: vertical ? 300 : 300 },
            { f: RECOVER + 30, x: sideW + 300, y: 520 },
          ]}
          clicks={[THEME_AT - 4, RECOVER]}
        />
      </div>
    </Stage>
  );
};

/** Video 1 · «MassUp ahora hace más» (novedades) */
export const NovedadesVideo: React.FC = () => (
  <AbsoluteFill>
    <Background />
    <Sequence from={TN.hook.from} durationInFrames={TN.hook.dur}>
      <SceneFade dur={TN.hook.dur} fadeIn={1}>
        <NovHook />
      </SceneFade>
    </Sequence>
    <Sequence from={TN.hora.from} durationInFrames={TN.hora.dur}>
      <SceneFade dur={TN.hora.dur}>
        <NovHora />
      </SceneFade>
    </Sequence>
    <Sequence from={TN.swaps.from} durationInFrames={TN.swaps.dur}>
      <SceneFade dur={TN.swaps.dur}>
        <NovSwaps />
      </SceneFade>
    </Sequence>
    <Sequence from={TN.loot.from} durationInFrames={TN.loot.dur}>
      <SceneFade dur={TN.loot.dur}>
        <NovLoot />
      </SceneFade>
    </Sequence>
    <Sequence from={TN.tickets.from} durationInFrames={TN.tickets.dur}>
      <SceneFade dur={TN.tickets.dur}>
        <NovTickets />
      </SceneFade>
    </Sequence>
    <Sequence from={TN.panel.from} durationInFrames={TN.panel.dur}>
      <SceneFade dur={TN.panel.dur}>
        <NovPanel />
      </SceneFade>
    </Sequence>
    <Sequence from={TN.outro.from} durationInFrames={TN.outro.dur}>
      <SceneFade dur={TN.outro.dur} fadeOut={1}>
        <Outro
          chips={['Gratis', 'Premium desde $15.000 COP', 'Mercado Pago']}
          footer="Premium con Mercado Pago: tarjeta, PSE o Efecty"
        />
      </SceneFade>
    </Sequence>
  </AbsoluteFill>
);
