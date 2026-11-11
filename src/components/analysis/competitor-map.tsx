"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export type MapPoint = { lat: number; lng: number; name: string; address: string | null; color: string };

/** Mapa OpenStreetMap con las ubicaciones de los competidores. */
export function CompetitorMap({ points }: { points: MapPoint[] }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      // Centro por defecto: Santa Cruz de la Sierra.
      map = L.map(el.current, { scrollWheelZoom: false }).setView([-17.7833, -63.1821], 12);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      const layer = L.featureGroup();
      points.forEach((p) =>
        L.circleMarker([p.lat, p.lng], { radius: 9, color: "#fff", weight: 2, fillColor: p.color, fillOpacity: 0.95 })
          .bindPopup(`<strong>${escape(p.name)}</strong>${p.address ? `<br/>${escape(p.address)}` : ""}`)
          .addTo(layer),
      );
      layer.addTo(map);
      if (points.length) map.fitBounds(layer.getBounds().pad(0.3), { maxZoom: 15 });
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points]);

  return <div ref={el} className="z-0 h-80 w-full overflow-hidden rounded-2xl bg-surface-2" aria-label="Mapa de competidores" />;
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
