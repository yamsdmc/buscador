/**
 * Intégration Sede Electrónica del Catastro (España).
 * API WCF JSON gratuite et ouverte — aucune clé requise.
 * Doc : https://www.catastro.hacienda.gob.es/ws/Webservices_Libres.pdf
 *
 * Deux usages :
 *   - lookupByRef(ref)        → adresse + coordonnées + bâti + contour parcelle (pixels)
 *   - searchNearby(lat, lng)  → coordonnées → parcelles les plus proches (triées par distance)
 * Aucune dépendance native : la photo satellite est un PNG proxifié par /api/satellite,
 * le contour de parcelle est projeté en pixels ici et dessiné en SVG côté client.
 */

import type { ParcelLocation, NearbyParcel, BuildingInfo, BuildingUnit } from "@/lib/types";
import { computeClimateZone } from "@/lib/climate-zone";
import { PROVINCE_TO_COMMUNITY } from "@/lib/spain-provinces";

const BASE = "https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCoordenadas.svc/json";
const DNPRC_URL = "https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/Consulta_DNPRC";
const BU_URL = "https://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx";
const WFS_URL = "https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx";
const ELEV_URL = "https://servicios.idee.es/wcs-inspire/mdt";
const TIMEOUT = 8000;

/** Dimensions de l'image satellite + rayon de la bbox (doivent matcher /api/satellite). */
const IMG_W = 600;
const IMG_H = 450;
const BBOX_DELTA = 0.001;

/** État du bâti (INSPIRE conditionOfConstruction) → libellé FR. */
const CONDITION_LABELS: Record<string, string> = {
  functional: "Fonctionnel",
  declined: "Dégradé",
  ruin: "En ruine",
  ruinous: "En ruine",
  demolished: "Démoli",
  projected: "En projet",
  underConstruction: "En construction",
};

/** Le Catastro renvoie un objet seul ou un tableau selon la cardinalité — on normalise. */
function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function num(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

/** Distance en mètres entre deux points (équirectangulaire — exact à l'échelle d'un quartier). */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const mPerDeg = 111320;
  const dLat = (lat2 - lat1) * mPerDeg;
  const dLng = (lng2 - lng1) * mPerDeg * Math.cos((lat1 * Math.PI) / 180);
  return Math.round(Math.sqrt(dLat * dLat + dLng * dLng));
}

function rcToString(rc: { pc1: string; pc2: string; car: string; cc1: string; cc2: string }): string {
  return `${rc.pc1}${rc.pc2}${rc.car}${rc.cc1}${rc.cc2}`;
}

/** "100,000000" → "100,00 %". */
function formatParticipation(cpt: string | undefined): string | undefined {
  const n = num(cpt?.replace(",", "."));
  if (n === undefined) return undefined;
  return `${n.toFixed(2).replace(".", ",")} %`;
}

/** Nombre de niveaux d'un bâtiment, dérivé des codes d'étage (planta) des unités. */
function countLevels(units: { floor?: string }[]): number | undefined {
  const floors = units
    .map((u) => (u.floor !== undefined ? Number(u.floor) : NaN))
    .filter((n) => Number.isFinite(n));
  if (floors.length === 0) return undefined;
  return Math.max(...floors) - Math.min(...floors) + 1;
}

interface CpmrcResponse {
  Consulta_CPMRCResult: {
    control: { cucoor?: number; cuerr?: number };
    coordenadas?: {
      coord: Array<{
        pc: { pc1: string; pc2: string };
        geo: { xcen: string; ycen: string; srs: string };
        ldt: string;
      }>;
    };
  };
}

interface DistanciaResponse {
  Consulta_RCCOOR_DistanciaResult: {
    control: { cucoor?: number; cuerr?: number };
    coordenadas_distancias?: {
      coordd: Array<{
        lpcd?: Array<{
          pc: { pc1: string; pc2: string };
          ldt: string;
          dis: string;
        }>;
      }>;
    };
  };
}

/** Localisation interne d'une unité (escalier/étage/porte). */
interface Loint {
  es?: string;
  pt?: string;
  pu?: string;
}

interface Debi {
  luso?: string;
  sfc?: string;
  ant?: string;
  /** Coefficient de participation, ex : "100,000000". */
  cpt?: string;
}

