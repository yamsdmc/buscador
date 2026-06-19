import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const PNOA_URL = "https://www.ign.es/wms-inspire/pnoa-ma";
const IMG_W = 600;
const IMG_H = 450;
const BBOX_DELTA = 0.001;

/**
 * GET /api/satellite?lat=..&lng=.. → orthophoto PNOA (PNG) brute.
 * Le contour de parcelle est dessiné côté client (SVG), plus aucun traitement
 * d'image serveur → aucune dépendance native.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = parseFloat(sp.get("lat") ?? "");
  const lng = parseFloat(sp.get("lng") ?? "");
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return new NextResponse(null, { status: 400 });
  }

  const bbox = `${lng - BBOX_DELTA},${lat - BBOX_DELTA},${lng + BBOX_DELTA},${lat + BBOX_DELTA}`;
  const params = new URLSearchParams({
    SERVICE: "WMS",
    REQUEST: "GetMap",
    VERSION: "1.1.1",
    STYLES: "",
    LAYERS: "OI.OrthoimageCoverage",
    SRS: "EPSG:4326",
    BBOX: bbox,
    WIDTH: String(IMG_W),
    HEIGHT: String(IMG_H),
    FORMAT: "image/png",
  });

  try {
    const res = await fetch(`${PNOA_URL}?${params}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok || !res.headers.get("content-type")?.includes("image")) {
      return new NextResponse(null, { status: 404 });
    }
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
