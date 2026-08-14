/**
 * Contracts for the "Quiero donar" flow — the donation semaphore.
 * Mirrors what `GET /api/donaciones/necesidades?centro={id}` returns.
 */

export type CategoriaDonacion =
  | "Alimentos"
  | "Insumos médicos"
  | "Aseo"
  | "Bebé"
  | "Mascotas"
  | "Hogar"
  | "Cocina"
  | "Construcción"
  | "Ropa";

/** Need state. `NO_APLICA` = this item isn't collected at this point. */
export type EstadoNecesidad = "SE_NECESITA" | "SUFICIENTE" | "NO_APLICA";

/** Badge color the API resolves for each state. */
export type Semaforo = "ROJO" | "VERDE" | "GRIS";

export interface NecesidadElemento {
  id: string;
  elementoId: string;
  elemento: string;
  estado: EstadoNecesidad;
  semaforo: Semaforo;
  /** ISO datetime; `null` if never touched by a sync or the admin panel. */
  actualizadoEn: string | null;
}

export interface NecesidadesCategoria {
  categoria: CategoriaDonacion;
  /** Category-level note, e.g. "Revisa las fechas de vencimiento." */
  mensaje: string | null;
  /** `true` when at least one item in the category is `SE_NECESITA`. */
  necesita: boolean;
  elementos: NecesidadElemento[];
}

export interface NecesidadesDeCentro {
  centroId: string;
  centroNombre: string;
  categorias: NecesidadesCategoria[];
}

/**
 * Donation intent — what a donor commits to bringing to a center.
 * Mirrors the payload/response of `POST /api/donaciones/solicitudes`.
 */

/** One item a donor picked, carried across category tabs by its `elementoId`. */
export interface SolicitudDonacionItem {
  elementoId: string;
  categoria: CategoriaDonacion;
  elemento: string;
}

/** Body sent to `POST /api/donaciones/solicitudes`. */
export interface SolicitudDonacionInput {
  centroId: string;
  items: SolicitudDonacionItem[];
}

/** Confirmation the endpoint returns once the intent is registered. */
export interface SolicitudDonacionConfirmacion {
  /** Human-friendly reference, e.g. `DON-7QK2M9`. */
  codigo: string;
  centroId: string;
  totalItems: number;
  /** ISO datetime the request was received. */
  recibidoEn: string;
}
