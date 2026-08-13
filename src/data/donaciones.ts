/**
 * Donation needs per center.
 *
 * MOCK — placeholder pending a backend. The real feature (per Isabela's brief)
 * is an admin-editable list whose statuses update in real time, each carrying a
 * "last updated" timestamp. This module fakes that shape so the UI is complete;
 * swap `getNecesidades` for a Firestore-backed query when the endpoint exists.
 */

export type EstadoInsumo = "NECESITA" | "SUFICIENTE";

export type Insumo = {
  nombre: string;
  estado: EstadoInsumo;
};

export type Necesidades = {
  insumos: Insumo[];
  /** ISO datetime of the admin's last update. */
  actualizadoEn: string;
};

const INSUMOS_BASE = [
  "Agua embotellada",
  "Arroz",
  "Enlatados",
  "Aceite",
  "Panela",
  "Kits de aseo personal",
  "Pañales",
  "Cobijas",
  "Ropa en buen estado",
  "Medicamentos básicos",
] as const;

/**
 * Deterministic pseudo-status per center, so the demo looks alive without a
 * backend (same center → same statuses across reloads).
 */
export function getNecesidades(centroId: string): Necesidades {
  const seed = [...centroId].reduce((sum, char) => sum + char.charCodeAt(0), 0);

  const insumos: Insumo[] = INSUMOS_BASE.map((nombre, index) => ({
    nombre,
    estado: (seed + index) % 3 === 0 ? "NECESITA" : "SUFICIENTE",
  }));

  return { insumos, actualizadoEn: "2026-08-13T14:10:00" };
}