interface RcParts {
  pc1: string;
  pc2: string;
  car: string;
  cc1: string;
  cc2: string;
}

/** Sous-parcelle rústica (cultivo). */
interface Lspr {
  dspr?: {
    /** Dénomination du cultivo, ex : "PASTOS". */
    dcc?: string;
    /** Intensité productive. */
    ip?: string;
    /** Surface en m². */
    ssp?: string;
  };
}

interface RcdnpItem {
  rc?: { pc1: string; pc2: string; car: string; cc1: string; cc2: string };
  dt?: { locs?: { lous?: { lourb?: { loint?: Loint } } } };
  debi?: Debi;
}

interface DnprcResponse {
  consulta_dnprcResult: {
    control?: { cuerr?: number };
    /** Cas mono : une parcelle / une unité. */
    bico?: {
      bi?: {
        idbi?: { cn?: string; rc?: RcParts };
        dt?: { locs?: { lous?: { lourb?: { dp?: string } } } };
        debi?: Debi;
      };
      finca?: {
        ltp?: string;
        dff?: { ss?: string };
        infgraf?: { igraf?: string };
      };
      /** Sous-parcelles rústicas (cultivo). */
      lspr?: Lspr | Lspr[];
      lcons?:
        | Array<{
            lcd?: string;
            dt?: { lourb?: { loint?: Loint } };
            dfcons?: { stl?: string };
            dvcons?: { dtip?: string };
          }>
        | {
            lcd?: string;
            dt?: { lourb?: { loint?: Loint } };
            dfcons?: { stl?: string };
            dvcons?: { dtip?: string };
          };
    };
    /** Cas immeuble : liste d'unités (division horizontale). */
    lrcdnp?: {
      rcdnp?: RcdnpItem | RcdnpItem[];
    };
  };
}

export class CadastreService {
  /** Référence cadastrale (14 car. = parcelle) → adresse + coordonnées GPS. */
  static async lookupByRef(reference: string): Promise<ParcelLocation> {
    const clean = reference.trim().replace(/\s+/g, "").toUpperCase();
    const refcat = clean.substring(0, 14);
    if (refcat.length < 14) return { found: false, error: "NOT_FOUND" };

    // Appels indépendants des coordonnées, lancés en parallèle.
    const buildingPromise = this.fetchBuilding(clean);
    const inspirePromise = this.fetchBuildingInspire(refcat);
    const polygonPromise = this.fetchParcelPolygon(refcat);

    try {
      const params = new URLSearchParams({
        Provincia: "",
        Municipio: "",
        SRS: "EPSG:4326",
        RefCat: refcat,
      });
      const res = await fetch(`${BASE}/Consulta_CPMRC?${params}`, {
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (!res.ok) return { found: false, error: "NETWORK" };

      const data: CpmrcResponse = await res.json();
      const result = data.Consulta_CPMRCResult;
      if (result.control.cuerr) return { found: false, error: "NOT_FOUND" };

      const coord = result.coordenadas?.coord?.[0];
      if (!coord) return { found: false, error: "NOT_FOUND" };

      const provinceMatch = coord.ldt.match(/\(([^)]+)\)$/);
      const address = coord.ldt.replace(/\s*\([^)]+\)$/, "").trim();
      const province = provinceMatch?.[1]?.trim();
      const latitude = parseFloat(coord.geo.ycen);
      const longitude = parseFloat(coord.geo.xcen);

      // 2e appel : coordonnées UTM (ETRS89) selon le huso déduit de la longitude.
      const huso = longitude <= -6 ? 29 : 30;
      const [utm, altitude, building, inspire, polygon] = await Promise.all([
        this.fetchUtm(refcat, huso),
        this.fetchAltitude(latitude, longitude),
        buildingPromise,
        inspirePromise,
        polygonPromise,
      ]);

      // Fusion DNPRC + Buildings INSPIRE.
      const merged: BuildingInfo | undefined = building
        ? { ...building, ...inspire }
        : inspire
          ? { unitCount: 0, units: [], ...inspire }
          : undefined;

      return {
        found: true,
        refcat,
        latitude,
        longitude,
        address,
        province,
        autonomousCommunity: province
          ? PROVINCE_TO_COMMUNITY[province.toUpperCase()]
          : undefined,
        utmX: utm?.x,
        utmY: utm?.y,
        huso: String(huso),
        zoneLetter: "T",
        altitude,
        climateZone: computeClimateZone(province, altitude),
        polygonPixels: polygon ? this.projectPolygon(polygon, latitude, longitude) : undefined,
        building: merged,
      };
    } catch {
      return { found: false, error: "NETWORK" };
    }
  }

