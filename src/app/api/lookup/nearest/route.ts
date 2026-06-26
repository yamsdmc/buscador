import { NextRequest, NextResponse } from "next/server";
import { CadastreService } from "@/lib/catastro";

export const runtime = "nodejs";

/**
 * GET /api/lookup/nearest?lat=..&lng=..&count=20&exclude=REFCAT
 * → les N parcelles cadastrales les plus proches d'un point (WFS, nombre garanti).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = parseFloat(sp.get("lat") ?? "");
  const lng = parseFloat(sp.get("lng") ?? "");
  const count = Math.min(parseInt(sp.get("count") ?? "20", 10) || 20, 50);
  const exclude = sp.get("exclude") ?? undefined;

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ found: false, error: "MISSING_COORDS" }, { status: 400 });
  }

  const parcels = await CadastreService.findNearestParcels(lat, lng, count, exclude);
  return NextResponse.json({ found: parcels.length > 0, parcels });
}
