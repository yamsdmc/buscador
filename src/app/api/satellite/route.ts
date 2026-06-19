import { NextRequest, NextResponse } from "next/server";
import { getSatelliteImage } from "@/lib/satellite";

export const runtime = "nodejs";

/** GET /api/satellite?lat=..&lng=..&ref=.. → JPEG orthophoto + contour parcelle. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = parseFloat(sp.get("lat") ?? "");
  const lng = parseFloat(sp.get("lng") ?? "");
  const ref = sp.get("ref") ?? undefined;

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return new NextResponse(null, { status: 400 });
  }

  const result = await getSatelliteImage(lat, lng, ref);
  if (!result) return new NextResponse(null, { status: 404 });

  // On ne met en cache 24h QUE les images complètes (avec tracé de la parcelle).
  // Si le contour a échoué (WFS lent), on ne cache pas → réessai au prochain chargement.
  const cacheControl = result.overlay ? "public, max-age=86400" : "no-store";

  return new NextResponse(new Uint8Array(result.image), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": cacheControl,
    },
  });
}
