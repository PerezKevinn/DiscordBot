import React from 'react';
import { Composition } from 'remotion';
import { Promo } from './Promo';
import { FPS, TOTAL } from './theme';
import { LOOT_TOTAL, LootVideo } from './videos/LootVideo';
import { NOVEDADES_TOTAL, NovedadesVideo } from './videos/NovedadesVideo';
import { SHORT_DEFAULT, Short, calculateShortMetadata } from './shorts/Short';
import { COVER_DEFAULT, COVER_FRAME, Cover } from './shorts/Cover';

const V = { width: 1080, height: 1920 };
const H = { width: 1920, height: 1080 };

export const Root: React.FC = () => (
  <>
    {/* Concepto A · «De 0 a party en 15 segundos» */}
    <Composition id="PartyEn15s" component={Promo} durationInFrames={TOTAL} fps={FPS} {...V} />
    <Composition id="PartyEn15sHorizontal" component={Promo} durationInFrames={TOTAL} fps={FPS} {...H} />
    {/* «MassUp ahora hace más» · novedades */}
    <Composition id="NovedadesVertical" component={NovedadesVideo} durationInFrames={NOVEDADES_TOTAL} fps={FPS} {...V} />
    <Composition id="NovedadesHorizontal" component={NovedadesVideo} durationInFrames={NOVEDADES_TOTAL} fps={FPS} {...H} />
    {/* «Del GG a la plata» · reparto de loot */}
    <Composition id="LootVertical" component={LootVideo} durationInFrames={LOOT_TOTAL} fps={FPS} {...V} />
    <Composition id="LootHorizontal" component={LootVideo} durationInFrames={LOOT_TOTAL} fps={FPS} {...H} />
    {/* Video corto diario: scripts/daily.ts le pasa las propiedades de shorts/ideas.json */}
    <Composition id="Short" component={Short} durationInFrames={600} fps={FPS} {...V} defaultProps={SHORT_DEFAULT} calculateMetadata={calculateShortMetadata} />
    {/* Portada de cada video corto (imagen fija, misma plantilla para todos) */}
    <Composition id="Portada" component={Cover} durationInFrames={COVER_FRAME + 1} fps={FPS} {...V} defaultProps={COVER_DEFAULT} />
  </>
);
