import React from 'react';
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background, Caption, Cursor, DButton, Emoji, Gold, Mention, SceneFade, Stage, useVertical } from '../common';
import { Card, Embed } from '../discord';
import { LootButtons, LootPublic } from '../loot';
import { Outro } from '../scenes/Outro';
import { C, FONT_BODY } from '../theme';

/** Tiempos del video «Del GG a la plata» (30 fps, 25 s) */
export const TL = {
  hook: { from: 0, dur: 75 },
  gg: { from: 75, dur: 90 },
  modal: { from: 165, dur: 120 },
  reparto: { from: 285, dur: 235 },
  log: { from: 520, dur: 100 },
  outro: { from: 620, dur: 130 },
};
export const LOOT_TOTAL = 750;

// ---------- Gancho: el chat de siempre después de una salida ----------
const COMPLAINTS: Array<{ who: string; color: string; text: React.ReactNode }> = [
  { who: 'Nyx', color: '#c084fc', text: <><Mention>@Draven</Mention> ¿y mi parte? <Emoji>👀</Emoji></> },
  { who: 'Bruno', color: '#60a5fa', text: '¿cuánto le toca a cada uno?' },
  { who: 'Vortex', color: '#f87171', text: <>yo pagué las repas, eh <Emoji>😤</Emoji></> },
  { who: 'Lyra', color: '#34d399', text: '¿quién vendió el loot?' },
  { who: 'Kael', color: '#fbbf24', text: <>a mí me pagaron menos <Emoji>🤨</Emoji></> },
];

export const UserMsg: React.FC<{ who: string; color: string; children: React.ReactNode; at: number }> = ({ who, color, children, at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return null;
  const s = spring({ frame: frame - at, fps, config: { damping: 13, stiffness: 160 } });
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', transform: `scale(${0.85 + s * 0.15})`, opacity: s, transformOrigin: 'left center' }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: color,
          color: '#111',
          fontWeight: 800,
          fontSize: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {who[0]}
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 24, color }}>{who}</div>
        <div style={{ fontSize: 28, color: '#dbdee1' }}>{children}</div>
      </div>
    </div>
  );
};

export const LootHook: React.FC = () => {
  const frame = useCurrentFrame();
  const vertical = useVertical();
  const shake = frame > 52 && frame < 66 ? Math.sin(frame * 2.7) * 7 : 0;
  return (
    <Stage
      caption={
        <Caption
          title={
            <>
              ¿Otra vez peleando por el <Gold>loot</Gold>?
            </>
          }
          sub="Después de cada salida, el mismo caos en el chat."
        />
      }
    >
      <div
        style={{
          width: vertical ? 920 : 980,
          background: C.dChat,
          borderRadius: 22,
          padding: '28px 30px',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          fontFamily: FONT_BODY,
          transform: `translateX(${shake}px)`,
          boxShadow: '0 30px 70px rgba(0,0,0,0.55)',
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 700, color: '#f2f3f5' }}>
          <span style={{ color: '#80848e' }}>#</span> general
        </div>
        {COMPLAINTS.map((c, i) => (
          <UserMsg key={c.who} who={c.who} color={c.color} at={6 + i * 9}>
            {c.text}
          </UserMsg>
        ))}
      </div>
    </Stage>
  );
};

