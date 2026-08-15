"use client";

import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import "leaflet/dist/leaflet.css";

import type { BancoSangreVista } from "@/types/sangre";

/** Bogotá, for the moment before the map knows what it is showing. */
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

// The two colours the list uses, so a pin and a card are the same thing.
const PIN_COINCIDE = pin("#059669");
const PIN_NORMAL = pin("#e11d48");

/**
 * Re-centres on whatever is currently pinned.
 *
 * Without it, narrowing to Suba leaves the map over the whole city with the
 * answer off in a corner, and the filter appears to have done nothing.
 */
function Encuadrar({ puntos }: { puntos: Array<[number, number]> }) {
  const mapa = useMap();
  const clave = puntos.map(([lat, lng]) => `${lat},${lng}`).join("|");

  useEffect(() => {
    if (puntos.length === 0) return;
    if (puntos.length === 1) {
      mapa.setView(puntos[0]!, 15);
      return;
    }
    mapa.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 15 });
    // Keyed on the coordinates rather than the array, which is rebuilt every
    // render — refitting on each one would fight the reader panning the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa, clave]);

  return null;
}

type Ubicado = BancoSangreVista & { lat: number; lng: number };

/**
 * Nudges apart points that share exact coordinates.
 *
 * Two banks really can sit at one address — the sheet has a hospital and a
 * Secretaría desk sharing a building and a Maps link — and identical
 * coordinates put one marker exactly under the other. The one underneath is not
 * hidden so much as unreachable: nothing on screen suggests it is there.
 *
 * The offset is about fifteen metres, arranged around a circle, which separates
 * the pins without moving either far enough to point at a different place. It is
 * deterministic, so the pins do not dance between renders.
 */
function separarApilados(bancos: Ubicado[]): Ubicado[] {
  const vistos = new Map<string, number>();
  const RADIO = 0.00014;

  return bancos.map((banco) => {
    const clave = `${banco.lat.toFixed(6)},${banco.lng.toFixed(6)}`;
    const cuantos = vistos.get(clave) ?? 0;
    vistos.set(clave, cuantos + 1);

    if (cuantos === 0) return banco;

    const angulo = (cuantos * 2 * Math.PI) / 6;
    return {
      ...banco,
      lat: banco.lat + RADIO * Math.sin(angulo),
      lng: banco.lng + RADIO * Math.cos(angulo),
    };
  });
}

/**
 * The pinned points.
 *
 * Coordinates arrive already resolved, read from each bank's Maps link when the
 * sheet was synced. The first version geocoded addresses in the browser instead,
 * and it was wrong in a way that looked like nothing: a Colombian street address
 * is almost never in OpenStreetMap, so every lookup fell through to the locality
 * and every bank in Suba landed on the same point — two markers stacked exactly,
 * one visible, and no way for anyone to tell the other was underneath.
 */
export function BancosMapaView({
  bancos,
  coincideCon,
}: {
  bancos: BancoSangreVista[];
  coincideCon: (banco: BancoSangreVista) => boolean;
}) {
  const ubicados = separarApilados(
    bancos.filter(
      (banco): banco is BancoSangreVista & { lat: number; lng: number } =>
        banco.lat != null && banco.lng != null,
    ),
  );

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

      {ubicados.map((banco) => (
        <Marker
          key={banco.id}
          position={[banco.lat, banco.lng]}
          icon={coincideCon(banco) ? PIN_COINCIDE : PIN_NORMAL}
        >
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
                  Cómo llegar
                </a>
              </>
            ) : null}
          </Popup>
        </Marker>
      ))}

      <Encuadrar puntos={ubicados.map((banco) => [banco.lat, banco.lng])} />
    </MapContainer>
  );
}
