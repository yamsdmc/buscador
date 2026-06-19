import { NextRequest, NextResponse } from "next/server";
import { CadastreService } from "@/lib/catastro";

export const runtime = "nodejs";

/** GET /api/lookup/rc?ref=XXXXXXXXXXXXXX → adresse + coordonnées de la parcelle. */
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref")?.trim();
  if (!ref) {
    return NextResponse.json({ found: false, error: "MISSING_REF" }, { status: 400 });
  }
  const result = await CadastreService.lookupByRef(ref);
  return NextResponse.json(result);
}