// ---------- Paso 1: GG en el Mando → Repartir loot ----------
export const LootGG: React.FC = () => {
  const frame = useCurrentFrame();
  const finished = frame >= 28;
  return (
    <Stage
      caption={
        <Caption
          step="Paso 1 · GG"
          title={
            <>
              Del GG al reparto en <Gold>un clic</Gold>
            </>
          }
          sub="Al cerrar la salida, el Mando del Caller ofrece repartir el loot."
        />
      }
    >
      <div style={{ position: 'relative' }}>
        <Card ephemeral>
          {!finished ? (
            <>
              <Embed title={<><Emoji>👑</Emoji> Gankeo en Caminos de Avalon</>}>
                <div style={{ fontSize: 23, color: '#b5bac1' }}>⚔️ En ruta · 👥 7/7 anotados · 0 en banca</div>
              </Embed>
              <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
                <DButton label={<><Emoji>⚔️</Emoji> En ruta</>} color={C.dBlurple} />
                <DButton label={<><Emoji>📢</Emoji> ¡A voz!</>} />
                <DButton label={<><Emoji>🔒</Emoji> GG</>} color={C.dGreen} pressed={frame >= 14 && frame < 24} />
                <DButton label={<><Emoji>🗑️</Emoji> Cancelar</>} color={C.dRed} />
              </div>
            </>
          ) : (
            <div style={{ opacity: interpolate(frame, [28, 36], [0, 1], { extrapolateRight: 'clamp' }) }}>
              <div style={{ fontSize: 25, lineHeight: 1.45 }}>
                <Emoji>🔒</Emoji> <b>Gankeo en Caminos de Avalon</b> ya terminó (7 anotados · 0 en banca). Reparte o corrige los puntos y el loot:
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
                <DButton big label={<><Emoji>🏆</Emoji> Repartir puntos</>} color={C.dGreen} />
                <DButton big label={<><Emoji>💰</Emoji> Repartir loot</>} color={C.dGreen} pressed={frame >= 64 && frame < 74} />
              </div>
            </div>
          )}
        </Card>
        <Cursor
          path={[
            { f: 0, x: 600, y: 420 },
            { f: 12, x: 470, y: 230 },
            { f: 40, x: 470, y: 260 },
            { f: 62, x: 470, y: 262 },
          ]}
          clicks={[14, 64]}
        />
      </div>
    </Stage>
  );
};

// ---------- Paso 2: modal «Plata y descuentos» ----------
const FIELDS = [
  { label: 'Total de plata', desc: 'Lo que se sacó al vender todo el loot. Ej: 12.500.000 o 12.5m', value: '12.500.000', at: 14 },
  { label: 'Reparaciones', desc: 'Se le devuelven a quien las pagó (botón Vendedor). 0 si no hubo.', value: '400.000', at: 42 },
  { label: 'Recargo del gremio (%)', desc: 'Lo que se queda el gremio. 0 si no hay.', value: '10', at: 62 },
  { label: 'Pago al vendedor (%)', desc: 'Lo que cobra quien vende el loot. 0 si no hay.', value: '5', at: 76 },
];

export const LootModal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vertical = useVertical();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  return (
    <Stage
      caption={
        <Caption
          step="Paso 2 · La plata"
          title={
            <>
              Pones el <Gold>total</Gold>… y listo
            </>
          }
          sub="Reparaciones, recargo del gremio y pago al vendedor, incluidos."
        />
      }
    >
      <div
        style={{
          width: vertical ? 880 : 900,
          background: C.dChat,
          borderRadius: 18,
          padding: '28px 32px',
          fontFamily: FONT_BODY,
          boxShadow: '0 40px 90px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.07)',
          transform: `scale(${(vertical ? 1 : 0.88) * (0.94 + enter * 0.06)})`,
          opacity: enter,
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 800, color: '#f2f3f5', marginBottom: 20 }}>Plata y descuentos</div>
        {FIELDS.map((f) => {
          const typed = f.value.slice(0, Math.max(0, Math.floor((frame - f.at) / 2)));
          const active = frame >= f.at && typed.length < f.value.length;
          return (
            <div key={f.label} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f2f3f5' }}>{f.label}</div>
              <div style={{ fontSize: 18, color: '#b5bac1', margin: '2px 0 8px' }}>{f.desc}</div>
              <div
                style={{
                  background: C.dSelect,
                  borderRadius: 8,
                  padding: '14px 18px',
                  fontSize: 26,
                  color: typed ? '#f2f3f5' : '#6d6f78',
                  border: `2px solid ${active ? C.gold : 'transparent'}`,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {typed || ' '}
                {active && <span style={{ color: C.gold }}>|</span>}
              </div>
            </div>
          );
        })}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14, marginTop: 8 }}>
          <DButton label="Cancelar" color="transparent" />
          <DButton label="Enviar" color={C.dBlurple} pressed={frame >= 96 && frame < 106} />
        </div>
      </div>
    </Stage>
  );
};

