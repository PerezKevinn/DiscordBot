import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BotHeader, useVertical } from './common';
import { C, FONT_BODY } from './theme';

/** Tarjeta de Discord (mensaje efímero o normal) con el ancho de la maqueta */
export const Card: React.FC<{ children: React.ReactNode; ephemeral?: boolean; time?: string; width?: number; style?: React.CSSProperties }> = ({
  children,
  ephemeral,
  time,
  width,
  style,
}) => {
  const vertical = useVertical();
  return (
    <div
      style={{
        width: width ?? (vertical ? 920 : 980),
        background: C.dChat,
        borderRadius: 22,
        padding: '24px 30px',
        boxShadow: '0 30px 70px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)',
        color: '#dbdee1',
        fontFamily: FONT_BODY,
        ...style,
      }}
    >
      <BotHeader ephemeral={ephemeral} time={time} />
      {children}
    </div>
  );
};

/** Embed con borde dorado */
export const Embed: React.FC<{ children: React.ReactNode; author?: string; title?: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  author,
  title,
  style,
}) => (
  <div style={{ background: C.dEmbed, borderLeft: `6px solid ${C.goldDeep}`, borderRadius: 8, padding: '18px 22px', ...style }}>
    {author && <div style={{ fontSize: 19, color: '#dbdee1', fontWeight: 600, marginBottom: 6 }}>{author}</div>}
    {title && <div style={{ fontWeight: 800, fontSize: 28, color: '#f2f3f5', marginBottom: 8 }}>{title}</div>}
    {children}
  </div>
);

/** Línea de texto que aparece con un pequeño deslizamiento en el fotograma `at` */
export const Reveal: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return <div style={{ ...style, visibility: 'hidden' }}>{children}</div>;
  const s = spring({ frame: frame - at, fps, config: { damping: 200 } });
  return <div style={{ ...style, opacity: s, transform: `translateX(${(1 - s) * 24}px)` }}>{children}</div>;
};

/** Texto pequeño gris de Discord (-#) */
export const Small: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 19, color: '#949ba4', marginTop: 8 }}>{children}</div>
);

/** Menú desplegable de Discord */
export const DSelect: React.FC<{ children: React.ReactNode; highlight?: number }> = ({ children, highlight = 0 }) => (
  <div
    style={{
      background: C.dSelect,
      borderRadius: 10,
      padding: '16px 20px',
      fontSize: 26,
      display: 'flex',
      justifyContent: 'space-between',
      color: '#f2f3f5',
      fontWeight: 600,
      border: `2px solid rgba(227,192,96,${0.15 + highlight * 0.85})`,
    }}
  >
    <span>{children}</span>
    <span style={{ color: '#949ba4' }}>⌄</span>
  </div>
);

/** Destello dorado que se apaga (0..1) a partir de `at` */
export const useFlash = (at: number, len = 14) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [at, at + len], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * (frame >= at ? 1 : 0);
};

/** Cuenta animada de 0 a `to` entre `from` y `from + dur` con formato de plata (12.500.000) */
export const useCount = (to: number, from: number, dur = 18) => {
  const frame = useCurrentFrame();
  const v = interpolate(frame, [from, from + dur], [0, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - (1 - t) ** 3,
  });
  return silver(Math.round(v / 1000) * 1000 === to ? to : Math.round(v));
};

export const silver = (n: number) => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
