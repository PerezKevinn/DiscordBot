import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { useVertical } from '../common';
import { C, FONT_BODY, FONT_DISPLAY } from '../theme';

/** 19,3–25 s · Cierre: logo, lema y llamada a la acción */
export const Outro: React.FC<{ chips?: string[]; tagline?: React.ReactNode; footer?: React.ReactNode }> = ({
  chips: chipList = ['Gratis', 'En español', 'Sin permisos de admin'],
  tagline,
  footer = 'Bot de Discord para gremios de Albion Online',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vertical = useVertical();

  const logo = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });
  const name = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const words = ['Organiza.', 'Convoca.', 'Conquista.'];
  const chips = spring({ frame: frame - 62, fps, config: { damping: 200 } });
  const cta = spring({ frame: frame - 78, fps, config: { damping: 11 } });
  const pulse = 1 + Math.sin((frame - 78) / 7) * 0.02 * (frame > 100 ? 1 : 0);
  const glow = interpolate(Math.sin(frame / 12), [-1, 1], [0.25, 0.55]);

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        fontFamily: FONT_BODY,
        color: C.text,
        textAlign: 'center',
        paddingBottom: vertical ? 220 : 0,
      }}
    >
      <Img
        src={staticFile('avatar.png')}
        style={{
          width: vertical ? 340 : 260,
          height: vertical ? 340 : 260,
          borderRadius: '50%',
          transform: `scale(${logo})`,
          boxShadow: `0 0 90px rgba(227,192,96,${glow}), 0 0 0 4px ${C.gold}`,
        }}
      />
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          fontSize: vertical ? 150 : 130,
          color: C.gold,
          marginTop: vertical ? 50 : 30,
          letterSpacing: 4,
          opacity: name,
          transform: `translateY(${(1 - name) * 30}px)`,
          textShadow: '0 0 50px rgba(227,192,96,0.3)',
        }}
      >
        MassUp
      </div>
      <div
        style={{
          display: 'flex',
          gap: vertical ? 22 : 28,
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: vertical ? 50 : 52,
          marginTop: 10,
        }}
      >
        {tagline ? (
          <span style={{ opacity: spring({ frame: frame - 26, fps, config: { damping: 200 } }) }}>{tagline}</span>
        ) : words.map((w, i) => {
          const s = spring({ frame: frame - 26 - i * 10, fps, config: { damping: 200 } });
          return (
            <span key={w} style={{ opacity: s, transform: `translateY(${(1 - s) * 24}px)` }}>
              {w}
            </span>
          );
        })}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginTop: vertical ? 50 : 34,
          opacity: chips,
          fontSize: vertical ? 32 : 28,
          fontWeight: 600,
          color: C.muted,
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: vertical ? 900 : 1400,
        }}
      >
        {chipList.map((t) => (
          <span key={t} style={{ border: `2px solid ${C.border}`, borderRadius: 999, padding: '10px 24px', background: C.surface }}>
            ✓ {t}
          </span>
        ))}
      </div>
      <div
        style={{
          marginTop: vertical ? 60 : 40,
          background: C.gold,
          color: '#1a1306',
          fontWeight: 800,
          fontSize: vertical ? 54 : 46,
          padding: vertical ? '26px 60px' : '20px 52px',
          borderRadius: 18,
          transform: `scale(${cta * pulse})`,
          boxShadow: '0 20px 50px rgba(227,192,96,0.3)',
        }}
      >
        massup.shop
      </div>
      <div style={{ marginTop: 22, fontSize: vertical ? 30 : 26, color: C.muted, opacity: cta }}>
        {footer}
      </div>
    </AbsoluteFill>
  );
};
