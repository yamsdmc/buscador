import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnostic temporaire : teste l'accès sortant aux services depuis Vercel.
 * À supprimer une fois le problème réseau résolu.
 */
async function probe(label: string, url: string) {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; buscador-catastro/1.0)" },
    });
    const body = await res.text();
    return {
      label,
      ok: res.ok,
      status: res.status,
      ms: Date.now() - start,
      contentType: res.headers.get("content-type"),
      sample: body.slice(0, 120),
    };
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string; cause?: { code?: string; message?: string } };
    return {
      label,
      ok: false,
      ms: Date.now() - start,
      error: err?.name,
      message: err?.message,
      causeCode: err?.cause?.code,
      causeMessage: err?.cause?.message,
    };
  }
}

export async function GET() {
  const results = await Promise.all([
    probe(
      "catastro-cpmrc-https",
      "https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCoordenadas.svc/json/Consulta_CPMRC?Provincia=&Municipio=&SRS=EPSG:4326&RefCat=2182304TM6528S",
    ),
    probe("catastro-wfs-http", "http://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx?service=wfs&version=2&request=getcapabilities"),
    probe("ign-wms-https", "https://www.ign.es/wms-inspire/pnoa-ma?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.1.1"),
    probe("nominatim-https", "https://nominatim.openstreetmap.org/search?q=madrid&format=jsonv2&limit=1"),
  ]);

  return NextResponse.json({ node: process.version, results });
}
