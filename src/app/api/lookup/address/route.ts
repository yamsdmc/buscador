import { NextRequest, NextResponse } from "next/server";
import { CadastreService } from "@/lib/catastro";
import { geocodeAddress } from "@/lib/geocode";

export const runtime = "nodejs";

/** GET /api/lookup/address?q=... → parcelle de l'adresse + les 10 plus proches. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ found: false, error: "MISSING_QUERY" }, { status: 400 });
  }

  const point = await geocodeAddress(q);
  if (!point) {
    return NextResponse.json({ found: false, error: "ADDRESS_NOT_FOUND" });
  }

  const parcels = await CadastreService.searchNearby(point.lat, point.lng, 10);
  return NextResponse.json({ found: parcels.length > 0, point, parcels });
}
