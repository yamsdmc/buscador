"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { ParcelLocation, AddressSearchResult, NearbyParcel } from "@/lib/types";
import { ParcelDetail } from "@/components/ParcelDetail";
import { CandidateList } from "@/components/CandidateList";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

const ParcelMap = dynamic(() => import("@/components/ParcelMap").then((m) => m.ParcelMap), {
  ssr: false,
  loading: () => <div className="h-[440px] w-full animate-pulse rounded-2xl bg-slate-100" />,
});

type Mode = "rc" | "address" | "map";

export default function Home() {
  const [mode, setMode] = useState<Mode>("rc");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<ParcelLocation | null>(null);
  const [candidates, setCandidates] = useState<NearbyParcel[] | null>(null);
  const [selectedRef, setSelectedRef] = useState<string | undefined>(undefined);
  const [mapPoint, setMapPoint] = useState<{ lat: number; lng: number } | null>(null);

  function reset() {
    setError(null);
    setDetail(null);
    setCandidates(null);
    setSelectedRef(undefined);
    setMapPoint(null);
  }

  async function loadParcel(ref: string): Promise<ParcelLocation | null> {
    const res = await fetch(`/api/lookup/rc?ref=${encodeURIComponent(ref)}`);
    const data: ParcelLocation = await res.json();
    if (!data.found) {
      setError("Référence cadastrale introuvable.");
      return null;
    }
    setDetail(data);
    setSelectedRef(data.refcat);
    return data;
  }

  /** Charge les 20 parcelles les plus proches (flux RC) et les liste à côté. */
  async function loadNearest(parcel: ParcelLocation) {
    if (parcel.latitude === undefined || parcel.longitude === undefined) return;
    const params = new URLSearchParams({
      lat: String(parcel.latitude),
      lng: String(parcel.longitude),
      count: "20",
      exclude: parcel.refcat ?? "",
    });
    const res = await fetch(`/api/lookup/nearest?${params}`);
    const data: AddressSearchResult = await res.json();
    if (data.parcels?.length) setCandidates(data.parcels);
  }

  async function onSelectCandidate(parcel: NearbyParcel) {
    setSelectedRef(parcel.refcat);
    setDetail(null);
    await loadParcel(parcel.refcat);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    reset();
    setLoading(true);
    try {
      if (mode === "rc") {
        const parcel = await loadParcel(q);
        if (parcel) await loadNearest(parcel);
      } else {
        const res = await fetch(`/api/lookup/address?q=${encodeURIComponent(q)}`);
        const data: AddressSearchResult = await res.json();
        if (!data.found || !data.parcels?.length) {
          setError(
            data.error === "ADDRESS_NOT_FOUND"
              ? "Adresse introuvable. Précise la ville."
              : "Aucune parcelle proche trouvée.",
          );
          return;
        }
        setCandidates(data.parcels);
        await onSelectCandidate(data.parcels[0]);
      }
    } catch {
      setError("Erreur réseau. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  async function onMapClick(lat: number, lng: number) {
    setError(null);
    setDetail(null);
    setCandidates(null);
    setSelectedRef(undefined);
    setMapPoint({ lat, lng });
    setLoading(true);
    try {
      const res = await fetch(`/api/lookup/nearby?lat=${lat}&lng=${lng}&limit=15`);
      const data: AddressSearchResult = await res.json();
      if (!data.found || !data.parcels?.length) {
        setError("Aucune parcelle ici — clique sur une zone bâtie.");
        return;
      }
      setCandidates(data.parcels);
      await onSelectCandidate(data.parcels[0]);
    } catch {
      setError("Erreur réseau. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  const selectedPoint =
    detail?.latitude !== undefined && detail?.longitude !== undefined
      ? { lat: detail.latitude, lng: detail.longitude }
      : null;

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-10 sm:py-16">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Buscador Catastro
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Référence cadastrale · adresse · ou carte interactive → cadastre + parcelles proches
        </p>
      </header>

      {/* Bascule de mode */}
      <div className="mx-auto mb-3 flex w-full max-w-xl rounded-full bg-slate-100 p-1">
        {(
          [
            { id: "rc", label: "Référence cadastrale" },
            { id: "address", label: "Adresse" },
            { id: "map", label: "Carte" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setMode(tab.id);
              setQuery("");
              reset();
            }}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              mode === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Recherche par texte (RC / Adresse) */}
      {(mode === "rc" || mode === "address") && (
        <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-md gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              mode === "rc" ? "Ex : 9872023VH5797S0001WX" : "Ex : Calle Gloria 51, Santa Cruz de Mudela"
            }
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "…" : "Chercher"}
          </button>
        </form>
      )}

      {error && (
        <p className="mx-auto mt-4 max-w-md rounded-xl bg-amber-50 px-4 py-3 text-center text-sm text-amber-700">
          {error}
        </p>
      )}

      {/* Mode Carte : recherche d'adresse + carte + liste des 15 à côté */}
      {mode === "map" ? (
        <div className="mt-6 space-y-4">
          <div className="mx-auto max-w-xl">
            <AddressAutocomplete onSelect={(lat, lng) => onMapClick(lat, lng)} />
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_300px]">
            <ParcelMap point={mapPoint} selectedPoint={selectedPoint} onMapClick={onMapClick} />
            <div className="max-h-[440px] overflow-y-auto">
              {candidates ? (
                <CandidateList parcels={candidates} selectedRef={selectedRef} onSelect={onSelectCandidate} />
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                  Cherche une adresse ou clique sur la carte pour lister les 15 parcelles les plus proches.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Mode adresse : liste au-dessus de la fiche (on désambiguïse d'abord).
        mode === "address" &&
        candidates && (
          <section className="mt-8">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {candidates.length} parcelles proches — clique pour voir
            </h2>
            <CandidateList parcels={candidates} selectedRef={selectedRef} onSelect={onSelectCandidate} />
          </section>
        )
      )}

      {detail && (
        <div className="mt-6">
          <ParcelDetail parcel={detail} />
        </div>
      )}

      {/* Mode RC : les 20 parcelles les plus proches, sous la fiche. */}
      {mode === "rc" && detail && candidates && candidates.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {candidates.length} parcelles les plus proches — clique pour voir
          </h2>
          <CandidateList parcels={candidates} selectedRef={selectedRef} onSelect={onSelectCandidate} />
        </section>
      )}
    </main>
  );
}