// ---------- Paso 3 y 4: el reparto publicado y los pagos ----------
const PAY_CAPTION = 160;
export const LootReparto: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vertical = useVertical();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  return (
    <Stage
      caption={
        frame < PAY_CAPTION ? (
          <Caption
            key="a"
            step="Paso 3 · El reparto"
            title={
              <>
                Cada uno, <Gold>su parte</Gold>
              </>
            }
            sub="Todos cobran lo mismo y el sobrante va al gremio."
          />
        ) : (
          <Caption
            key="b"
            delay={PAY_CAPTION}
            step="Paso 4 · Pagos"
            title={
              <>
                Nadie se queda <Gold>sin cobrar</Gold>
              </>
            }
            sub="Marca quién ya cobró. Con /loot pendientes cada uno ve lo que le deben."
          />
        )
      }
    >
      <div
        style={{
          transform: `translateY(${(1 - enter) * 60}px) scale(${vertical ? 0.94 : 0.8})`,
          transformOrigin: vertical ? '50% 0%' : '50% 50%',
          opacity: enter,
        }}
      >
        <Card time="hoy a las 23:40">
          <LootPublic at={8} paidAt={176} />
          <LootButtons pressedPay={frame >= 166 && frame < 176} />
        </Card>
      </div>
    </Stage>
  );
};

// ---------- Premium: log de AO Loot Logger ----------
export const LootLog: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vertical = useVertical();
  const file = spring({ frame: frame - 14, fps, config: { damping: 14 } });
  return (
    <Stage
      caption={
        <Caption
          step="💎 Premium · AO Loot Logger"
          title={
            <>
              ¿Quién se llevó <Gold>qué</Gold>?
            </>
          }
          sub="Importa el log y verás quién tiene el loot y quién falta en el reparto."
        />
      }
    >
      <div style={{ transform: `scale(${vertical ? 0.94 : 0.8})`, transformOrigin: vertical ? '50% 0%' : '50% 50%', position: 'relative' }}>
        <Card ephemeral>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <DButton label={<><Emoji>💵</Emoji> Plata y descuentos</>} />
            <DButton label={<><Emoji>🤝</Emoji> Vendedor</>} />
            <DButton label={<><Emoji>📄</Emoji> Importar log</>} pressed={frame >= 4 && frame < 14} />
          </div>
          <LootPublic at={-200} logAt={24} compact />
        </Card>
        {/* el archivo del log entrando */}
        <div
          style={{
            position: 'absolute',
            right: 30,
            top: -40,
            opacity: frame < 14 ? 0 : interpolate(frame, [40, 52], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            transform: `translateY(${(1 - file) * -60}px) rotate(${(1 - file) * -8}deg)`,
            background: C.surface,
            border: `2px solid ${C.gold}`,
            borderRadius: 14,
            padding: '14px 20px',
            fontFamily: FONT_BODY,
            fontSize: 24,
            fontWeight: 700,
            color: C.text,
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          }}
        >
          <Emoji>📄</Emoji> loot-events.txt
        </div>
      </div>
    </Stage>
  );
};

/** Video 2 · «Del GG a la plata» */
export const LootVideo: React.FC = () => (
  <AbsoluteFill>
    <Background />
    <Sequence from={TL.hook.from} durationInFrames={TL.hook.dur}>
      <SceneFade dur={TL.hook.dur} fadeIn={1}>
        <LootHook />
      </SceneFade>
    </Sequence>
    <Sequence from={TL.gg.from} durationInFrames={TL.gg.dur}>
      <SceneFade dur={TL.gg.dur}>
        <LootGG />
      </SceneFade>
    </Sequence>
    <Sequence from={TL.modal.from} durationInFrames={TL.modal.dur}>
      <SceneFade dur={TL.modal.dur}>
        <LootModal />
      </SceneFade>
    </Sequence>
    <Sequence from={TL.reparto.from} durationInFrames={TL.reparto.dur}>
      <SceneFade dur={TL.reparto.dur}>
        <LootReparto />
      </SceneFade>
    </Sequence>
    <Sequence from={TL.log.from} durationInFrames={TL.log.dur}>
      <SceneFade dur={TL.log.dur}>
        <LootLog />
      </SceneFade>
    </Sequence>
    <Sequence from={TL.outro.from} durationInFrames={TL.outro.dur}>
      <SceneFade dur={TL.outro.dur} fadeOut={1}>
        <Outro tagline="Cada uno su parte, sin discusiones." chips={['Reparto gratis', 'En español', 'Log del loot: Premium']} />
      </SceneFade>
    </Sequence>
  </AbsoluteFill>
);
