/**
 * Zone climatique CTE DB-HE (Apéndice B, Tabla B.1 — Península Ibérica).
 * Déterminée par la capitale de province + l'altitude (h, en mètres).
 *
 * Table extraite et validée depuis le PDF officiel DB-HE : pour chaque province,
 * l'altitude de la capitale retombe exactement sur sa zone climatique officielle.
 *
 * La LETTRE (C / D / E) est ce qui pilote le calcul CAE (VAUZ) — elle est fiable.
 * Le NUMÉRO (sévérité d'été) est orientatif. Canarias n'est pas couvert (zones α).
 */

type Breakpoint = [zone: string, maxAltitudeExclusive: number | null];

/** Province (sans accents, majuscules) → bandes d'altitude croissantes. */
const CLIMATE_ZONE_TABLE: Record<string, Breakpoint[]> = {
  "A CORUNA": [["C1", 200], ["D1", null]],
  "LA CORUNA": [["C1", 200], ["D1", null]],
  CORUNA: [["C1", 200], ["D1", null]],
  ALAVA: [["D1", 500], ["E1", null]],
  ARABA: [["D1", 500], ["E1", null]],
  ALBACETE: [["C4", 450], ["D3", 950], ["E1", null]],
  ALICANTE: [["B4", 250], ["C4", 700], ["D3", null]],
  ALMERIA: [["A4", 100], ["B4", 250], ["B3", 400], ["C4", 800], ["C1", null]],
  ASTURIAS: [["C1", 50], ["D1", 550], ["E1", null]],
  AVILA: [["D2", 550], ["D1", 850], ["E1", null]],
  BADAJOZ: [["C4", 400], ["C3", 450], ["D3", null]],
  BALEARES: [["B3", 250], ["C3", null]],
  "ILLES BALEARS": [["B3", 250], ["C3", null]],
  BARCELONA: [["C2", 250], ["D2", 450], ["D1", 750], ["E1", null]],
  BIZKAIA: [["C1", 250], ["D1", null]],
  VIZCAYA: [["C1", 250], ["D1", null]],
  BURGOS: [["D1", 600], ["E1", null]],
  CACERES: [["C4", 600], ["D3", 1050], ["E1", null]],
  CADIZ: [["A3", 150], ["B3", 450], ["C4", 600], ["C2", 850], ["D2", null]],
  CANTABRIA: [["C1", 150], ["D1", 650], ["E1", null]],
  CASTELLON: [["B3", 50], ["C4", 500], ["D3", 600], ["D2", 1000], ["E1", null]],
  CEUTA: [["B3", null]],
  "CIUDAD REAL": [["C4", 450], ["C3", 500], ["D3", null]],
  CORDOBA: [["B4", 150], ["C4", 550], ["D3", null]],
  CUENCA: [["D3", 800], ["D2", 1050], ["E1", null]],
  GERONA: [["C3", 100], ["D2", 600], ["E1", null]],
  GIRONA: [["C3", 100], ["D2", 600], ["E1", null]],
  GIPUZKOA: [["D1", 400], ["E1", null]],
  GUIPUZCOA: [["D1", 400], ["E1", null]],
  GRANADA: [["A4", 50], ["B4", 350], ["C4", 600], ["C3", 800], ["D3", 1300], ["E1", null]],
  GUADALAJARA: [["D3", 950], ["D2", 1000], ["E1", null]],
  HUELVA: [["A4", 100], ["B3", 350], ["C3", 800], ["D3", null]],
  HUESCA: [["C3", 200], ["D3", 400], ["D2", 700], ["E1", null]],
  JAEN: [["B4", 350], ["C4", 750], ["D3", 1250], ["E1", null]],
  "LA RIOJA": [["C3", 200], ["D2", 700], ["E1", null]],
  LEON: [["E1", null]],
  LERIDA: [["C4", 100], ["D3", 600], ["E1", null]],
  LLEIDA: [["C4", 100], ["D3", 600], ["E1", null]],
  LUGO: [["D1", 500], ["E1", null]],
  MADRID: [["C4", 500], ["D3", 950], ["D2", 1000], ["E1", null]],
  MALAGA: [["A3", 300], ["C4", 700], ["D3", null]],
  MELILLA: [["A3", null]],
  MURCIA: [["B3", 100], ["C4", 550], ["D3", null]],
  NAVARRA: [["C3", 100], ["D2", 300], ["D1", 600], ["E1", null]],
  ORENSE: [["C4", 150], ["C3", 300], ["D2", 800], ["E1", null]],
  OURENSE: [["C4", 150], ["C3", 300], ["D2", 800], ["E1", null]],
  PALENCIA: [["D1", 800], ["E1", null]],
  PONTEVEDRA: [["C1", 350], ["D1", null]],
  SALAMANCA: [["D2", 800], ["E1", null]],
  SEGOVIA: [["D2", 1050], ["E1", null]],
  SEVILLA: [["B4", 200], ["C4", null]],
  SORIA: [["D2", 750], ["D1", 800], ["E1", null]],
  TARRAGONA: [["B3", 50], ["C4", 500], ["D3", null]],
  TERUEL: [["C4", 450], ["C3", 500], ["D2", 1000], ["E1", null]],
  TOLEDO: [["C4", 500], ["D3", null]],
  VALENCIA: [["B3", 50], ["C4", 500], ["D2", 950], ["E1", null]],
  VALLADOLID: [["D2", 800], ["E1", null]],
  ZAMORA: [["D2", 800], ["E1", null]],
  ZARAGOZA: [["C4", 200], ["D3", 650], ["E1", null]],
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
}

/**
 * Zone climatique CTE (ex : "D2") depuis la province et l'altitude.
 * undefined si la province est inconnue (ex : Canarias) ou l'altitude absente.
 */
export function computeClimateZone(
  province: string | undefined,
  altitude: number | undefined,
): string | undefined {
  if (!province || altitude === undefined) return undefined;
  const bands = CLIMATE_ZONE_TABLE[normalize(province)];
  if (!bands) return undefined;
  for (const [zone, maxAlt] of bands) {
    if (maxAlt === null || altitude < maxAlt) return zone;
  }
  return bands[bands.length - 1][0];
}
