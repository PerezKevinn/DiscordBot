import React, { createContext, useContext } from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT_BODY, FONT_DISPLAY, FONT_EMOJI } from './theme';

export const useVertical = () => {
  const { width, height } = useVideoConfig();
  return height > width;
};

/** Fondo negro con brillo dorado y azul pizarra que respira despacio */
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 60) * 6;
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 40% at ${50 + drift}% 18%, rgba(227,192,96,0.16), transparent 70%),
                       radial-gradient(55% 45% at ${30 - drift}% 90%, rgba(44,90,160,0.22), transparent 70%)`,
        }}
      />
      {/* marco dorado fino, como el banner del ping */}
      <AbsoluteFill style={{ padding: 28 }}>
        <div style={{ flex: 1, border: '2px solid rgba(227,192,96,0.22)', borderRadius: 18 }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Aparece y desaparece la escena con un fundido corto */
export const SceneFade: React.FC<{ dur: number; children: React.ReactNode; fadeIn?: number; fadeOut?: number }> = ({
  dur,
  children,
  fadeIn = 8,
  fadeOut = 8,
}) => {
  const frame = useCurrentFrame();
  // fadeIn = 0: visible desde el primer fotograma (el primer fotograma de un video corto no puede salir en negro)
  const opacity =
    fadeIn > 0
      ? interpolate(frame, [0, fadeIn, dur - fadeOut, dur], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : interpolate(frame, [dur - fadeOut, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

/**
 * Reparte la escena: título arriba y maqueta abajo (vertical) o título a la izquierda y maqueta
 * a la derecha (horizontal). En vertical deja libre el 20 % inferior y el lateral derecho para la
 * interfaz de TikTok / Reels / Shorts.
 */
export const Stage: React.FC<{ caption: React.ReactNode; children: React.ReactNode }> = ({ caption, children }) => {
  const vertical = useVertical();
  if (vertical) {
    return (
      <AbsoluteFill style={{ padding: '170px 80px 330px', flexDirection: 'column', gap: 50 }}>
        <div style={{ minHeight: 330 }}>{caption}</div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>{children}</div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ padding: '90px 110px', flexDirection: 'row', alignItems: 'center', gap: 80 }}>
      <div style={{ width: 640 }}>{caption}</div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>{children}</div>
    </AbsoluteFill>
  );
};

/** En los videos cortos se ocultan los «Paso N» / «Novedad N» de las escenas reutilizadas */
export const HideSteps = createContext(false);

/** Texto en pantalla: número de paso, título en Cinzel con palabra dorada y subtítulo */
export const Caption: React.FC<{ step?: string; title: React.ReactNode; sub?: React.ReactNode; delay?: number }> = ({
  step,
  title,
  sub,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vertical = useVertical();
  const hideSteps = useContext(HideSteps);
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  const s2 = spring({ frame: frame - delay - 8, fps, config: { damping: 200 } });
  return (
    <div style={{ fontFamily: FONT_BODY, color: C.text }}>
      {step && !hideSteps && (
        <div
          style={{
            opacity: s,
            color: C.gold,
            fontSize: vertical ? 30 : 26,
            letterSpacing: 6,
            fontWeight: 700,
            marginBottom: 18,
            textTransform: 'uppercase',
          }}
        >
          {step}
        </div>
      )}
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: vertical ? 84 : 72,
          lineHeight: 1.1,
          opacity: s,
          transform: `translateY(${(1 - s) * 40}px)`,
        }}
      >
        {title}
      </div>
      {sub && (
        <div
          style={{
            marginTop: 24,
            fontSize: vertical ? 40 : 34,
            color: C.muted,
            fontWeight: 500,
            lineHeight: 1.3,
            opacity: s2,
            transform: `translateY(${(1 - s2) * 30}px)`,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
};

export const Gold: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ color: C.gold }}>{children}</span>
);

export const Emoji: React.FC<{ children: React.ReactNode; size?: number | string }> = ({ children, size }) => (
  <span style={{ fontFamily: FONT_EMOJI, fontSize: size }}>{children}</span>
);

export const Mention: React.FC<{ children: React.ReactNode; glow?: number }> = ({ children, glow = 0 }) => (
  <span
    style={{
      background: C.dMention,
      color: C.dMentionText,
      borderRadius: 6,
      padding: '0 6px',
      fontWeight: 600,
      boxShadow: glow > 0 ? `0 0 ${24 * glow}px rgba(88,101,242,${0.9 * glow})` : undefined,
    }}
  >
    {children}
  </span>
);

/** Ventana estilo Discord oscuro que contiene los mensajes */
export const DiscordWindow: React.FC<{ children: React.ReactNode; width?: number; channel?: string }> = ({
  children,
  width,
  channel = 'pings',
}) => {
  const vertical = useVertical();
  return (
    <div
      style={{
        width: width ?? (vertical ? 920 : 980),
        background: C.dChat,
        borderRadius: 22,
        boxShadow: '0 40px 90px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
        fontFamily: FONT_BODY,
        color: '#dbdee1',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '20px 30px',
          borderBottom: '1px solid rgba(0,0,0,0.35)',
          fontWeight: 700,
          fontSize: 30,
          color: '#f2f3f5',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <span style={{ color: '#80848e', fontSize: 36 }}>#</span>
        {channel}
      </div>
      <div style={{ padding: '26px 30px 30px' }}>{children}</div>
    </div>
  );
};

/** Cabecera de un mensaje del bot (avatar + MassUp + APP) */
export const BotHeader: React.FC<{ time?: string; ephemeral?: boolean }> = ({ time = 'hoy a las 21:00', ephemeral }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
    <Img src={staticFile('avatar.png')} style={{ width: 62, height: 62, borderRadius: '50%' }} />
    <span style={{ fontWeight: 700, fontSize: 30, color: C.gold }}>MassUp</span>
    <span
      style={{
        background: C.dBlurple,
        color: 'white',
        fontSize: 17,
        fontWeight: 700,
        padding: '3px 7px',
        borderRadius: 5,
      }}
    >
      APP
    </span>
    <span style={{ color: '#949ba4', fontSize: 22 }}>{ephemeral ? 'Solo tú puedes ver esto' : time}</span>
  </div>
);

/** Puntero que se mueve y "clica" (se encoge un instante) */
export const Cursor: React.FC<{
  path: Array<{ f: number; x: number; y: number }>;
  clicks?: number[];
}> = ({ path, clicks = [] }) => {
  const frame = useCurrentFrame();
  const fs = path.map((p) => p.f);
  const x = interpolate(frame, fs, path.map((p) => p.x), { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const y = interpolate(frame, fs, path.map((p) => p.y), { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const press = clicks.some((c) => frame >= c && frame < c + 5) ? 0.8 : 1;
  const ring = clicks
    .map((c) => frame - c)
    .filter((d) => d >= 0 && d < 14)
    .map((d) => d / 14)[0];
  return (
    <div style={{ position: 'absolute', left: x, top: y, pointerEvents: 'none', zIndex: 50 }}>
      {ring !== undefined && (
        <div
          style={{
            position: 'absolute',
            left: -30 * (0.4 + ring),
            top: -30 * (0.4 + ring),
            width: 60 * (0.4 + ring),
            height: 60 * (0.4 + ring),
            borderRadius: '50%',
            border: `4px solid rgba(227,192,96,${1 - ring})`,
          }}
        />
      )}
      <svg width="54" height="54" viewBox="0 0 24 24" style={{ transform: `scale(${press})`, transformOrigin: '0 0' }}>
        <path d="M3 2l7 19 2.5-7.5L20 11z" fill="white" stroke="#111" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

/** Botón de Discord */
export const DButton: React.FC<{
  label: React.ReactNode;
  color?: string;
  pressed?: boolean;
  big?: boolean;
}> = ({ label, color = C.dGrey, pressed, big }) => (
  <div
    style={{
      background: color,
      color: 'white',
      fontWeight: 600,
      fontSize: big ? 30 : 26,
      padding: big ? '16px 30px' : '12px 22px',
      borderRadius: 10,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      filter: pressed ? 'brightness(1.35)' : undefined,
      transform: pressed ? 'scale(0.95)' : undefined,
      boxShadow: pressed ? `0 0 0 4px ${C.gold}` : undefined,
    }}
  >
    {label}
  </div>
);
