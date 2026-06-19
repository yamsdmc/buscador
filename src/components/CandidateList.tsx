import type { NearbyParcel } from "@/lib/types";

/** Liste des parcelles proches d'une adresse, triées par distance. Clic = sélection. */
export function CandidateList({
  parcels,
  selectedRef,
  onSelect,
}: {
  parcels: NearbyParcel[];
  selectedRef?: string;
  onSelect: (parcel: NearbyParcel) => void;
}) {
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {parcels.map((parcel, i) => {
        const active = parcel.refcat === selectedRef;
        return (
          <li key={parcel.refcat}>
            <button
              type="button"
              onClick={() => onSelect(parcel)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                active ? "bg-indigo-50" : "hover:bg-slate-50"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  i === 0 ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">
                  {parcel.address}
                </span>
                <span className="block font-mono text-xs text-slate-400">{parcel.refcat}</span>
              </span>
              <span className="shrink-0 text-xs font-medium text-slate-500">
                {parcel.distance === 0 ? "ici" : `${parcel.distance.toFixed(0)} m`}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
