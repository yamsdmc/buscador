import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Diagnostic temporaire image : sharp + fetch PNOA GetMap + WFS. À supprimer. */
export async function GET() {
  const out: Record<string, unknown> = {};

  // 1) sharp se charge-t-il + opère-t-il ?
  try {
    const sharp = (await import("sharp")).default;
    const buf = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();
    out.sharp = { ok: true, bytes: buf.length };
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string };
    out.sharp = { ok: false, error: err?.name, message: err?.message };
  }

  // 2) PNOA GetMap (la vraie image, pas GetCapabilities)
  const bbox = "-5.876,42.037,-5.874,42.039";
  const wmsUrl = `https://www.ign.es/wms-inspire/pnoa-ma?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&STYLES=&LAYERS=OI.OrthoimageCoverage&SRS=EPSG:4326&BBOX=${bbox}&WIDTH=600&HEIGHT=450&FORMAT=image/png`;
  try {
    const res = await fetch(wmsUrl, { signal: AbortSignal.timeout(8000) });
    const ab = await res.arrayBuffer();
    out.pnoaGetMap = {
      status: res.status,
      contentType: res.headers.get("content-type"),
      bytes: ab.byteLength,
    };
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string; cause?: { code?: string } };
    out.pnoaGetMap = { ok: false, error: err?.name, message: err?.message, causeCode: err?.cause?.code };
  }

  // 3) WFS GetParcel en https
  try {
    const res = await fetch(
      "https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx?service=wfs&version=2&request=getfeature&StoredQuery_id=GetParcel&refcat=2182304TM6528S&srsname=EPSG:4326",
      { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "buscador-catastro/1.0" } },
    );
    const txt = await res.text();
    out.wfs = { status: res.status, hasPosList: txt.includes("posList"), bytes: txt.length };
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string; cause?: { code?: string } };
    out.wfs = { ok: false, error: err?.name, message: err?.message, causeCode: err?.cause?.code };
  }

  return NextResponse.json(out);
}
