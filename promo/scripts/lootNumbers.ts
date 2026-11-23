// Calcula con la lógica real del bot (src/utils/loot.ts) los números del video «Del GG a la plata».
import { computeSplit, formatSilver } from '../../src/utils/loot';
const split = { total: 12_500_000, repairs: 400_000, guildTaxPct: 10, sellerPct: 5, roundTo: 1_000 } as never;
console.log(JSON.stringify(computeSplit(split, 7), null, 1));
console.log(formatSilver(12_500_000));
