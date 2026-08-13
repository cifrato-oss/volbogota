import { notFound } from "@/server/http/errors";
import { findCentroById } from "@/server/modules/catalogo/catalogo.repository";

import { findElementos, findNecesidadesPorCentro, guardarNecesidad } from "./donaciones.repository";
import {
  CATEGORIAS_DONACION,
  ESTADO_POR_DEFECTO,
  SEMAFORO_POR_ESTADO,
  buildNecesidadId,
  toNecesidadPublica,
  type CategoriaDonacion,
  type EstadoNecesidad,
  type Necesidad,
  type NecesidadPublica,
  type Semaforo,
} from "./donaciones.schema";

export type ListarNecesidadesOptions = { categoria?: CategoriaDonacion };

/** One item within a category, already resolved for this centre. */
export type NecesidadElemento = {
  id: string;
  elementoId: string;
  elemento: string;
  estado: EstadoNecesidad;
  semaforo: Semaforo;
  actualizadoEn: string | null;
};

export type NecesidadesCategoria = {
  categoria: CategoriaDonacion;
  /** Category-level note, e.g. "Revisa las fechas de vencimiento." */
  mensaje: string | null;
  /** `true` when at least one item in this category is `SE_NECESITA`. */
  necesita: boolean;
  elementos: NecesidadElemento[];
};

export type NecesidadesDeCentro = {
  centroId: string;
  centroNombre: string;
  categorias: NecesidadesCategoria[];
};

/**
 * What "Quiero donar" shows once a point of collection is chosen: the five
 * categories (or just one), each already telling you whether it has anything
 * pending and which items those are — one call instead of a catalogue lookup
 * followed by a needs lookup.
 *
 * An item the sheet has never set for this point is not an error — it defaults
 * to `SE_NECESITA`, the same bias the master file ships with: assume a need
 * until a coordinator says otherwise.
 */
export async function listarNecesidadesDeCentro(
  centroId: string,
  { categoria }: ListarNecesidadesOptions = {},
): Promise<NecesidadesDeCentro> {
  const centro = await findCentroById(centroId);
  if (!centro || !centro.activo) {
    throw notFound("El centro de acopio no existe.");
  }

  const [elementos, necesidades] = await Promise.all([
    findElementos(categoria),
    findNecesidadesPorCentro(centroId),
  ]);

  const porElemento = new Map(necesidades.map((necesidad) => [necesidad.elementoId, necesidad]));
  const categoriasAMostrar = categoria ? [categoria] : CATEGORIAS_DONACION;

  const categorias = categoriasAMostrar.map((categoriaActual): NecesidadesCategoria => {
    const items = elementos.filter((elemento) => elemento.categoria === categoriaActual);

    const elementosResueltos = items.map((elemento): NecesidadElemento => {
      const existente = porElemento.get(elemento.id);
      const estado = existente?.estado ?? ESTADO_POR_DEFECTO;

      return {
        id: buildNecesidadId(centroId, elemento.id),
        elementoId: elemento.id,
        elemento: elemento.nombre,
        estado,
        semaforo: SEMAFORO_POR_ESTADO[estado],
        actualizadoEn: existente?.actualizadoEn ?? null,
      };
    });

    return {
      categoria: categoriaActual,
      mensaje: items[0]?.mensaje ?? null,
      necesita: elementosResueltos.some((elemento) => elemento.estado === "SE_NECESITA"),
      elementos: elementosResueltos,
    };
  });

  return { centroId, centroNombre: centro.nombre, categorias };
}

/**
 * What the admin panel calls to flip a semaphore.
 *
 * Upserts rather than requiring a prior sync: a centre × item pair the sheet
 * has never written should still become settable from the panel, not bounce
 * off a 404 because nothing has touched it yet.
 */
export async function actualizarEstadoNecesidad(
  id: string,
  estado: EstadoNecesidad,
): Promise<NecesidadPublica> {
  const separador = id.indexOf("_");
  if (separador === -1) {
    throw notFound("El identificador de necesidad no es válido.");
  }

  const centroId = id.slice(0, separador);
  const elementoId = id.slice(separador + 1);

  const centro = await findCentroById(centroId);

  if (!centro) {
    throw notFound("El centro de acopio no existe.");
  }

  const elementos = await findElementos();
  const elemento = elementos.find((candidato) => candidato.id === elementoId);
  if (!elemento) {
    throw notFound("El elemento de donación no existe.");
  }

  const necesidad: Necesidad = {
    id,
    centroId,
    centroNombre: centro.nombre,
    elementoId,
    categoria: elemento.categoria,
    elemento: elemento.nombre,
    estado,
    actualizadoEn: new Date().toISOString(),
  };

  await guardarNecesidad(necesidad);

  return toNecesidadPublica(necesidad, elemento.mensaje);
}
