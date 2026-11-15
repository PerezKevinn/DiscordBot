import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { Background, SceneFade } from './common';
import { Hook } from './scenes/Hook';
import { Mando } from './scenes/Mando';
import { Outro } from './scenes/Outro';
import { PingRoster } from './scenes/PingRoster';
import { Wizard } from './scenes/Wizard';
import { T } from './theme';

/** Concepto A · «De 0 a party en 15 segundos». Misma pieza en 9:16 y 16:9. */
export const Promo: React.FC = () => (
  <AbsoluteFill>
    <Background />
    <Sequence from={T.hook.from} durationInFrames={T.hook.dur}>
      <SceneFade dur={T.hook.dur} fadeIn={1}>
        <Hook />
      </SceneFade>
    </Sequence>
    <Sequence from={T.wizard.from} durationInFrames={T.wizard.dur}>
      <SceneFade dur={T.wizard.dur}>
        <Wizard />
      </SceneFade>
    </Sequence>
    <Sequence from={T.pingRoster.from} durationInFrames={T.pingRoster.dur}>
      <SceneFade dur={T.pingRoster.dur}>
        <PingRoster />
      </SceneFade>
    </Sequence>
    <Sequence from={T.mando.from} durationInFrames={T.mando.dur}>
      <SceneFade dur={T.mando.dur}>
        <Mando />
      </SceneFade>
    </Sequence>
    <Sequence from={T.outro.from} durationInFrames={T.outro.dur}>
      <SceneFade dur={T.outro.dur} fadeOut={1}>
        <Outro />
      </SceneFade>
    </Sequence>
  </AbsoluteFill>
);
