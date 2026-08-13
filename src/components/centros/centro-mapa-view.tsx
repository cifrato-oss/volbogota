"use client";

import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

import "leaflet/dist/leaflet.css";

type CentroMapaViewProps = {
  lat: number;
  lng: number;
  nombre: string;
  direccion: string | null;
};

// A self-contained SVG pin — avoids Leaflet's default marker images, which
// break under bundlers. Teal to match the app's primary.
const pinIcon = L.divIcon({
  className: "border-0 bg-transparent",
  html: `<svg width="30" height="30" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#0f766e"/>
    <circle cx="12" cy="9" r="2.6" fill="#ffffff"/>
  </svg>`,
  iconSize: [30, 30],
  iconAnchor: [15, 29],
  popupAnchor: [0, -27],
});

/**
 * Interactive OpenStreetMap view centered on a center's coordinates. Rendered
 * client-only (dynamic import with `ssr: false`) because Leaflet touches
 * `window` during render.
 */
export function CentroMapaView({ lat, lng, nombre, direccion }: CentroMapaViewProps) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={16}
      scrollWheelZoom={false}
      // Keep Leaflet's internal z-indices from escaping over the sticky header.
      style={{ zIndex: 0 }}
      className="border-border h-64 w-full overflow-hidden rounded-xl border"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lng]} icon={pinIcon}>
        <Popup>
          <strong>{nombre}</strong>
          {direccion ? (
            <>
              <br />
              {direccion}
            </>
          ) : null}
        </Popup>
      </Marker>
    </MapContainer>
  );
}
