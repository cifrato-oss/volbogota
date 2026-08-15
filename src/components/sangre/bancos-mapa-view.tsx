"use client";

import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { useEffect } from "react";

import "leaflet/dist/leaflet.css";

import useGeocode from "@/queries/geocode/useGeocode";
import type { BancoSangreVista } from "@/types/sangre";

/** Bogotá, so the map opens over the city while the pins resolve. */
const CENTRO_BOGOTA: [number, number] = [4.65, -74.1];

function pin(color: string) {
  return L.divIcon({
    className: "border-0 bg-transparent",
    html: `<svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}"/>
      <circle cx="12" cy="9" r="2.6" fill="#ffffff"/>
    </svg>`,
    iconSize: [28, 28],
    iconAnchor: [14, 27],
    popupAnchor: [0, -25],
  });
}

// Green for a point that takes the donor's type, rose for the rest — the same
// two colours the list uses, so a pin and a card are recognisably the same
// thing. Nothing else on the map is coloured.
const PIN_COINCIDE = pin("#059669");
const PIN_NORMAL = pin("#e11d48");

/**
 * One bank's pin.
 *
 * A component per bank rather than a loop, because each one needs its own
 * `useGeocode` and hooks cannot run in a loop. It renders nothing until its
 * address resolves, so the map fills in as answers arrive instead of blocking on
 * the slowest one.
 */
function PinBanco({ banco, coincide }: { banco: BancoSangreVista; coincide: boolean }) {
  const consultas = [
    [banco.direccion, banco.localidad].filter(Boolean).join(", ") &&
      `${[banco.direccion, banco.localidad].filter(Boolean).join(", ")}, Bogotá, Colombia`,
    banco.localidad && `${banco.localidad}, Bogotá, Colombia`,
    `${banco.nombre}, Bogotá, Colombia`,
  ].filter((consulta): consulta is string => Boolean(consulta));

  const { data: punto } = useGeocode(consultas);
  if (!punto) return null;

  return (
    <Marker position={[punto.lat, punto.lng]} icon={coincide ? PIN_COINCIDE : PIN_NORMAL}>
      <Popup>
        <strong>{banco.nombre}</strong>
        {banco.direccion ? (
          <>
            <br />
            {banco.direccion}
          </>
        ) : null}
        {banco.linkMaps ? (
          <>
            <br />
            <a href={banco.linkMaps} target="_blank" rel="noreferrer">
              Abrir en Google Maps
            </a>
          </>
        ) : null}
      </Popup>
    </Marker>
  );
}

/**
 * Re-centres when the filtered set changes.
 *
 * Without it, narrowing to Suba leaves the map sitting over the whole city with
 * the answer somewhere off in a corner — the filter would appear not to have
 * done anything.
 */
function Encuadrar({ bancos }: { bancos: BancoSangreVista[] }) {
  const mapa = useMap();
  const clave = bancos.map((banco) => banco.id).join("|");

  useEffect(() => {
    const marcadores: L.LatLng[] = [];
    mapa.eachLayer((capa) => {
      if (capa instanceof L.Marker) marcadores.push(capa.getLatLng());
    });

    if (marcadores.length === 0) return;
    if (marcadores.length === 1) {
      mapa.setView(marcadores[0]!, 15);
      return;
    }

    mapa.fitBounds(L.latLngBounds(marcadores), { padding: [40, 40], maxZoom: 15 });
    // `clave` and not `bancos`: the array is rebuilt on every render, and
    // refitting on each one would fight the user panning the map.
  }, [mapa, clave]);

  return null;
}

export function BancosMapaView({
  bancos,
  coincideCon,
}: {
  bancos: BancoSangreVista[];
  coincideCon: (banco: BancoSangreVista) => boolean;
}) {
  return (
    <MapContainer
      center={CENTRO_BOGOTA}
      zoom={11}
      scrollWheelZoom={false}
      // Keep Leaflet's internal z-indices from escaping over the sticky header.
      style={{ zIndex: 0 }}
      className="border-border h-72 w-full overflow-hidden rounded-xl border"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {bancos.map((banco) => (
        <PinBanco key={banco.id} banco={banco} coincide={coincideCon(banco)} />
      ))}
      <Encuadrar bancos={bancos} />
    </MapContainer>
  );
}
