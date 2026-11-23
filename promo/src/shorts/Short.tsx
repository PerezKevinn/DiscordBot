import React from 'react';
import { AbsoluteFill, CalculateMetadataFunction, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background, Caption, Emoji, Gold, HideSteps, Mention, SceneFade, Stage } from '../common';
import { Mando } from '../scenes/Mando';
import { Outro } from '../scenes/Outro';
import { PingRoster } from '../scenes/PingRoster';
import { Wizard } from '../scenes/Wizard';
import { C, FONT_BODY, FONT_DISPLAY } from '../theme';
import { LootGG, LootLog, LootModal, LootReparto, UserMsg } from '../videos/LootVideo';
import { NovHora, NovLoot, NovPanel, NovSwaps, NovTickets } from '../videos/NovedadesVideo';
import { PayoffKey, ShortProps, TURN_DUR, shortTimeline } from './timeline';

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
const colorFor = (name: string) => PALETTE[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % PALETTE.length];

const ShortHook: React.FC<{ hook: ShortProps['hook']; chatAt: number[]; dur: number }> = ({ hook, chatAt, dur }) => {
  const frame = useCurrentFrame();
  const shakeFrom = dur - 22;
  const shake = frame > shakeFrom && frame < shakeFrom + 14 ? Math.sin(frame * 2.7) * 8 : 0;
  return (
    <Stage caption={<Caption step={hook.kicker} title={<Rich text={hook.title} />} sub={hook.sub ? <Rich text={hook.sub} /> : undefined} />}>
      <div
        style={{
          width: 820,
          zoom: 1.13, // más grande que en los videos largos: en el móvil se lee de un vistazo
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
          <span style={{ color: '#80848e' }}>#</span> {hook.channel ?? 'general'}
        </div>
        {hook.chat.map((c, i) => (
          <UserMsg key={i} who={c.who} color={colorFor(c.who)} at={chatAt[i]}>
            <Rich text={c.text} />
          </UserMsg>
        ))}
      </div>
    </Stage>
  );
};

/** Golpe de giro: frase grande en el centro con destello */
const Turn: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 11, stiffness: 140 } });
  const flash = interpolate(frame, [0, 3, 12], [0.55, 0.35, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: '0 90px 260px' }}>
      <AbsoluteFill style={{ background: C.gold, opacity: flash }} />
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          fontSize: 112,
          lineHeight: 1.08,
          color: C.text,
          textAlign: 'center',
          transform: `scale(${0.6 + 0.4 * s})`,
          opacity: s,
          textShadow: '0 0 60px rgba(227,192,96,0.35)',
        }}
      >
        <Rich text={text} />
      </div>
    </AbsoluteFill>
  );
};

/** Video corto diario (vertical): gancho con chat → giro → demostración real → cierre con CTA */
export const Short: React.FC<ShortProps> = (props) => {
  const tl = shortTimeline(props);
  return (
    <AbsoluteFill>
      <Background />
      <Sequence durationInFrames={tl.hookDur}>
        <SceneFade dur={tl.hookDur} fadeIn={1} fadeOut={3}>
          <ShortHook hook={props.hook} chatAt={tl.chat} dur={tl.hookDur} />
        </SceneFade>
      </Sequence>
      <Sequence from={tl.turn} durationInFrames={TURN_DUR}>
        <SceneFade dur={TURN_DUR} fadeIn={1} fadeOut={5}>
          <Turn text={props.turn} />
        </SceneFade>
      </Sequence>
      <HideSteps.Provider value>
        {tl.scenes.map((s, i) => {
          const Scene = SCENES[s.key];
          return (
            <Sequence key={i} from={s.from} durationInFrames={s.dur}>
              <SceneFade dur={s.dur} fadeIn={5}>
                <Scene />
              </SceneFade>
            </Sequence>
          );
        })}
      </HideSteps.Provider>
      <Sequence from={tl.outro}>
        <SceneFade dur={tl.total - tl.outro} fadeOut={1}>
          <Outro tagline={<Rich text={props.tagline} />} chips={props.chips} footer={props.footer ?? 'Link en el perfil 👆'} />
        </SceneFade>
      </Sequence>
    </AbsoluteFill>
  );
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
