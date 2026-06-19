import type { ParcelLocation } from "@/lib/types";

/** Fiche détaillée d'une parcelle : adresse + photo satellite cadastrale + emplacement Street View. */
export function ParcelDetail({ parcel }: { parcel: ParcelLocation }) {
  if (!parcel.found || parcel.latitude === undefined || parcel.longitude === undefined) {
    return null;
  }

  const satelliteUrl = `/api/satellite?lat=${parcel.latitude}&lng=${parcel.longitude}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${parcel.latitude},${parcel.longitude}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-0 md:grid-cols-2">
        {/* Photo satellite (PNG PNOA) + contour parcelle dessiné en SVG par-dessus */}
        <div className="relative aspect-[4/3] bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={satelliteUrl}
            alt={`Vue satellite ${parcel.address}`}
            className="h-full w-full object-cover"
          />
          {parcel.polygonPixels && (
            <svg
              viewBox="0 0 600 450"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              <polygon
                points={parcel.polygonPixels}
                fill="#cc0000"
                fillOpacity={0.2}
                stroke="#cc0000"
                strokeWidth={3}
                strokeLinejoin="round"
              />
            </svg>
          )}
          <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white">
            Satellite PNOA · parcelle cadastrale
          </span>
        </div>

        {/* Emplacement Street View (à brancher avec une clé Google) */}
        <div className="relative flex aspect-[4/3] items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-2 text-center text-slate-400">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="12" cy="9" r="3" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a7 7 0 0 0-7 7c0 4.5 7 13 7 13s7-8.5 7-13a7 7 0 0 0-7-7Z" />
            </svg>
            <span className="text-xs font-medium">Street View</span>
            <span className="text-[11px]">bientôt (clé Google requise)</span>
          </div>
        </div>
      </div>

      {/* Infos */}
      <div className="space-y-4 border-t border-slate-100 p-5">
        <div>
          <p className="text-base font-semibold text-slate-900">{parcel.address}</p>
          <p className="text-sm text-slate-500">
            {[parcel.province, parcel.autonomousCommunity].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-sm text-slate-700">
            {parcel.refcat}
          </span>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Ouvrir dans Google Maps ↗
          </a>
        </div>

        {/* Localisation */}
        <section className="border-t border-slate-100 pt-4">
          <SectionTitle>Localisation</SectionTitle>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Field label="Latitude" value={parcel.latitude?.toFixed(6)} mono />
            <Field label="Longitude" value={parcel.longitude?.toFixed(6)} mono />
            <Field label="Altitude" value={parcel.altitude !== undefined ? `${parcel.altitude} m` : undefined} />
            <Field label="Huso UTM" value={parcel.huso ? `${parcel.huso}${parcel.zoneLetter ?? ""}` : undefined} />
            <Field label="UTM X (ETRS89)" value={parcel.utmX ? `${Number(parcel.utmX).toFixed(2)} m` : undefined} mono />
            <Field label="UTM Y (ETRS89)" value={parcel.utmY ? `${Number(parcel.utmY).toFixed(2)} m` : undefined} mono />
            <Field label="Province" value={parcel.province} />
            <Field label="Comunidad" value={parcel.autonomousCommunity} />
            {parcel.climateZone && (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Zona climática
                </dt>
                <dd className="mt-0.5">
                  <span className="rounded-md bg-sky-50 px-2 py-0.5 text-sm font-semibold text-sky-700">
                    {parcel.climateZone}
                  </span>
                  <span className="ml-1 text-[11px] text-slate-400">CTE</span>
                </dd>
              </div>
            )}
          </dl>
        </section>

        {parcel.building && <BuildingSection building={parcel.building} />}
      </div>
    </div>
  );
}

function BuildingSection({ building }: { building: NonNullable<ParcelLocation["building"]> }) {
  const typeLabel = building.type === "RU" ? "Rústico" : building.type === "UR" ? "Urbano" : undefined;

  return (
    <section className="space-y-4 border-t border-slate-100 pt-4">
      <SectionTitle>Bâtiment</SectionTitle>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Field label="Usage" value={building.use} />
        <Field
          label="Surface construite"
          value={building.builtSurface ? `${building.builtSurface} m²` : undefined}
        />
        <Field
          label="Surface terrain"
          value={building.landSurface ? `${building.landSurface} m²` : undefined}
        />
        <Field label="Année" value={building.year} />
        <Field label="Nature" value={typeLabel} />
        <Field label="État" value={building.condition} />
        <Field label="Logements" value={building.dwellings !== undefined ? String(building.dwellings) : undefined} />
        <Field label="Niveaux" value={building.levels !== undefined ? String(building.levels) : undefined} />
        <Field label="Unités" value={building.unitCount ? String(building.unitCount) : undefined} />
        <Field label="Code postal" value={building.postalCode} />
        <Field label="Quote-part" value={building.participation} />
        <Field label="RC complète" value={building.fullRc} mono />
      </dl>

      {building.fincaType && <p className="text-xs italic text-slate-400">{building.fincaType}</p>}

      {building.subparcels && building.subparcels.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Sous-parcelles (cultivo)
          </p>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">
            {building.subparcels.map((sp, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="truncate text-slate-700">{sp.crop ?? "—"}</span>
                {sp.surface !== undefined && (
                  <span className="shrink-0 font-mono text-xs text-slate-500">{sp.surface} m²</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {building.units.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {building.units.length} {building.units.length > 1 ? "unités" : "unité"}
          </p>
          <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-100">
            {building.units.map((unit, i) => (
              <li key={unit.rc ?? i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-slate-700">
                  {unit.use ?? "—"}
                  {(unit.floor || unit.door) && (
                    <span className="text-slate-400">
                      {" · "}
                      {[unit.floor && `Pl. ${unit.floor}`, unit.door && `Pta. ${unit.door}`]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                  )}
                </span>
                {unit.surface !== undefined && (
                  <span className="shrink-0 font-mono text-xs text-slate-500">{unit.surface} m²</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {building.cartographyUrl && (
        <a
          href={building.cartographyUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Cartographie cadastrale officielle ↗
        </a>
      )}
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</h3>
  );
}

function Field({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-sm text-slate-800 ${mono ? "font-mono" : ""}`}>{value ?? "—"}</dd>
    </div>
  );
}
