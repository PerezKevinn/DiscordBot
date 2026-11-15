import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BotHeader, Caption, Cursor, DButton, DiscordWindow, Emoji, Gold, Stage, useVertical } from '../common';
import { C } from '../theme';

const Select: React.FC<{ placeholder: string; value: React.ReactNode; filledAt: number; open?: boolean }> = ({
  placeholder,
  value,
  filledAt,
}) => {
  const frame = useCurrentFrame();
  const filled = frame >= filledAt;
  const flash = interpolate(frame, [filledAt, filledAt + 10], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        background: C.dSelect,
        borderRadius: 10,
        padding: '18px 22px',
        fontSize: 28,
        display: 'flex',
        justifyContent: 'space-between',
        color: filled ? '#f2f3f5' : '#949ba4',
        border: `2px solid ${filled ? `rgba(227,192,96,${0.25 + flash * 0.75})` : 'transparent'}`,
        fontWeight: filled ? 600 : 400,
      }}
    >
      <span>{filled ? value : placeholder}</span>
      <span style={{ color: '#949ba4' }}>⌄</span>
    </div>
  );
};

/** 2,7–6,7 s · /ping abre el asistente privado: contenido, hora, canal y publicar */
export const Wizard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vertical = useVertical();

  const typed = '/ping'.slice(0, Math.max(0, Math.floor((frame - 6) / 3)));
  const card = spring({ frame: frame - 26, fps, config: { damping: 200 } });
  const published = frame >= 104;

  return (
    <Stage
      caption={
        <Caption
          step="Paso 1 · /ping"
          title={
            <>
              Un ping en <Gold>segundos</Gold>
            </>
          }
          sub="Asistente privado: eliges contenido, hora y canal, y publicas."
        />
      }
    >
      <div style={{ position: 'relative' }}>
        <DiscordWindow channel="callers">
          {/* asistente efímero */}
          <div
            style={{
              opacity: card,
              transform: `translateY(${(1 - card) * 40}px)`,
              minHeight: 690,
            }}
          >
            <BotHeader ephemeral />
            <div
              style={{
                background: C.dEmbed,
                borderLeft: `6px solid ${C.goldDeep}`,
                borderRadius: 8,
                padding: '22px 26px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 32, color: '#f2f3f5' }}>
                <Emoji>⚔️</Emoji> Nuevo ping
              </div>
              <Select placeholder="¿Qué contenido sale?" value={<><Emoji>🌀</Emoji> Gankeo en Caminos de Avalon</>} filledAt={46} />
              <Select placeholder="Hora de salida (UTC)" value="21 h" filledAt={62} />
              <Select placeholder="Minuto" value=":15" filledAt={74} />
              <Select placeholder="Canal donde publicar (por defecto, este)" value="# pings" filledAt={86} />
              <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                <DButton big color={C.dGreen} pressed={frame >= 100 && frame < 108} label={<><Emoji>🚀</Emoji> Publicar ping</>} />
                <DButton big color={C.dRed} label="Cancelar" />
              </div>
            </div>
            {published && (
              <div
                style={{
                  marginTop: 18,
                  fontSize: 26,
                  color: C.gold,
                  fontWeight: 600,
                  opacity: interpolate(frame, [104, 110], [0, 1], { extrapolateRight: 'clamp' }),
                }}
              >
                ✅ Ping publicado en #pings
              </div>
            )}
          </div>

          {/* barra de escritura */}
          <div
            style={{
              background: C.dInput,
              borderRadius: 12,
              padding: '20px 24px',
              fontSize: 30,
              color: typed ? '#f2f3f5' : '#6d6f78',
              marginTop: 20,
            }}
          >
            {typed || 'Enviar mensaje a #callers'}
            {frame < 26 && <span style={{ opacity: Math.floor(frame / 8) % 2 ? 0 : 1 }}>|</span>}
          </div>
        </DiscordWindow>
        <Cursor
          path={[
            { f: 30, x: 860, y: 900 },
            { f: 44, x: 560, y: 300 },
            { f: 60, x: 470, y: 392 },
            { f: 72, x: 420, y: 484 },
            { f: 84, x: 520, y: 576 },
            { f: 98, x: 270, y: 676 },
          ]}
          clicks={[44, 60, 72, 84, 100]}
        />
      </div>
    </Stage>
  );
};
