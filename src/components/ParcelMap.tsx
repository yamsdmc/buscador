"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, CircleMarker, LeafletMouseEvent } from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Carte interactive (Leaflet). Base plan (OSM) + couche satellite (PNOA, sans clé).
 * Clic sur la carte → onMapClick(lat, lng). La parcelle sélectionnée est marquée en rouge.
 */
export function ParcelMap({
  point,
  selectedPoint,
  onMapClick,
}: {
  /** Point recherché (clic ou adresse) → marqueur indigo, recentre. */
  point?: { lat: number; lng: number } | null;
  /** Parcelle sélectionnée → marqueur rouge, zoom. */
  selectedPoint?: { lat: number; lng: number } | null;
  onMapClick: (lat: number, lng: number) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const clickMarkerRef = useRef<CircleMarker | null>(null);
  const selMarkerRef = useRef<CircleMarker | null>(null);
  const onClickRef = useRef(onMapClick);
  useEffect(() => {
    onClickRef.current = onMapClick;
  });

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !elRef.current || mapRef.current) return;

      map = L.map(elRef.current).setView([40.4168, -3.7038], 6);
      mapRef.current = map;

      const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const pnoa = L.tileLayer.wms("https://www.ign.es/wms-inspire/pnoa-ma", {
        layers: "OI.OrthoimageCoverage",
        format: "image/png",
        attribution: "PNOA © IGN España",
        maxZoom: 20,
      });

      L.control.layers({ Plan: osm, "Satellite (PNOA)": pnoa }).addTo(map);

      map.on("click", (e: LeafletMouseEvent) => {
        onClickRef.current(e.latlng.lat, e.latlng.lng);
      });
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
      mapRef.current = null;
      clickMarkerRef.current = null;
      selMarkerRef.current = null;
    };
  }, []);

  // Marqueur (indigo) du point recherché (clic ou adresse), recentre.
  useEffect(() => {
    (async () => {
      const map = mapRef.current;
      if (!map || !point) return;
      const L = (await import("leaflet")).default;
      const { lat, lng } = point;
      if (clickMarkerRef.current) {
        clickMarkerRef.current.setLatLng([lat, lng]);
      } else {
        clickMarkerRef.current = L.circleMarker([lat, lng], {
          radius: 7,
          color: "#6366f1",
          weight: 3,
          fillColor: "#6366f1",
          fillOpacity: 0.35,
        }).addTo(map);
      }
      map.setView([lat, lng], Math.max(map.getZoom() ?? 0, 16));
    })();
  }, [point]);

  // Marqueur (rouge) de la parcelle sélectionnée, recentre dessus.
  useEffect(() => {
    (async () => {
      const map = mapRef.current;
      if (!map || !selectedPoint) return;
      const L = (await import("leaflet")).default;
      const { lat, lng } = selectedPoint;
      if (selMarkerRef.current) {
        selMarkerRef.current.setLatLng([lat, lng]);
      } else {
        selMarkerRef.current = L.circleMarker([lat, lng], {
          radius: 8,
          color: "#cc0000",
          weight: 3,
          fillColor: "#cc0000",
          fillOpacity: 0.5,
        }).addTo(map);
      }
      map.setView([lat, lng], Math.max(map.getZoom() ?? 0, 17));
    })();
  }, [selectedPoint]);

  return (
    <div
      ref={elRef}
      className="h-[440px] w-full overflow-hidden rounded-2xl border border-slate-200"
    />
  );
}
