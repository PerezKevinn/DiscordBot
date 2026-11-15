import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Gold, useVertical } from '../common';
import { C, FONT_BODY, FONT_DISPLAY } from '../theme';

/** 0–2,7 s · Gancho: el cronómetro del Caller se dispara y MassUp lo corta en seco */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vertical = useVertical();

  // El cronómetro corre de 00:00 a 10:00 en 1,6 s y se para
  const secs = Math.round(interpolate(frame, [4, 52], [0, 600], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  const shake = frame > 46 && frame < 58 ? Math.sin(frame * 3) * 8 : 0;

  const intro = spring({ frame, fps, config: { damping: 200 } });
  const swap = spring({ frame: frame - 56, fps, config: { damping: 14, stiffness: 140 } });

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        textAlign: 'center',
        padding: vertical ? '0 80px 200px' : '0 120px',
        fontFamily: FONT_BODY,
        color: C.text,
      }}
    >
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: vertical ? 92 : 80,
          lineHeight: 1.12,
          opacity: intro * (1 - swap),
          transform: `translateY(${(1 - intro) * 50 - swap * 60}px)`,
          position: 'absolute',
          width: vertical ? 900 : 1500,
          top: vertical ? 470 : 200,
        }}
      >
        ¿Tu Caller tarda <Gold>10 minutos</Gold> en armar party?
      </div>

      <div
        style={{
          position: 'absolute',
          top: vertical ? 990 : 560,
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 800,
          fontSize: vertical ? 220 : 190,
          letterSpacing: 4,
          color: secs >= 600 ? '#ff6b6b' : C.text,
          transform: `translateX(${shake}px) scale(${1 - swap * 0.25})`,
          opacity: 1 - swap,
          textShadow: secs >= 600 ? '0 0 50px rgba(255,80,80,0.5)' : undefined,
        }}
      >
        ⏱ {mm}:{ss}
      </div>

      <div
        style={{
          position: 'absolute',
          top: vertical ? 700 : 330,
          width: vertical ? 900 : 1500,
          opacity: swap,
          transform: `scale(${0.8 + swap * 0.2})`,
        }}
      >
        <div style={{ fontSize: vertical ? 46 : 40, color: C.muted, fontWeight: 600, letterSpacing: 4 }}>CON MASSUP</div>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 800,
            fontSize: vertical ? 150 : 140,
            color: C.gold,
            lineHeight: 1.05,
            marginTop: 10,
            textShadow: '0 0 60px rgba(227,192,96,0.35)',
          }}
        >
          15 segundos
        </div>
      </div>
    </AbsoluteFill>
  );
};