  /**
   * État du bâti via le WFS Buildings INSPIRE : condition, nb de logements.
   * (Le nb d'étages n'est pas exposé par ce service → dérivé des unités DNPRC.)
   */
  private static async fetchBuildingInspire(
    refcat: string,
  ): Promise<Partial<BuildingInfo> | null> {
    try {
      const params = new URLSearchParams({
        service: "wfs",
        version: "2.0.0",
        request: "getfeature",
        STOREDQUERIE_ID: "GetBuildingByParcel",
        refcat: refcat.substring(0, 14),
        srsname: "EPSG:4326",
      });
      const res = await fetch(`${BU_URL}?${params}`, {
        signal: AbortSignal.timeout(TIMEOUT),
        headers: { "User-Agent": "buscador-catastro/1.0" },
      });
      if (!res.ok) return null;

      const xml = await res.text();
      const condition = xml.match(/conditionOfConstruction>([^<]+)</)?.[1]?.trim();
      const dwellings = num(xml.match(/numberOfDwellings>([^<]+)</)?.[1]?.trim());

      const info: Partial<BuildingInfo> = {};
      if (condition) info.condition = CONDITION_LABELS[condition] ?? condition;
      if (dwellings !== undefined) info.dwellings = dwellings;
      return Object.keys(info).length > 0 ? info : null;
    } catch {
      return null;
    }
  }

  /** Altitude (m) via le MDT de l'IGN. Moyenne d'une grille 3×3 (ArcGrid). */
  private static async fetchAltitude(lat: number, lng: number): Promise<number | undefined> {
    try {
      const d = 0.0006;
      const params = new URLSearchParams({
        SERVICE: "WCS",
        VERSION: "1.0.0",
        REQUEST: "GetCoverage",
        COVERAGE: "Elevacion4258_5",
        CRS: "EPSG:4326",
        BBOX: `${lng - d},${lat - d},${lng + d},${lat + d}`,
        WIDTH: "3",
        HEIGHT: "3",
        FORMAT: "ArcGrid",
      });
      const res = await fetch(`${ELEV_URL}?${params}`, { signal: AbortSignal.timeout(TIMEOUT) });
      if (!res.ok) return undefined;

      const text = await res.text();
      // On ne garde que les lignes purement numériques (les en-têtes contiennent des mots).
      const values = text
        .split("\n")
        .filter((line) => line.trim() && !/[a-zA-Z]/.test(line))
        .flatMap((line) => line.trim().split(/\s+/).map(Number))
        .filter((n) => Number.isFinite(n) && n > -1000 && n < 9000);
      if (values.length === 0) return undefined;

      const avg = values.reduce((s, n) => s + n, 0) / values.length;
      return Math.round(avg);
    } catch {
      return undefined;
    }
  }

