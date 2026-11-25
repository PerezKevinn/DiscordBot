import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { Background } from '../common';
import { C, FONT_BODY, FONT_DISPLAY } from '../theme';
import { UserMsg } from '../videos/LootVideo';
import { Rich, TikTokText, colorFor } from './Short';
import { ChatLine } from './timeline';

export type CoverProps = {
  /** Texto de la portada; *palabras* en recuadro dorado (si no hay, se destacan las dos últimas) */
  cover: string;
  /** Los primeros mensajes del chat del gancho */
  chat: ChatLine[];
  channel?: string;
};

/** Fotograma en el que se saca la portada (los mensajes ya terminaron de entrar) */
export const COVER_FRAME = 30;

/** Si el texto no marca nada, destaca las dos últimas palabras (sin contar emojis ni puntos suspensivos) */
export function autoHighlight(text: string): string {
  if (text.includes('*')) return text;
  const m = text.match(/^(.*?)(\S+\s+\S+?)([…!?.]*)(\s*(?:\p{Extended_Pictographic}|️|‍)*\s*)$/u);
  return m && m[1].trim() ? `${m[1]}*${m[2]}${m[3]}*${m[4]}` : text;
}

/**
 * Portada de TikTok con la misma plantilla en todos los videos: el perfil se ve como una serie.
 * Todo lo importante va dentro del recorte 3:4 de la cuadrícula del perfil (y 240–1680).
 */
export const Cover: React.FC<CoverProps> = ({ cover, chat, channel }) => {
  const text = autoHighlight(cover);
  const len = cover.replace(/\*/g, '').length;
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ background: 'radial-gradient(70% 38% at 50% 40%, rgba(227,192,96,0.22), transparent 70%)' }} />
      <AbsoluteFill style={{ padding: '300px 64px 260px', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            fontFamily: FONT_BODY,
            fontWeight: 900,
            fontSize: 40,
            letterSpacing: 4,
            color: '#111',
            background: C.gold,
            padding: '8px 28px',
            borderRadius: 999,
            textTransform: 'uppercase',
          }}
        >
          <Rich text="⚔️ Albion Online" />
        </div>
        <TikTokText text={text} size={len > 42 ? 104 : len > 32 ? 116 : 128} />
        <div
          style={{
            width: 640,
            zoom: 1.3,
            background: C.dChat,
            borderRadius: 22,
            padding: '22px 26px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            fontFamily: FONT_BODY,
            transform: 'rotate(-2deg)',
            boxShadow: '0 30px 70px rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.07)',
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f2f3f5' }}>
            <span style={{ color: '#80848e' }}>#</span> {channel ?? 'general'}
          </div>
          {chat.slice(0, 2).map((c, i) => (
            <UserMsg key={i} who={c.who} color={colorFor(c.who)} at={0}>
              <Rich text={c.text} />
            </UserMsg>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Img src={staticFile('avatar.png')} style={{ width: 96, height: 96, borderRadius: '50%', boxShadow: `0 0 0 3px ${C.gold}, 0 0 40px rgba(227,192,96,0.4)` }} />
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 64, color: C.gold, letterSpacing: 2 }}>MassUp</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const COVER_DEFAULT: CoverProps = {
  cover: 'El Caller tirando @everyone a las 3 am 💀',
  chat: [
    { who: 'Caller', text: '@everyone gank YA 🔥' },
    { who: 'Lyra', text: '¿por qué me pingueas? yo ni hago gank 😡' },
  ],
};
