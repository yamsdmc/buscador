/**
 * Génération de l'image satellite : orthophoto PNOA (IGN) + contour de la parcelle (WFS).
 * Module ISOLÉ : seul endroit qui importe `sharp` (binaire natif) — import statique
 * pour que Next l'embarque correctement dans la fonction serverless. Les routes de
 * données (RC/adresse/carte) n'importent jamais ce fichier, donc jamais sharp.
 */

import sharp from "sharp";

const PNOA_URL = "https://www.ign.es/wms-inspire/pnoa-ma";
const WFS_URL = "https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx";
const TIMEOUT = 8000;

/**
 * Orthophoto PNOA centrée sur le point, avec le contour rouge de la parcelle si
 * une référence est fournie. `overlay` indique si le tracé a pu être dessiné
 * (décide du cache : on ne met en cache long que les images complètes).
 */
export async function getSatelliteImage(
  lat: number,
  lng: number,
  refcat?: string,
): Promise<{ image: Buffer; overlay: boolean } | null> {
  const WIDTH = 600;
  const HEIGHT = 450;
  const delta = 0.001;
  const minLng = lng - delta;
  const minLat = lat - delta;
  const maxLng = lng + delta;
  const maxLat = lat + delta;

  try {
    const [satellite, polygon] = await Promise.all([
      fetchWmsImage(PNOA_URL, {
        LAYERS: "OI.OrthoimageCoverage",
        SRS: "EPSG:4326",
        BBOX: `${minLng},${minLat},${maxLng},${maxLat}`,
        WIDTH: String(WIDTH),
        HEIGHT: String(HEIGHT),
        FORMAT: "image/png",
      }),
      refcat ? fetchParcelPolygon(refcat) : Promise.resolve(null),
    ]);

    if (!satellite) return null;

    if (polygon && polygon.length > 0) {
      const overlay = buildParcelOverlay(WIDTH, HEIGHT, polygon, minLat, minLng, maxLat, maxLng);
      const image = await sharp(satellite)
        .composite([{ input: overlay, blend: "over" }])
        .jpeg({ quality: 80 })
        .toBuffer();
      return { image, overlay: true };
    }

    const image = await sharp(satellite).jpeg({ quality: 80 }).toBuffer();
    return { image, overlay: !refcat };
  } catch {
    return null;
  }
}

/** Polygone de la parcelle via le WFS INSPIRE → tableau de [lat, lng]. Un retry. */
async function fetchParcelPolygon(refcat: string): Promise<[number, number][] | null> {
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

/** SVG contour rouge de la parcelle, en coordonnées pixel de l'image. */
function buildParcelOverlay(
  width: number,
  height: number,
  polygon: [number, number][],
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number,
): Buffer {
  const lngRange = maxLng - minLng;
  const latRange = maxLat - minLat;
  const svgPoints = polygon
    .map(([lat, lng]) => {
      const x = ((lng - minLng) / lngRange) * width;
      const y = ((maxLat - lat) / latRange) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <polygon points="${svgPoints}" fill="#cc0000" fill-opacity="0.2"
               stroke="#cc0000" stroke-width="3" stroke-linejoin="round"/>
    </svg>`;
  return Buffer.from(svg);
}

async function fetchWmsImage(
  baseUrl: string,
  layerParams: Record<string, string>,
): Promise<Buffer | null> {
  try {
    const params = new URLSearchParams({
      SERVICE: "WMS",
      REQUEST: "GetMap",
      VERSION: "1.1.1",
      STYLES: "",
      ...layerParams,
    });
    const res = await fetch(`${baseUrl}?${params}`, { signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) return null;
    if (!res.headers.get("content-type")?.includes("image")) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}