  /**
   * Polygone de la parcelle via le WFS INSPIRE (https) → tableau de [lat, lng].
   * Un retry sur échec transitoire.
   */
  private static async fetchParcelPolygon(refcat: string): Promise<[number, number][] | null> {
    const ref = refcat.trim().substring(0, 14);
    if (ref.length < 14) return null;

    const params = new URLSearchParams({
      service: "wfs",
      version: "2",
      request: "getfeature",
      StoredQuery_id: "GetParcel",
      refcat: ref,
      srsname: "EPSG:4326",
    });

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${WFS_URL}?${params}`, {
          signal: AbortSignal.timeout(TIMEOUT),
          headers: { "User-Agent": "buscador-catastro/1.0" },
        });
        if (!res.ok) continue;

        const xml = await res.text();
        const match = xml.match(/<gml:posList[^>]*>([^<]+)<\/gml:posList>/);
        if (!match) return null;

        const coords = match[1].trim().split(/\s+/).map(Number);
        const points: [number, number][] = [];
        for (let i = 0; i < coords.length - 1; i += 2) {
          points.push([coords[i], coords[i + 1]]);
        }
        return points.length > 2 ? points : null;
      } catch {
        // timeout/réseau → on retente une fois
      }
    }
    return null;
  }

  /**
   * Projette le polygone [lat, lng] en points pixel d'une image IMG_W×IMG_H,
   * centrée sur (lat, lng) avec un rayon BBOX_DELTA — identique au cadrage de
   * /api/satellite. Le client n'a plus qu'à dessiner un <polygon>.
   */
  private static projectPolygon(
    polygon: [number, number][],
    centerLat: number,
    centerLng: number,
  ): string {
    const minLng = centerLng - BBOX_DELTA;
    const maxLng = centerLng + BBOX_DELTA;
    const minLat = centerLat - BBOX_DELTA;
    const maxLat = centerLat + BBOX_DELTA;
    return polygon
      .map(([lat, lng]) => {
        const x = ((lng - minLng) / (maxLng - minLng)) * IMG_W;
        const y = ((maxLat - lat) / (maxLat - minLat)) * IMG_H;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  /**
   * Données du bâti via Consulta_DNPRC : usage, surfaces, année, liste des unités.
   * Gère les deux formes de réponse : parcelle mono (`bico`) ou immeuble en
   * division horizontale (`lrcdnp` → liste d'unités).
   */
  private static async fetchBuilding(refcat: string): Promise<BuildingInfo | null> {
    try {
      const params = new URLSearchParams({ Provincia: "", Municipio: "", RefCat: refcat });
      const res = await fetch(`${DNPRC_URL}?${params}`, { signal: AbortSignal.timeout(TIMEOUT) });
      if (!res.ok) return null;

      const data: DnprcResponse = await res.json();
      const result = data.consulta_dnprcResult;
      if (result.control?.cuerr) return null;

      // Cas mono : une seule parcelle/unité.
      if (result.bico) {
        const bi = result.bico.bi;
        const finca = result.bico.finca;
        const units: BuildingUnit[] = toArray(result.bico.lcons).map((c) => ({
          use: c.dvcons?.dtip ?? c.lcd,
          surface: num(c.dfcons?.stl),
          floor: c.dt?.lourb?.loint?.pt,
          door: c.dt?.lourb?.loint?.pu,
        }));
        const subparcels = toArray(result.bico.lspr).map((s) => ({
          crop: s.dspr?.dcc,
          surface: num(s.dspr?.ssp),
          intensity: s.dspr?.ip,
        }));
        return {
          type: bi?.idbi?.cn,
          use: bi?.debi?.luso,
          builtSurface: num(bi?.debi?.sfc),
          landSurface: num(finca?.dff?.ss),
          year: bi?.debi?.ant,
          fincaType: finca?.ltp,
          cartographyUrl: finca?.infgraf?.igraf,
          unitCount: units.length,
          units,
          fullRc: bi?.idbi?.rc ? rcToString(bi.idbi.rc) : undefined,
          postalCode: bi?.dt?.locs?.lous?.lourb?.dp,
          participation: formatParticipation(bi?.debi?.cpt),
          subparcels: subparcels.length > 0 ? subparcels : undefined,
          levels: countLevels(units),
        };
      }

      // Cas immeuble : liste d'inmuebles (division horizontale).
      if (result.lrcdnp) {
        const items = toArray(result.lrcdnp.rcdnp);
        const units: BuildingUnit[] = items.map((it) => {
          const loint = it.dt?.locs?.lous?.lourb?.loint;
          return {
            rc: it.rc ? `${it.rc.pc1}${it.rc.pc2}${it.rc.car}${it.rc.cc1}${it.rc.cc2}` : undefined,
            use: it.debi?.luso,
            surface: num(it.debi?.sfc),
            floor: loint?.pt,
            door: loint?.pu,
          };
        });
        const builtSurface = units.reduce((sum, u) => sum + (u.surface ?? 0), 0);
        return {
          type: "UR",
          builtSurface: builtSurface || undefined,
          unitCount: units.length,
          units,
          levels: countLevels(units),
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  /** Coordonnées UTM (ETRS89, EPSG:258{huso}) du centroïde de la parcelle. */
  private static async fetchUtm(
    refcat: string,
    huso: number,
  ): Promise<{ x: string; y: string } | null> {
    try {
      const params = new URLSearchParams({
        Provincia: "",
        Municipio: "",
        SRS: `EPSG:258${huso}`,
        RefCat: refcat,
      });
      const res = await fetch(`${BASE}/Consulta_CPMRC?${params}`, {
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (!res.ok) return null;

      const data: CpmrcResponse = await res.json();
      const coord = data.Consulta_CPMRCResult.coordenadas?.coord?.[0];
      if (!coord) return null;
      return { x: coord.geo.xcen, y: coord.geo.ycen };
    } catch {
      return null;
    }
  }

  /** Coordonnées GPS → parcelles cadastrales proches, triées par distance croissante. */
  static async searchNearby(
    lat: number,
    lng: number,
    limit = 10,
  ): Promise<NearbyParcel[]> {
    try {
      const params = new URLSearchParams({
        SRS: "EPSG:4326",
        CoorX: String(lng),
        CoorY: String(lat),
      });
      const res = await fetch(`${BASE}/Consulta_RCCOOR_Distancia?${params}`, {
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (!res.ok) return [];

      const data: DistanciaResponse = await res.json();
      const list = data.Consulta_RCCOOR_DistanciaResult.coordenadas_distancias?.coordd?.[0]?.lpcd;
      if (!list) return [];

      return list
        .map((item) => ({
          refcat: `${item.pc.pc1}${item.pc.pc2}`,
          address: item.ldt.replace(/\s*\([^)]+\)$/, "").trim(),
          distance: parseFloat(item.dis),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  /**
   * Les `count` parcelles les plus proches d'un point (centroïde d'une RC),
   * via le WFS INSPIRE en BBOX : distance exacte au point représentatif de
   * chaque parcelle, nombre garanti (la BBOX s'élargit si nécessaire).
   * Contrairement à `searchNearby` (rayon OVC fixe ~25-50 m), renvoie bien N.
   */
  static async findNearestParcels(
    lat: number,
    lng: number,
    count = 20,
    excludeRef?: string,
  ): Promise<NearbyParcel[]> {
    const exclude = excludeRef?.trim().substring(0, 14).toUpperCase();
    // BBOX croissante jusqu'à avoir assez de parcelles (zones rurales = clairsemées).
    for (const delta of [0.0008, 0.002, 0.005, 0.012]) {
      const bbox = `${lat - delta},${lng - delta},${lat + delta},${lng + delta}`;
      const params = new URLSearchParams({
        service: "wfs",
        version: "2.0.0",
        request: "getfeature",
        typeNames: "cp:CadastralParcel",
        srsName: "EPSG:4326",
        bbox: `${bbox},EPSG:4326`,
      });

      let xml: string;
      try {
        const res = await fetch(`${WFS_URL}?${params}`, {
          signal: AbortSignal.timeout(TIMEOUT),
          headers: { "User-Agent": "buscador-catastro/1.0" },
        });
        if (!res.ok) continue;
        xml = await res.text();
      } catch {
        continue;
      }

      const parcels: NearbyParcel[] = [];
      // Une feature par bloc <cp:CadastralParcel> … </cp:CadastralParcel>.
      for (const block of xml.split("<cp:CadastralParcel").slice(1)) {
        const ref = block.match(/<cp:nationalCadastralReference>([^<]+)/)?.[1]?.trim();
        const pos = block.match(/<cp:referencePoint>[\s\S]*?<gml:pos>([^<]+)<\/gml:pos>/)?.[1];
        if (!ref || !pos) continue;
        if (exclude && ref.toUpperCase() === exclude) continue;
        const [pLat, pLng] = pos.trim().split(/\s+/).map(Number);
        if (Number.isNaN(pLat) || Number.isNaN(pLng)) continue;
        parcels.push({
          refcat: ref,
          area: num(block.match(/<cp:areaValue[^>]*>([^<]+)/)?.[1]),
          distance: haversine(lat, lng, pLat, pLng),
        });
      }

      // Assez de candidats (ou dernière BBOX) → on trie et on coupe.
      if (parcels.length >= count || delta === 0.012) {
        return parcels.sort((a, b) => a.distance - b.distance).slice(0, count);
      }
    }
    return [];
  }
}
