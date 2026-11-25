import React from 'react';
import { AbsoluteFill, CalculateMetadataFunction, Easing, Freeze, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background, Emoji, Gold, HideSteps, Mention, SceneFade } from '../common';
import { Mando } from '../scenes/Mando';
import { Outro } from '../scenes/Outro';
import { PingRoster } from '../scenes/PingRoster';
import { Wizard } from '../scenes/Wizard';
import { C, FONT_BODY } from '../theme';
import { LootGG, LootLog, LootModal, LootReparto, UserMsg } from '../videos/LootVideo';
import { NovHora, NovLoot, NovPanel, NovSwaps, NovTickets } from '../videos/NovedadesVideo';
import { LOOP_DUR, PayoffKey, ShortProps, TURN_DUR, shortTimeline } from './timeline';

const SCENES: Record<PayoffKey, React.FC> = {
  ping: Wizard,
  roster: PingRoster,
  mando: Mando,
  gg: LootGG,
  plata: LootModal,
  reparto: LootReparto,
  log: LootLog,
  hora: NovHora,
  swaps: NovSwaps,
  lootcorto: NovLoot,
  tickets: NovTickets,
  panel: NovPanel,
};

const EMOJI_RE = /(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)/u;

/** Texto con *oro*, @menciones y emojis */
export const Rich: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/(\*[^*]+\*|@[\p{L}\d_]+)/u).map((part, i) => {
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <Gold key={i}><Rich text={part.slice(1, -1)} /></Gold>;
      if (part.startsWith('@') && part.length > 1) return <Mention key={i}>{part}</Mention>;
      return part.split(EMOJI_RE).map((p, j) => (j % 2 ? <Emoji key={`${i}-${j}`}>{p}</Emoji> : p));
    })}
  </>
);

const PALETTE = ['#c084fc', '#60a5fa', '#f87171', '#34d399', '#fbbf24', '#f472b6', '#22d3ee', '#a3e635'];
export const colorFor = (name: string) => PALETTE[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % PALETTE.length];

/**
 * Texto al estilo TikTok: Inter Black blanco con contorno negro grueso; las *palabras* van en
 * recuadro dorado. Se lee en el móvil sin sonido y de un vistazo.
 */
export const TikTokText: React.FC<{ text: string; size: number; words?: (i: number) => React.CSSProperties }> = ({ text, size, words }) => {
  let i = 0;
  const parts = text.split(/(\*[^*]+\*)/);
  return (
    <div
      style={{
        fontFamily: FONT_BODY,
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1.12,
        color: 'white',
        textAlign: 'center',
        letterSpacing: -1,
        WebkitTextStroke: `${Math.round(size / 7)}px #000`,
        paintOrder: 'stroke fill',
        textShadow: '0 8px 24px rgba(0,0,0,0.55)',
      }}
    >
      {parts.map((part, pi) => {
        const hl = part.startsWith('*') && part.endsWith('*') && part.length > 2;
        const body = hl ? part.slice(1, -1) : part;
        const tokens = body.split(/(\s+)/);
        // sin animación por palabra, la frase destacada va en un solo recuadro
        if (hl && !words)
          return (
            <span key={pi} style={{ display: 'inline-block', background: C.gold, color: '#111', WebkitTextStroke: 0, textShadow: 'none', padding: '0 14px', borderRadius: 14, boxShadow: '0 8px 0 #000' }}>
              <Rich text={body} />
            </span>
          );
        return tokens.map((tok, ti) => {
          if (!tok.trim()) return <React.Fragment key={`${pi}-${ti}`}>{tok}</React.Fragment>;
          const st = words?.(i++) ?? {};
          // la palabra destacada lleva su propio recuadro: así entra animada junto con él
          const box: React.CSSProperties = hl
            ? { background: C.gold, color: '#111', WebkitTextStroke: 0, textShadow: 'none', padding: '0 14px', borderRadius: 14, boxShadow: '0 8px 0 #000' }
            : {};
          return (
            <span key={`${pi}-${ti}`} style={{ display: 'inline-block', ...box, ...st }}>
              <Rich text={tok} />
            </span>
          );
        });
      })}
    </div>
  );
};

