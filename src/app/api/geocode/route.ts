import { NextRequest, NextResponse } from "next/server";
import { geocodeSuggestions } from "@/lib/geocode";

export const runtime = "nodejs";

/** GET /api/geocode?q=... → suggestions d'adresses {lat, lng, label}. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) {
    return NextResponse.json({ results: [] });
  }
  const results = await geocodeSuggestions(q, 6);
  return NextResponse.json({ results });
}
