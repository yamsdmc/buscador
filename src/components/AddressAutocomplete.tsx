"use client";

import { useEffect, useRef, useState } from "react";
import type { GeocodeResult } from "@/lib/geocode";

/**
 * Champ adresse avec autocomplete (suggestions débouncées via /api/geocode).
 * Sélection d'une suggestion → onSelect(lat, lng, label).
 */
export function AddressAutocomplete({
  onSelect,
}: {
  onSelect: (lat: number, lng: number, label: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Débounce de la requête de suggestions (tout est asynchrone, hors corps d'effet).
  useEffect(() => {
    const q = query.trim();
    const controller = new AbortController();
    const t = setTimeout(async () => {
      if (q.length < 3) {
        setItems([]);
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data: { results: GeocodeResult[] } = await res.json();
        setItems(data.results);
        setOpen(true);
      } catch {
        /* requête annulée ou réseau */
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  // Ferme le dropdown au clic extérieur.
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function pick(item: GeocodeResult) {
    setQuery(item.label);
    setOpen(false);
    setItems([]);
    onSelect(item.lat, item.lng, item.label);
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => items.length > 0 && setOpen(true)}
        placeholder="Chercher une adresse…"
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">…</span>
      )}

      {open && items.length > 0 && (
        <ul className="absolute z-[1000] mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {items.map((item, i) => (
            <li key={`${item.lat},${item.lng},${i}`}>
              <button
                type="button"
                onClick={() => pick(item)}
                className="block w-full truncate px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                title={item.label}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
