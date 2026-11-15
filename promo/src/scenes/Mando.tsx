import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { BotHeader, Caption, Cursor, DButton, Emoji, Gold, Stage, useVertical } from '../common';
import { C, FONT_BODY } from '../theme';

const A_VOZ = 28;
const GG = 66;

const Row: React.FC<{ icon: string; label: string; goneAt: number; children?: React.ReactNode }> = ({
  icon,
  label,
  goneAt,
  children,
}) => {
  const frame = useCurrentFrame();
  const strike = interpolate(frame, [goneAt, goneAt + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const out = interpolate(frame, [goneAt + 12, goneAt + 24], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ opacity: out, maxHeight: 200 * out, overflow: 'hidden' }}>
      <div style={{ position: 'relative', display: 'inline-block', fontSize: 25, color: '#dbdee1', fontWeight: 600 }}>
        <Emoji>{icon}</Emoji> {label}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '52%',
            height: 4,
            width: `${strike * 100}%`,
            background: '#ff6b6b',
            borderRadius: 2,
          }}
        />
      </div>
      {children}
    </div>
  );
};

/** 15–19,3 s · Mando del Caller: ¡A voz! y GG; la voz y el hilo se borran solos */
export const Mando: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vertical = useVertical();
  const enter = spring({ frame, fps, config: { damping: 200 } });

  const toast = (at: number, text: React.ReactNode, until: number) => {
    const s = spring({ frame: frame - at, fps, config: { damping: 14 } });
    const o = interpolate(frame, [until - 8, until], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    if (frame < at) return null;
    return (
      <div
        style={{
          marginTop: 16,
          fontSize: 25,
          fontWeight: 600,
          color: C.gold,
          opacity: Math.min(s, o),
          transform: `translateX(${(1 - s) * 30}px)`,
        }}
      >
        {text}
      </div>
    );
  };

  const capB = frame >= GG;

  return (
    <Stage
      caption={
        capB ? (
          <Caption
            key="b"
            delay={GG}
            step="Paso 4 · GG"
            title={
              <>
                GG y se <Gold>limpia solo</Gold>
              </>
            }
            sub="La voz y el hilo de builds se borran al terminar."
          />
        ) : (
          <Caption
            key="a"
            step="Mando del Caller"
            title={
              <>
                Tú <Gold>mandas</Gold> la party
              </>
            }
            sub="En ruta, ¡A voz!, GG y Cancelar, en privado."
          />
        )
      }
    >
      <div
        style={{
          position: 'relative',
          width: vertical ? 920 : 980,
          display: 'flex',
          flexDirection: 'column',
          gap: 26,
          opacity: enter,
          transform: `translateY(${(1 - enter) * 60}px)`,
          fontFamily: FONT_BODY,
        }}
      >
        {/* Lista de canales del servidor */}
        <div
          style={{
            background: '#2b2d31',
            borderRadius: 22,
            padding: '24px 30px',
            boxShadow: '0 30px 70px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            minHeight: 250,
          }}
        >
          <div style={{ fontSize: 20, color: '#949ba4', fontWeight: 700, letterSpacing: 1 }}>SALIDAS</div>
          <Row icon="🔊" label="🌀︱Gankeo en Caminos de… (Draven)" goneAt={GG + 6}>
            <div style={{ display: 'flex', gap: 8, margin: '10px 0 0 44px' }}>
              {Array.from({ length: 7 }).map((_, i) => (
                <Img
                  key={i}
                  src={staticFile('avatar.png')}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    filter: `hue-rotate(${i * 50}deg) saturate(${0.6 + (i % 3) * 0.3})`,
                    opacity: frame >= A_VOZ + 6 + i * 3 ? 1 : 0.15,
                    boxShadow: frame >= A_VOZ + 6 + i * 3 ? '0 0 0 3px #23a55a' : undefined,
                  }}
                />
              ))}
            </div>
          </Row>
          <Row icon="🧵" label="⚔️ Gankeo en Caminos de Avalon — Draven" goneAt={GG + 12} />
          {frame >= GG + 34 && (
            <div
              style={{
                fontSize: 24,
                color: C.muted,
                opacity: interpolate(frame, [GG + 34, GG + 44], [0, 1], { extrapolateRight: 'clamp' }),
              }}
            >
              Canal limpio, listo para la siguiente salida <Emoji>✨</Emoji>
            </div>
          )}
        </div>

        {/* Mando del Caller (efímero) */}
        <div
          style={{
            background: C.dChat,
            borderRadius: 22,
            padding: '26px 30px',
            boxShadow: '0 30px 70px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)',
            color: '#dbdee1',
          }}
        >
          <BotHeader ephemeral />
          <div style={{ background: C.dEmbed, borderLeft: `6px solid ${C.goldDeep}`, borderRadius: 8, padding: '18px 22px' }}>
            <div style={{ fontWeight: 800, fontSize: 30, color: '#f2f3f5' }}>
              <Emoji>👑</Emoji> Mando del Caller
            </div>
            <div style={{ fontSize: 23, marginTop: 6, color: '#b5bac1' }}>🌀 Gankeo en Caminos de Avalon · 7/7</div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
            <DButton label="En ruta" color={C.dBlurple} />
            <DButton label={<><Emoji>📢</Emoji> ¡A voz!</>} pressed={frame >= A_VOZ && frame < A_VOZ + 8} />
            <DButton label={<><Emoji>🔒</Emoji> GG</>} color={C.dGreen} pressed={frame >= GG && frame < GG + 8} />
            <DButton label={<><Emoji>🗑️</Emoji> Cancelar</>} color={C.dRed} />
          </div>
          {toast(A_VOZ + 4, <>📢 Avisé a la party: ¡todos a voz!</>, GG)}
          {toast(GG + 4, <>🔒 GG · voz e hilo borrados</>, 200)}
        </div>

        <Cursor
          path={[
            { f: 6, x: 760, y: 760 },
            { f: A_VOZ - 4, x: 258, y: 528 },
            { f: GG - 6, x: 422, y: 528 },
            { f: GG + 30, x: 640, y: 700 },
          ]}
          clicks={[A_VOZ, GG]}
        />
      </div>
    </Stage>
  );
};
