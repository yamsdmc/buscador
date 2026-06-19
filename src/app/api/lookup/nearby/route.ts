import { NextRequest, NextResponse } from "next/server";
import { CadastreService } from "@/lib/catastro";

export const runtime = "nodejs";

/** GET /api/lookup/nearby?lat=..&lng=..&limit=15 → parcelles proches d'un point. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = parseFloat(sp.get("lat") ?? "");
  const lng = parseFloat(sp.get("lng") ?? "");
  const limit = Math.min(parseInt(sp.get("limit") ?? "15", 10) || 15, 30);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ found: false, error: "MISSING_COORDS" }, { status: 400 });
  }

  const parcels = await CadastreService.searchNearby(lat, lng, limit);
  return NextResponse.json({ found: parcels.length > 0, parcels });
}
