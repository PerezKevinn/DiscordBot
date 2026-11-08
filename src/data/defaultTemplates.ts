import { ContentTypeConfig } from '../types/ping';

/**
 * Plantillas de contenido que recibe cada servidor nuevo.
 *
 * Los nombres de armas, monturas, consumibles, zonas y actividades son los OFICIALES del
 * cliente de Albion Online en español (ES-ES), sacados de los datos del juego
 * (ao-data/ao-bin-dumps: items.json y localization.json). Ej.: Swiftclaw = Garrapresta,
 * Blight Staff = Bastón de infortunio, Shadowcaller = Invocador oscuro, Outlands = Tierras Lejanas.
 *
 * Los roles usan los nombres del juego (Tanque, Sanador, Soporte, Daño). Solo se mantienen
 * términos de la comunidad sin equivalente oficial (Atrape, Purga, Explorador) y siglas
 * universales (ZvZ, CTA, HO).
 */
export const DEFAULT_CONTENT_TYPES: ContentTypeConfig[] = [
  {
    id: 'gankeo',
    name: 'Gankeo en Tierras Lejanas',
    emoji: '🐺',
    subtitle: 'ZONA NEGRA • CAZA DE JUGADORES Y TRANSPORTES',
    accentColor: '#E63946',
    defaultGearTier: 'Equivalente T7 / T8',
    defaultMount: 'Huargo o Garrapresta + Pociones de veneno',
    defaultZone: 'Portal de la ciudad / Escondite (HO)',
    roles: [
      { id: 'catch', label: 'Atrape (Patas de oso / Bastón de doble filo)', emoji: '⛓️', maxSlots: 3, description: 'Desmontar y controlar al objetivo' },
      { id: 'purge', label: 'Purga (Casco de demonio / Hábito de mago)', emoji: '🔮', maxSlots: 2, description: 'Quitar defensivos al objetivo' },
      { id: 'dps_burst', label: 'Daño explosivo (Sangradora / Daga doble)', emoji: '🗡️', maxSlots: 5, description: 'Rematar al desmontado' },
      { id: 'healer_gank', label: 'Sanador (Bastón sagrado / Bastón natural)', emoji: '🌿', maxSlots: 2, description: 'Curar si sale pelea' },
      { id: 'scout', label: 'Explorador', emoji: '👁️', maxSlots: 2, description: 'Vigilar entradas y recoger el botín' },
    ],
  },
  {
    id: 'gank_ava',
    name: 'Gankeo en Caminos de Avalon',
    emoji: '🌀',
    subtitle: 'CAZA EN LOS CAMINOS DE AVALON',
    accentColor: '#9D4EDD',
    defaultGearTier: 'Equivalente T7 / T8',
    defaultMount: 'Garrapresta o Huargo + Pociones de veneno',
    defaultZone: 'Brecilien / Portal de Caminos',
    roles: [
      { id: 'catch_ava', label: 'Tanque de atrape (Maza pesada / Patas de oso)', emoji: '⛓️', maxSlots: 2, description: 'Frenar y desmontar' },
      { id: 'healer_ava_gank', label: 'Sanador (Bastón sagrado / Bastón de infortunio)', emoji: '✨', maxSlots: 1, description: 'Mantener viva la party' },
      { id: 'purge_ava', label: 'Soporte de purga (Casco de demonio / Invocador oscuro)', emoji: '🔮', maxSlots: 1, description: 'Quitar defensivos y bajar resistencias' },
      { id: 'dps_ava_gank', label: 'Daño (Sangradora / Brazales de batalla / Hacha de guerra)', emoji: '🗡️', maxSlots: 3, description: 'Daño explosivo' },
    ],
  },
  {
    id: 'grupal',
    name: 'Mazmorra grupal',
    emoji: '🗝️',
    subtitle: 'FAMA EN MAZMORRAS GRUPALES Y ESTÁTICAS',
    accentColor: '#2A9D8F',
    defaultGearTier: 'Equivalente T7 + equipo de cambio PvP',
    defaultMount: 'Garrapresta o Caballo T6+',
    defaultZone: 'Brecilien / Ciudad real / Portal',
    roles: [
      { id: 'tank_pve', label: 'Tanque (Maza íncubo / Maza)', emoji: '🛡️', maxSlots: 1, description: 'Juntar enemigos para el daño en área' },
      { id: 'healer_pve', label: 'Sanador (Bastón sagrado / Bastón natural)', emoji: '💚', maxSlots: 1, description: 'Mantener viva la party' },
      { id: 'support_pve', label: 'Soporte (Invocador oscuro / Bastón druida)', emoji: '⚡', maxSlots: 1, description: 'Bajar resistencias y apoyar' },
      { id: 'dps_aoe', label: 'Daño en área (Prisma de hielos perpetuos / Bastón flamígero / Ballesta)', emoji: '💥', maxSlots: 5, description: 'Limpiar grupos de enemigos' },
    ],
  },
  {
    id: 'azules',
    name: 'Cofres azules (poco comunes)',
    emoji: '🔷',
    subtitle: 'COFRES POCO COMUNES • FARMEAR Y DEFENDER',
    accentColor: '#3A86FF',
    defaultGearTier: 'Equivalente T7 / T8',
    defaultMount: 'Garrapresta + Comida y pociones',
    defaultZone: 'Tierras Lejanas / Caminos de Avalon',
    roles: [
      { id: 'tank_blue', label: 'Tanque (Maza / Maza íncubo)', emoji: '🛡️', maxSlots: 1, description: 'Juntar enemigos e iniciar pelea' },
      { id: 'healer_blue', label: 'Sanador (Bastón sagrado / Bastón de infortunio)', emoji: '💚', maxSlots: 1, description: 'Curar a la party' },
      { id: 'support_blue', label: 'Soporte (Invocador oscuro)', emoji: '🔮', maxSlots: 1, description: 'Bajar resistencias' },
      { id: 'dps_blue', label: 'Daño (Bastón ígneo / Bastón de hielo / Guadaña infernal)', emoji: '🔥', maxSlots: 3, description: 'Limpiar el cofre rápido' },
    ],
  },
  {
    id: 'dorados',
    name: 'Cofres dorados (legendarios)',
    emoji: '🏆',
    subtitle: 'COFRES LEGENDARIOS • FARMEAR Y DEFENDER',
    accentColor: '#F4A261',
    defaultGearTier: 'Equivalente T8 + sobrecarga',
    defaultMount: 'Garrapresta + Guiso T8',
    defaultZone: 'Brecilien / Tierras Lejanas',
    roles: [
      { id: 'tank_gold', label: 'Tanque principal (Maza íncubo / Maza pesada)', emoji: '🛡️', maxSlots: 1, description: 'Juntar enemigos e iniciar pelea' },
      { id: 'healer_gold', label: 'Sanador (Bastón sagrado / Santificador / Bastón de infortunio)', emoji: '💚', maxSlots: 2, description: 'Curar a la party' },
      { id: 'support_gold', label: 'Soporte (Invocador oscuro / Espada tallada)', emoji: '🔮', maxSlots: 1, description: 'Bajar resistencias' },
      { id: 'dps_gold', label: 'Daño (Bastón ígneo / Bastón de hielo / Alabarda / Ballesta)', emoji: '🔥', maxSlots: 3, description: 'Limpiar el cofre rápido' },
    ],
  },
  {
    id: 'ava_dungeon',
    name: 'Mazmorra avaloniana',
    emoji: '🏛️',
    subtitle: 'FAMA, COFRES DORADOS Y BENEFICIO AVALONIANO',
    accentColor: '#00B4D8',
    defaultGearTier: 'T8.1 / T8.2 PvE',
    defaultMount: 'Montura rápida + Comida y pociones',
    defaultZone: 'Portal en Tierras Lejanas / Escondite (HO)',
    roles: [
      { id: 'main_tank', label: 'Tanque principal (Maza íncubo / Martillo)', emoji: '🛡️', maxSlots: 1, description: 'Llevar enemigos y jefes' },
      { id: 'off_tank', label: 'Tanque secundario (Martillo largo / Guardabosques)', emoji: '⚔️', maxSlots: 1, description: 'Interrumpir y aturdir' },
      { id: 'main_healer', label: 'Sanador principal (Bastón sagrado / Bastón divino)', emoji: '✨', maxSlots: 1, description: 'Curar al tanque principal' },
      { id: 'party_healer', label: 'Sanador de grupo (Bastón de infortunio / Bastón druida / Bastón caído)', emoji: '🍃', maxSlots: 2, description: 'Curar a la party' },
      { id: 'support_ava', label: 'Soporte (Bastón arcano / Invocador oscuro)', emoji: '🔮', maxSlots: 3, description: 'Resistencias y escudos' },
      { id: 'dps_ava', label: 'Daño (Ballesta / Bastón de hielo / Bastón ígneo)', emoji: '🔥', maxSlots: 12, description: 'Daño a enemigos y jefes' },
    ],
  },
  {
    id: 'faccion',
    name: 'Guerra de facciones',
    emoji: '🚩',
    subtitle: 'BANDERAS, PUESTOS Y PELEAS DE FACCIÓN',
    accentColor: '#E9C46A',
    defaultGearTier: 'Equivalente T6 / T7 (equipo barato)',
    defaultMount: 'Caballo blindado / Montura de facción',
    defaultZone: 'Ciudad real',
    roles: [
      { id: 'fac_tank', label: 'Tanque (Maza / Martillo)', emoji: '🛡️', maxSlots: 3, description: 'Primera línea e inicio' },
      { id: 'fac_healer', label: 'Sanador (Bastón sagrado / Bastón natural)', emoji: '💚', maxSlots: 3, description: 'Levantar al grupo' },
      { id: 'fac_support', label: 'Soporte (Bastón arcano / Juradores)', emoji: '🔮', maxSlots: 2, description: 'Defensivos y limpieza' },
      { id: 'fac_dps', label: 'Daño', emoji: '🗡️', maxSlots: 0, description: 'Cualquier arma de daño' },
    ],
  },
  {
    id: 'zvz',
    name: 'ZvZ / CTA',
    emoji: '⚔️',
    subtitle: 'LLAMADA A LAS ARMAS • PELEAS DE ZERG',
    accentColor: '#D4AF37',
    defaultGearTier: 'Equivalente T8 (equipo de ZvZ) + sobrecarga',
    defaultMount: 'Caballo blindado / Garrapresta',
    defaultZone: 'Escondite (HO) / Ciudad real',
    roles: [
      { id: 'zvz_tank', label: 'Tanque (Maza / Martillo / Martillo de la tumba)', emoji: '🛡️', maxSlots: 3, description: 'Primera línea e inicio' },
      { id: 'zvz_healer', label: 'Sanador (Bastón caído / Bastón de infortunio / Bastón de redención)', emoji: '💚', maxSlots: 4, description: 'Levantar a la zerg' },
      { id: 'zvz_support', label: 'Soporte (Locus malévolo / Bastón enigmático / Juradores)', emoji: '🔮', maxSlots: 3, description: 'Limpieza y escudos' },
      { id: 'zvz_melee', label: 'Daño cuerpo a cuerpo (Romperreinos / Brazales de batalla / Guadaña infernal)', emoji: '🗡️', maxSlots: 5, description: 'Entrar con el Caller' },
      { id: 'zvz_ranged', label: 'Daño a distancia (Prisma de hielos perpetuos / Canción del despertar)', emoji: '🔥', maxSlots: 5, description: 'Atacar la retaguardia enemiga' },
    ],
  },
  {
    id: 'hellgate',
    name: 'Hellgate 5v5',
    emoji: '🔥',
    subtitle: 'HELLGATES',
    accentColor: '#FF5400',
    defaultGearTier: 'Equipo acordado (consultar al Caller)',
    defaultMount: 'Montura rápida',
    defaultZone: 'Tierras Lejanas',
    roles: [
      { id: 'hg_tank', label: 'Tanque', emoji: '🛡️', maxSlots: 1, description: 'Inicia la pelea' },
      { id: 'hg_healer', label: 'Sanador', emoji: '💚', maxSlots: 1, description: 'Mantener vivo al equipo' },
      { id: 'hg_support', label: 'Soporte', emoji: '🔮', maxSlots: 1, description: 'Purgas y utilidades' },
      { id: 'hg_dps', label: 'Daño', emoji: '🗡️', maxSlots: 2, description: 'Daño' },
    ],
  },
  {
    id: 'rastreo',
    name: 'Rastreo',
    emoji: '🐾',
    subtitle: 'CAZA DE CRIATURAS POR RASTRO',
    accentColor: '#8AC926',
    defaultGearTier: 'Equivalente T7',
    defaultMount: 'Garrapresta',
    defaultZone: 'Tierras Lejanas',
    roles: [
      { id: 'tr_tracker', label: 'Rastreador (Kit de rastreo)', emoji: '🔍', maxSlots: 1, description: 'Sigue las huellas' },
      { id: 'tr_tank', label: 'Tanque', emoji: '🛡️', maxSlots: 1, description: 'Aguanta a la criatura' },
      { id: 'tr_healer', label: 'Sanador', emoji: '💚', maxSlots: 1, description: 'Curar' },
      { id: 'tr_dps', label: 'Daño', emoji: '🗡️', maxSlots: 3, description: 'Daño' },
    ],
  },
  {
    id: 'escolta',
    name: 'Recolección con escolta',
    emoji: '⛏️',
    subtitle: 'RECOLECCIÓN EN TIERRAS LEJANAS',
    accentColor: '#6A994E',
    defaultGearTier: 'Equipo de recolección + escoltas T7',
    defaultMount: 'Buey de transporte / Mamut domado + Garrapresta',
    defaultZone: 'Escondite (HO) / Tierras Lejanas',
    roles: [
      { id: 'esc_gatherer', label: 'Recolector', emoji: '⛏️', maxSlots: 0, description: 'Recolectar recursos' },
      { id: 'esc_guard', label: 'Escolta', emoji: '🛡️', maxSlots: 0, description: 'Proteger a los recolectores' },
      { id: 'esc_scout', label: 'Explorador', emoji: '👁️', maxSlots: 2, description: 'Vigilar entradas' },
    ],
  },
];

export function cloneDefaultContentTypes(): ContentTypeConfig[] {
  return JSON.parse(JSON.stringify(DEFAULT_CONTENT_TYPES));
}
