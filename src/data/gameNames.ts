import { ContentTypeConfig } from '../types/ping';

/**
 * Corrige nombres de la comunidad / mal escritos a los nombres OFICIALES del juego en español
 * (cliente ES-ES de Albion Online). Se aplica una sola vez a las plantillas guardadas de cada
 * servidor (ver GuildConfig.namesVersion).
 *
 * Solo se incluyen equivalencias verificadas en los datos del juego (ao-bin-dumps).
 * Las reglas son idempotentes: aplicarlas dos veces da el mismo resultado, así que subir
 * NAMES_VERSION vuelve a pasarlas sin estropear plantillas ya corregidas.
 *
 * v2: Garra, Susurrante, Silencio y Golem identificados; Piro, Guardián, Áurico e Invocador
 *     (sin "oscuro") eliminados de las listas de armas.
 */
export const NAMES_VERSION = 2;

/** Quita un arma de una lista "(A / B / C)", esté al principio, en medio o al final. */
function removeWeapon(pattern: string): Array<[RegExp, string]> {
  return [
    [new RegExp(`\\s*/\\s*${pattern}(?![\\p{L}])`, 'gu'), ''],
    [new RegExp(`(?<=\\()\\s*${pattern}(?![\\p{L}])\\s*/\\s*`, 'gu'), ''],
  ];
}

