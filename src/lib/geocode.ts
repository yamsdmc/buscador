/**
 * Géocodage d'adresse → coordonnées GPS.
 * Utilise Nominatim (OpenStreetMap) : gratuit, sans clé, limité à l'Espagne.
 * Pour plus de précision rue-par-rue, on pourra brancher CartoCiudad (IGN) ou MapTiler.
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
}

/** Suggestions d'adresses (autocomplete) pour un terme partiel. */
export async function geocodeSuggestions(query: string, limit = 6): Promise<GeocodeResult[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      countrycodes: "es",
      format: "jsonv2",
      limit: String(limit),
      "accept-language": "es",
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "buscador-catastro/1.0 (contacto@buscador-catastro)" },
    });
    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((d) => ({ lat: parseFloat(d.lat), lng: parseFloat(d.lon), label: d.display_name as string }))
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
  } catch {
    return [];
  }
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  try {
    const params = new URLSearchParams({
      q: query,
      countrycodes: "es",
      format: "jsonv2",
      limit: "1",
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "buscador-catastro/1.0 (contacto@buscador-catastro)" },
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const first = data[0];
    return {
      lat: parseFloat(first.lat),
      lng: parseFloat(first.lon),
      label: first.display_name,
    };
  } catch {
    return null;
  }
}