/** Gancho: titular grande visible desde el fotograma 0 y chat que se llena, crece y tiembla */
const ShortHook: React.FC<{ hook: ShortProps['hook']; chatAt: number[]; dur: number }> = ({ hook, chatAt, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const punch = interpolate(frame, [0, 7], [1.12, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const shakeFrom = dur - 22;
  const shaking = frame > shakeFrom && frame < shakeFrom + 16;
  const shakeX = shaking ? Math.sin(frame * 2.7) * 14 : 0;
  const shakeR = shaking ? Math.sin(frame * 1.9) * 1.2 : 0;
  const zoom = interpolate(frame, [0, dur], [1, 1.07]); // acercamiento lento: tensión
  const arrived = chatAt.filter((a) => frame >= a).length;
  const lastAt = chatAt[arrived - 1] ?? 0;
  const badge = arrived ? spring({ frame: frame - lastAt, fps, config: { damping: 8, stiffness: 220 } }) : 0;
  const red = shaking ? interpolate(frame - shakeFrom, [0, 4, 16], [0, 0.6, 0]) : 0;
  return (
    <AbsoluteFill style={{ padding: '200px 60px 330px', flexDirection: 'column', alignItems: 'center', gap: 70 }}>
      <div style={{ transform: `scale(${punch})`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
        {hook.kicker && (
          <div
            style={{
              fontFamily: FONT_BODY,
              fontWeight: 900,
              fontSize: 44,
              background: '#fe2c55',
              color: 'white',
              padding: '6px 26px',
              borderRadius: 12,
              textTransform: 'uppercase',
              letterSpacing: 2,
              transform: 'rotate(-3deg)',
            }}
          >
            <Rich text={hook.kicker} />
          </div>
        )}
        <TikTokText text={hook.title} size={hook.title.length > 34 ? 92 : 104} />
        {hook.sub && (
          <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 42, color: C.muted, textAlign: 'center' }}>
            <Rich text={hook.sub} />
          </div>
        )}
      </div>
      <div style={{ position: 'relative', transform: `translateX(${shakeX}px) rotate(${shakeR}deg) scale(${zoom})` }}>
        <div
          style={{
            width: 680,
            zoom: 1.4, // en el móvil se lee de un vistazo
            background: C.dChat,
            borderRadius: 22,
            padding: '26px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
            fontFamily: FONT_BODY,
            boxShadow: '0 30px 70px rgba(0,0,0,0.55), 0 0 0 2px rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 700, color: '#f2f3f5' }}>
            <span style={{ color: '#80848e' }}>#</span> {hook.channel ?? 'general'}
          </div>
          {hook.chat.map((c, i) => (
            <UserMsg key={i} who={c.who} color={colorFor(c.who)} at={chatAt[i]}>
              <Rich text={c.text} />
            </UserMsg>
          ))}
        </div>
        {/* contador de menciones sin leer, como en Discord */}
        {arrived > 0 && (
          <div
            style={{
              position: 'absolute',
              right: -22,
              top: -26,
              minWidth: 74,
              height: 74,
              padding: '0 16px',
              borderRadius: 999,
              background: C.dRed,
              color: 'white',
              fontFamily: FONT_BODY,
              fontWeight: 900,
              fontSize: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `6px solid ${C.bg}`,
              transform: `scale(${0.4 + 0.6 * badge})`,
            }}
          >
            {arrived * 7 + 2}
          </div>
        )}
      </div>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(255,30,60,0.85) 100%)', opacity: red, pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};

/** Golpe de giro: destello, palabras que caen una a una y sacudida */
const Turn: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flash = interpolate(frame, [0, 2, 10], [0.9, 0.5, 0], { extrapolateRight: 'clamp' });
  const shake = frame < 10 ? Math.sin(frame * 3.1) * (10 - frame) * 1.6 : 0;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 70px 260px' }}>
      <AbsoluteFill style={{ background: `radial-gradient(60% 45% at 50% 42%, rgba(227,192,96,0.35), transparent 70%)` }} />
      <AbsoluteFill style={{ background: 'white', opacity: flash }} />
      <div style={{ transform: `translate(${shake}px, ${-shake / 2}px)` }}>
        <TikTokText
          text={text}
          size={124}
          words={(i) => {
            const s = spring({ frame: frame - i * 2, fps, config: { damping: 14, stiffness: 320 } });
            return { transform: `scale(${1.5 - 0.5 * s})`, opacity: frame >= i * 2 ? 1 : 0 };
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

/** Corte con golpe de zoom al entrar y acercamiento suave durante la escena */
const Punch: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const frame = useCurrentFrame();
  const inZoom = interpolate(frame, [0, 8], [1.14, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const drift = interpolate(frame, [0, dur], [1, 1.05]);
  const flash = interpolate(frame, [0, 5], [0.45, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${inZoom * drift})` }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ background: 'white', opacity: flash }} />
    </AbsoluteFill>
  );
};

/** Barra de progreso arriba: quien ve que falta poco se queda hasta el final */
const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 12, background: 'rgba(255,255,255,0.12)' }} />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: 12,
          width: `${(100 * (frame + 1)) / durationInFrames}%`,
          background: `linear-gradient(90deg, ${C.goldDeep}, ${C.gold})`,
          boxShadow: '0 0 18px rgba(227,192,96,0.8)',
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Video corto diario (vertical, ritmo TikTok): gancho visible desde el primer fotograma →
 * giro con golpe → demostración real con cortes de zoom → cierre rápido que enlaza con el inicio.
 */
export const Short: React.FC<ShortProps> = (props) => {
  const tl = shortTimeline(props);
  const hook = <ShortHook hook={props.hook} chatAt={tl.chat} dur={tl.hookDur} />;
  return (
    <AbsoluteFill>
      <Background />
      <Sequence durationInFrames={tl.hookDur}>
        <SceneFade dur={tl.hookDur} fadeIn={0} fadeOut={2}>
          {hook}
        </SceneFade>
      </Sequence>
      <Sequence from={tl.turn} durationInFrames={TURN_DUR}>
        <SceneFade dur={TURN_DUR} fadeIn={0} fadeOut={3}>
          <Turn text={props.turn} />
        </SceneFade>
      </Sequence>
      <HideSteps.Provider value>
        {tl.scenes.map((s, i) => {
          const Scene = SCENES[s.key];
          return (
            <Sequence key={i} from={s.from} durationInFrames={s.dur}>
              <Punch dur={s.dur}>
                <Scene />
              </Punch>
            </Sequence>
          );
        })}
      </HideSteps.Provider>
      <Sequence from={tl.outro}>
        <Punch dur={tl.total - tl.outro}>
          <Outro tagline={<Rich text={props.tagline} />} chips={props.chips} footer={props.footer ?? 'Link en el perfil 👆'} speed={1.6} />
        </Punch>
      </Sequence>
      {/* bucle: los últimos fotogramas funden con el primero y TikTok lo repite sin corte */}
      <Sequence from={tl.total - LOOP_DUR}>
        <LoopIn>
          <Background />
          <Freeze frame={0}>{hook}</Freeze>
        </LoopIn>
      </Sequence>
      <ProgressBar />
    </AbsoluteFill>
  );
};

const LoopIn: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: interpolate(frame, [0, LOOP_DUR - 1], [0, 1], { extrapolateRight: 'clamp' }) }}>{children}</AbsoluteFill>;
};

export const calculateShortMetadata: CalculateMetadataFunction<ShortProps> = ({ props }) => ({
  durationInFrames: shortTimeline(props).total,
});

/** Ejemplo para el Studio (las ideas reales están en shorts/ideas.json) */
export const SHORT_DEFAULT: ShortProps = {
  hook: {
    kicker: 'POV',
    title: 'El Caller armando party *a mano*',
    channel: 'general',
    chat: [
      { who: 'Caller', text: '@everyone gank en 10 min, ¿quién va? 🙏' },
      { who: 'Bruno', text: 'yo, ¿de qué voy?' },
      { who: 'Nyx', text: 'yo healer… ¿o ya hay?' },
      { who: 'Kael', text: '¿a qué hora era? 😴' },
    ],
  },
  turn: 'Hasta que llegó *MassUp*',
  payoff: ['ping', 'roster'],
  tagline: 'Party armada en *15 segundos*.',
  chips: ['Gratis', 'En español'],
};