const FIXES: Array<[RegExp, string]> = [
  // Confirmados por el dueño del servidor (v2)
  [/\bSilencio\b/g, 'Bastón arcano'],
  [/\bGolem\b/g, 'Bastón terrúnico'],
  [/\bGarra\b(?! ?[Pp]resta)/g, 'Garras'],
  [/(?<!Arco )\bSusurrante\b/g, 'Arco susurrante'],
  ...removeWeapon('Piro'),
  ...removeWeapon('Guardián'),
  ...removeWeapon('Áurico'),
  ...removeWeapon('Invocador(?! oscuro| de luz)'),

  // Roles
  [/\bMain Tank\b/g, 'Tanque principal'],
  [/\bOff-Tank\b/g, 'Tanque secundario'],
  [/\bTank Engage \/ Defensivo\b/g, 'Tanque'],
  [/\bMain Healer\b/g, 'Sanador principal'],
  [/\bParty Healer\b/g, 'Sanador de grupo'],
  [/\bHealer ZvZ\b/g, 'Sanador'],
  [/\bHealer\b/g, 'Sanador'],
  [/\bSupport \/ Pierce\b/g, 'Soporte'],
  [/\bPurga \/ Support\b/g, 'Soporte de purga'],
  [/\bSupport\b/g, 'Soporte'],
  [/\bCatch \/ Tank\b/g, 'Tanque de atrape'],
  [/\bCatch\b/g, 'Atrape'],
  [/\bOne-Shot \/ DPS\b/g, 'Daño explosivo'],
  [/\bMelee Clap\b/g, 'Daño cuerpo a cuerpo'],
  [/\bRanged Bomb\b/g, 'Daño a distancia'],
  [/\bDPS AoE\b/g, 'Daño en área'],
  [/\bDPS PvE\b/g, 'Daño'],
  [/\bDPS\b/g, 'Daño'],
  [/\bScout \/ Looter\b/g, 'Explorador'],
  [/\bScout\b/g, 'Explorador'],
  [/\bTank\b/g, 'Tanque'],
  // Armas (EN / jerga -> ES oficial)
  [/\bMaza Pesada\b/g, 'Maza pesada'],
  [/\bIncubus\b/g, 'Maza íncubo'],
  [/\bPatas de Oso\b/g, 'Patas de oso'],
  [/(?<!Bastón de )\bDoble Filo\b/g, 'Bastón de doble filo'],
  [/\bCasco Demonio\b/g, 'Casco de demonio'],
  [/\bHábito Mago\b/g, 'Hábito de mago'],
  [/\bDagas\b/g, 'Daga doble'],
  [/(?<!Bastón |Gran bastón )\bSagrado\b/g, 'Bastón sagrado'],
  [/(?<!Bastón )\bDivino\b/g, 'Bastón divino'],
  [/(?<!Bastón )\bCaído\b/g, 'Bastón caído'],
  [/(?<!Bastón )\bArcano\b/g, 'Bastón arcano'],
  [/(?<!Bastón )\bDruídico\b/g, 'Bastón druida'],
  [/(?<!Bastón )\bDruida\b/g, 'Bastón druida'],
  [/\bNaturaleza\b/g, 'Bastón natural'],
  [/\bBlight\b/g, 'Bastón de infortunio'],
  [/\bPlaga\b/g, 'Bastón de infortunio'],
  [/\bCortasombras\b/g, 'Invocador oscuro'],
  [/\bShadowcaller\b/g, 'Invocador oscuro'],
  [/\bTallada\b/g, 'Espada tallada'],
  [/(?<!Bastón )\bRedención\b/g, 'Bastón de redención'],
  [/\bLocus\b(?! malévolo)/g, 'Locus malévolo'],
  [/(?<!Bastón )\bEnigmático\b/g, 'Bastón enigmático'],
  [/\bJuramentados\b/g, 'Juradores'],
  [/(?<!Bastón )\bRaíz\b/g, 'Bastón enraizado'],
  [/\bCanción de Alba\b/g, 'Canción del despertar'],
  [/\bPerma\b/g, 'Prisma de hielos perpetuos'],
  [/(?<!Bastón )\bFlamígero\b/g, 'Bastón flamígero'],
  [/(?<!Bastón )\bFuego\b/g, 'Bastón ígneo'],
  [/(?<!Bastón de )\bHielo\b/g, 'Bastón de hielo'],
  [/\bSegadora\b/g, 'Guadaña infernal'],
  [/\bGuantes\b/g, 'Brazales de batalla'],
  // Monturas y consumibles
  [/\bGarra Presta\b/g, 'Garrapresta'],
  [/\bSwiftclaw\b/g, 'Garrapresta'],
  [/\bDirewolf\b/g, 'Huargo'],
  [/\bCaballo Blindado\b/g, 'Caballo blindado'],
  [/\bVenenos\b/g, 'Pociones de veneno'],
  [/\bOC\b/g, 'sobrecarga'],
  // Zonas y actividades
  [/\bGankeo Zona Negra\b/g, 'Gankeo en Tierras Lejanas'],
  [/\bGankeo Ava\b/g, 'Gankeo en Caminos de Avalon'],
  [/^Cofres Dorados$/g, 'Cofres dorados (legendarios)'],
  [/^Cofres Azules$/g, 'Cofres azules (poco comunes)'],
  [/\bMontura Rápida(?![\p{L}])/gu, 'Montura rápida'],
  [/\bZona Negra\b/g, 'Tierras Lejanas'],
  [/\bCiudad Real\b/g, 'Ciudad real'],
  [/\bCaminos Avalonianos\b/g, 'Caminos de Avalon'],
  [/\bGuerra de Facciones\b/g, 'Guerra de facciones'],
  [/\bMazmorra Grupal\b/g, 'Mazmorra grupal'],
  [/\bMazmorra Avaloniana\b/g, 'Mazmorra avaloniana'],
];

function fix(text: string): string {
  return FIXES.reduce((acc, [re, to]) => acc.replace(re, to), text).replace(/\s+\//g, ' /').replace(/\/(?=\S)/g, '/ ').replace(/\/\s+/g, '/ ');
}

/** Devuelve las plantillas con los nombres oficiales del juego. */
export function applyGameNames(contentTypes: ContentTypeConfig[]): ContentTypeConfig[] {
  return contentTypes.map((c) => ({
    ...c,
    name: fix(c.name),
    defaultGearTier: fix(c.defaultGearTier),
    defaultMount: fix(c.defaultMount),
    defaultZone: fix(c.defaultZone),
    roles: c.roles.map((r) => ({ ...r, label: fix(r.label) })),
  }));
}
