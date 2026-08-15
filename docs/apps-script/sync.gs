/**
 * VolBogotá — sincronización de la hoja maestra hacia el backend.
 *
 * Va pegado en la hoja: Extensiones → Apps Script → pega este archivo.
 * Luego, en Configuración del proyecto → Propiedades del script, agrega:
 *
 *   API_URL     https://tu-despliegue.vercel.app     (sin barra final)
 *   HOOK_TOKEN  el valor de SHEETS_HOOK_TOKEN del .env
 *   SHEET_ID    el id de esta hoja, el trozo de su URL entre /d/ y /edit
 *
 * SHEET_ID no es opcional si quieres que el backend escriba acá: dentro de un
 * doPost no existe la "hoja activa" y sin el id no hay a qué libro abrir.
 *
 * Opcional, para probar contra un backend local expuesto por un túnel:
 *
 *   API_URL2    https://xxxxx.lhr.life                (sin barra final)
 *
 * Con las dos puestas se manda a las dos, y son independientes: que una esté
 * caída no impide que la otra reciba. La que escribe en la hoja es API_URL,
 * porque cada backend genera su propio código de reserva y en la celda solo
 * cabe uno. Bórrala para dejar de mandar al local; el menú «¿A dónde estoy
 * sincronizando?» dice cuáles están activas.
 *
 * Y en Activadores (el reloj de la izquierda) → Añadir activador:
 *   función  alEditar   · desde hoja de cálculo · Al editar
 *   función  alCambiar  · desde hoja de cálculo · Al cambiar
 *
 * El segundo existe porque el primero no ve las filas borradas: `alEditar` solo
 * responde a cambios de contenido, y borrar una fila es un cambio de estructura.
 *
 * Tiene que ser un activador INSTALABLE, no la función simple `onEdit`: los
 * activadores simples no pueden hacer peticiones de red, así que un `onEdit`
 * normal nunca llamaría al backend.
 *
 * Cada hoja va por su lado y a su propio endpoint: `Centros` describe el punto
 * (dónde queda, qué cupo tiene nominalmente) y `Turnos` es lo único que crea un
 * turno reservable. Editar un cupo en `Centros` ya no relee el tablero.
 *
 * Para la dirección contraria (que el backend escriba en la hoja), despliega:
 * Implementar → Nueva implementación → Aplicación web, con
 *
 *   Ejecutar como       Yo
 *   Quién tiene acceso  Cualquiera
 *
 * Las dos cosas son necesarias: quien llama es el backend, que no tiene sesión
 * de Google. "Cualquiera con cuenta de Google" devolvería un redirect al login,
 * y "el usuario que accede" no tendría permiso para escribir esta hoja. Quien
 * autoriza de verdad es HOOK_TOKEN, que `doPost` valida antes de tocar nada.
 *
 * La URL del despliegue va en SHEETS_WEBHOOK_URL del backend.
 */

var HOJA_CENTROS = "Centros";
var HOJA_RESERVAS = "Reservas";
var HOJA_TURNOS = "Turnos";
var HOJA_DONACIONES = "Donaciones";
/**
 * La pestaña de bancos, por sus dos nombres.
 *
 * Se llama «Bancos de Sangre» en plural, pero su primera columna es «Banco de
 * Sangre» en singular, y confundirlas cuesta caro: con el nombre equivocado
 * `alEditar` no reconoce la hoja y el menú lanza «no encontré la hoja», sin que
 * nada más se rompa — el módulo simplemente no sincroniza nunca.
 *
 * Aceptar los dos evita que un renombre en cualquier dirección lo apague.
 */
var HOJAS_SANGRE = ["Bancos de Sangre", "Banco de Sangre"];

/**
 * Columnas de `Centros` que, al editarse, sincronizan solas.
 *
 * Son las que cambian lo que el voluntario ve: si el punto sigue autorizado,
 * cuántos cupos tiene en cada jornada, y qué le advierte el punto antes de que
 * se desplace.
 *
 * `Observaciones` entró después. Estaba fuera cuando editar un cupo releía el
 * tablero entero y costaba veinte segundos, así que corregir una tilde no valía
 * ese precio; ahora esta hoja va sola a su endpoint y sale barato. Además es
 * texto operativo que cambia en caliente — un horario que se corrió, un punto
 * que pide llevar marcador — y no sirve de nada si tarda en publicarse.
 *
 * Dirección, localidad y link siguen fuera: se corrigen una vez y la web no
 * cambia de comportamiento por ellos. Para eso está el menú.
 */
var COLUMNAS_QUE_SINCRONIZAN = [
  "Activo",
  "Cupos AM",
  "Cupos TARDE",
  "Cupos PM",
  "Cupos MADRUGADA",
  "Cupos Noche",
  "Observaciones",
];

/**
 * Columnas de `Turnos` que, al editarse, sincronizan solas.
 *
 * `Reservados` no está y no puede estar: esa columna la escribe el backend, y
 * ponerla acá haría que cada reserva reenviara el tablero entero.
 */
var COLUMNAS_QUE_SINCRONIZAN_TURNOS = ["Cupos totales", "Horario", "Jornada"];

/**
 * Columnas de `Banco de Sangre` que, al editarse, sincronizan solas.
 *
 * Solo las que cambian lo que un donante decide: si el banco está recibiendo y
 * qué tipos. Corregir una dirección o un horario no reenvía nada — para eso está
 * el menú, igual que en `Centros`.
 */
var COLUMNAS_QUE_SINCRONIZAN_SANGRE = ["Recibiendo hoy", "Tipo de Sangre", "Activo"];

/**
 * Columnas de `Reservas` que, al editarse, sincronizan solas.
 *
 * Son las dos que un coordinador cambia en la puerta. El resto de la fila la
 * escribe el backend, y `Validación` la escribimos nosotros al contestar.
 */
var COLUMNAS_QUE_SINCRONIZAN_RESERVAS = ["Asistencia", "Estado"];

/** Encabezados que identifican cada hoja. */
var OBLIGATORIAS_CENTROS = ["Dirección", "Cupos AM"];
var OBLIGATORIAS_TURNOS = ["Fecha", "Cupos totales"];
var OBLIGATORIAS_SANGRE = ["Banco de Sangre", "Tipo de Sangre"];

/**
 * Único disparador automático: editar una columna que cambia lo que se ofrece.
 *
 * Antes salía en cualquier edición, incluidas las que hace el propio backend al
 * escribir en `Reservas` — eso devolvía esas filas al backend y las marcaba como
 * pendientes, un ida y vuelta que no llevaba a ninguna parte. Ahora cada hoja
 * declara qué columnas la disparan, y ninguna incluye las que escribe el
 * backend.
 */
function alEditar(e) {
  if (!e || !e.range) return;

  var hoja = e.range.getSheet();
  var nombre = hoja.getName();

  if (nombre === HOJA_CENTROS) {
    alEditarHoja(e, hoja, OBLIGATORIAS_CENTROS, COLUMNAS_QUE_SINCRONIZAN, sincronizarCentros);
  } else if (nombre === HOJA_TURNOS) {
    alEditarHoja(e, hoja, OBLIGATORIAS_TURNOS, COLUMNAS_QUE_SINCRONIZAN_TURNOS, sincronizarTurnos);
  } else if (nombre === HOJA_DONACIONES) {
    alEditarDonaciones(e, hoja);
  } else if (esHojaDeSangre(nombre)) {
    alEditarHoja(
      e,
      hoja,
      OBLIGATORIAS_SANGRE,
      COLUMNAS_QUE_SINCRONIZAN_SANGRE,
      sincronizarBancosSangre,
    );
  } else if (nombre === HOJA_RESERVAS) {
    alEditarReservas(e, hoja);
  }
}

/**
 * Segundo activador, para lo que `alEditar` no puede ver.
 *
 * `alEditar` responde a cambios de CONTENIDO de celdas. Borrar una fila es un
 * cambio de ESTRUCTURA, y Apps Script lo manda a `onChange` — otro activador,
 * con su propio evento. Sin esto, borrar un banco de la hoja lo dejaba vivo en
 * la web hasta que alguien se acordara del menú.
 *
 * Limpiar las celdas en vez de borrar la fila tampoco servía, y por otra razón:
 * `alEditarHoja` exige que la fila todavía tenga nombre para disparar, así que
 * borrar el nombre apagaba el único disparador que quedaba.
 *
 * Solo `REMOVE_ROW`. Insertar una fila vacía no cambia nada — cuando la llenen,
 * `alEditar` se encarga.
 *
 * Y solo la hoja de bancos, a propósito: `Centros` y `Turnos` tienen el mismo
 * hueco y el mismo arreglo, pero ampliarlo acá metería en este PR el
 * comportamiento de dos módulos que no le corresponden.
 *
 * Hay que crear el activador a mano, una vez:
 *   Activadores → Añadir activador → función `alCambiar` · Al cambiar
 */
function alCambiar(e) {
  if (!e || e.changeType !== "REMOVE_ROW") return;

  // El evento de `onChange` no dice en qué hoja pasó; la activa es la que se
  // estaba editando.
  var libroActual = e.source || SpreadsheetApp.getActiveSpreadsheet();
  if (!libroActual) return;

  var hoja = libroActual.getActiveSheet();
  if (!hoja || !esHojaDeSangre(hoja.getName())) return;

  // La hoja entera, como siempre: el backend desactiva los que ya no aparecen,
  // y eso es justo lo que hace falta cuando lo que pasó fue una baja.
  sincronizarBancosSangre();
}

function alEditarHoja(e, hoja, obligatorias, columnasQueSincronizan, sincronizar) {
  var mapa = mapearEncabezados(hoja, obligatorias);

  // Un pegado abarca varias celdas: basta con que el rango toque una columna.
  var primera = e.range.getColumn();
  var ultima = primera + e.range.getNumColumns() - 1;

  if (!tocaAlgunaColumna(mapa, columnasQueSincronizan, primera, ultima)) return;

  var colNombre =
    mapa.columna("Punto de acopio") || mapa.columna("Centro") || mapa.columna("Banco de Sangre");
  if (!colNombre) return;

  var desde = e.range.getRow();
  var hasta = desde + e.range.getNumRows() - 1;

  // Vaciar una celda dispara igual que llenarla; lo que se exige es que la fila
  // sea un punto, porque debajo de la tabla viven las notas al pie.
  for (var fila = Math.max(desde, mapa.encabezado + 1); fila <= hasta; fila++) {
    if (normalizar(hoja.getRange(fila, colNombre).getValue()) !== "") {
      sincronizar();
      return;
    }
  }
}

function tocaAlgunaColumna(mapa, columnas, primera, ultima) {
  for (var i = 0; i < columnas.length; i++) {
    var columna = mapa.columna(columnas[i]);
    if (columna && columna >= primera && columna <= ultima) return true;
  }

  return false;
}

/** Menú manual, para reenviar todo sin esperar a una edición. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("VolBogotá")
    .addItem("Sincronizar centros", "sincronizarCentros")
    .addItem("Sincronizar turnos", "sincronizarTurnos")
    .addItem("Sincronizar donaciones", "sincronizarDonaciones")
    .addItem("Sincronizar bancos de sangre", "sincronizarBancosSangre")
    .addItem("Sincronizar todas las reservas", "sincronizarTodasLasReservas")
    .addSeparator()
    .addItem("¿A dónde estoy sincronizando?", "dondeEstoySincronizando")
    .addToUi();
}

// --- Centros y turnos -----------------------------------------------------

/**
 * Manda solo `Centros`.
 *
 * Antes las dos hojas viajaban juntas, porque el backend derivaba los turnos
 * del producto de puntos × fechas × jornadas y reconstruir desde una sola
 * pisaba lo que decía la otra. Ahora `Turnos` crea sus propios turnos, así que
 * editar un cupo acá ya no relee el tablero entero — que era de dónde salían
 * los veinte segundos.
 */
function sincronizarCentros() {
  var hoja = hojaPorNombre(HOJA_CENTROS);
  var mapa = mapearEncabezados(hoja, ["Dirección", "Cupos AM"]);
  var tabla = leerTabla(hoja, mapa);

  var colNombre = mapa.columna("Punto de acopio") || mapa.columna("Centro");
  var filas = [];

  for (var i = 0; i < tabla.length; i++) {
    var nombre = tabla[i].texto(colNombre);
    if (!nombre) continue;

    filas.push({
      puntoDeAcopio: nombre,
      direccion: tabla[i].texto(mapa.columna("Dirección")),
      localidad: tabla[i].texto(mapa.columna("Localidad")),
      horarioOficial: tabla[i].texto(mapa.columna("Horario oficial del punto")),
      cuposAm: tabla[i].texto(mapa.columna("Cupos AM")),
      cuposTarde: tabla[i].texto(mapa.columna("Cupos TARDE")),
      cuposPm: tabla[i].texto(mapa.columna("Cupos PM")),
      cuposMadrugada: tabla[i].texto(mapa.columna("Cupos MADRUGADA")),
      // Ausente en las hojas que no reinstauraron la noche: el backend la toma como 0.
      cuposNoche: tabla[i].texto(mapa.columna("Cupos Noche")),
      actividades: tabla[i].texto(mapa.columna("Actividades habilitadas")),
      linkMaps: tabla[i].texto(mapa.columna("Link Google Maps")),
      activo: tabla[i].texto(mapa.columna("Activo")),
      observaciones: tabla[i].texto(mapa.columna("Observaciones")),
    });
  }

  if (filas.length === 0) return;

  // El backend descarta la fila TOTAL y las notas al pie; acá las mandamos
  // todas para no duplicar esa regla en dos sitios.
  llamar("/api/hooks/sheets/centros", { filas: filas });
}

/**
 * Manda solo `Turnos` — la única hoja que crea un turno.
 *
 * Va entera y no solo la fila editada: el backend reemplaza el tablero con lo
 * que reciba, y una fila borrada tiene que poder cerrarse.
 *
 * `Cupos totales` puede traer una fórmula que busca la capacidad en `Centros` o
 * un número escrito encima; acá llega el valor calculado en los dos casos, que
 * es lo que permite que una sola columna cargue lo nominal y la excepción.
 */
function sincronizarTurnos() {
  var tablero = leerTablero();
  if (!tablero.hoja || tablero.filas.length === 0) return;

  var respuesta = llamar("/api/hooks/sheets/turnos", { filas: tablero.filas });

  escribirValidacionTurnos(tablero, respuesta);
}

/**
 * Lee el tablero completo.
 *
 * Devuelve `hoja: null` si el libro todavía no tiene `Turnos` o si no se le
 * reconocen los encabezados, para que un libro a medio montar no reviente.
 */
function leerTablero() {
  var hoja = libro().getSheetByName(HOJA_TURNOS);
  if (!hoja) return { hoja: null, mapa: null, filas: [] };

  var mapa;
  try {
    mapa = mapearEncabezados(hoja, OBLIGATORIAS_TURNOS);
  } catch (error) {
    Logger.log("La hoja Turnos no tiene los encabezados esperados: " + error);
    return { hoja: null, mapa: null, filas: [] };
  }

  var colPunto = mapa.columna("Punto de acopio") || mapa.columna("Centro");
  var tabla = leerTabla(hoja, mapa);
  var filas = [];

  for (var i = 0; i < tabla.length; i++) {
    var punto = tabla[i].texto(colPunto);
    var fecha = tabla[i].texto(mapa.columna("Fecha"));
    var jornada = tabla[i].texto(mapa.columna("Jornada"));

    // Una fila a medio llenar todavía no describe un turno. No es un error: es
    // el renglón que un coordinador acaba de empezar a escribir.
    if (!punto || !fecha || !jornada) continue;

    filas.push({
      fila: tabla[i].fila,
      puntoDeAcopio: punto,
      fecha: fecha,
      jornada: jornada,
      // Tal cual: un turno que cruza la medianoche dice «Sábado-Domingo», y eso
      // la fecha sola no lo puede expresar.
      dia: tabla[i].texto(mapa.columna("Día")),
      // Vacío: el backend usa el horario por defecto de la jornada.
      horario: tabla[i].texto(mapa.columna("Horario")),
      // Vacío no cierra nada: la fórmula no está arrastrada hasta abajo.
      estadoCupo: tabla[i].texto(mapa.columna("Estado del cupo")),
      cuposTotales: tabla[i].texto(mapa.columna("Cupos totales")),
    });
  }

  return { hoja: hoja, mapa: mapa, filas: filas };
}

/**
 * Deja en `Validación` por qué una fila no se aplicó.
 *
 * La columna es opcional: si el tablero no la tiene, el veredicto queda en el
 * log y el resto de la sincronización sigue igual.
 */
function escribirValidacionTurnos(tablero, respuesta) {
  var hoja = tablero.hoja;
  var mapa = tablero.mapa;
  var filas = tablero.filas;

  if (!mapa.columna("Validación")) return;

  // Igual que en `Reservas`: si el backend no contestó, no se pisa la celda con
  // un veredicto que no tenemos.
  if (!respuesta || !respuesta.success) {
    Logger.log("El backend no respondió; no se escribe la validación de los turnos.");
    return;
  }

  var rechazadas = respuesta.data.rechazadas || [];
  var motivos = {};

  for (var i = 0; i < rechazadas.length; i++) {
    motivos[rechazadas[i].fila] = rechazadas[i].motivo;
  }

  // De un tirón y no celda por celda: un tablero de ochenta filas eran ochenta
  // escrituras, cada una un viaje a Google. Se escribe el bloque contiguo que
  // va de la primera fila enviada a la última, dejando intactas las de en medio
  // que no mandamos.
  var colValidacion = mapa.columna("Validación");
  var desde = filas[0].fila;
  var hasta = filas[filas.length - 1].fila;
  var actuales = hoja.getRange(desde, colValidacion, hasta - desde + 1, 1).getValues();

  for (var j = 0; j < filas.length; j++) {
    actuales[filas[j].fila - desde][0] = motivos[filas[j].fila] || "OK";
  }

  hoja.getRange(desde, colValidacion, actuales.length, 1).setValues(actuales);
}

// --- Donaciones -------------------------------------------------------------

/**
 * `Donaciones` has no fixed columns to watch: every centre gets its own, and
 * the programme adds or retires one from time to time. What arms the sync
 * here is simpler than for `Centros` — any edit past `Elemento`, on a row that
 * actually names an item. `Categoría`/`Elemento` themselves are excluded on
 * purpose: renaming an item is a catalogue edit, and the catalogue is not
 * this sheet's job — it's seeded separately and stays stable.
 */
function alEditarDonaciones(e, hoja) {
  var mapa = mapearEncabezados(hoja, ["Categoría", "Elemento"]);
  var colElemento = mapa.columna("Elemento");
  if (!colElemento) return;

  var primera = e.range.getColumn();
  if (primera <= colElemento) return;

  var desde = e.range.getRow();
  var hasta = desde + e.range.getNumRows() - 1;

  for (var fila = Math.max(desde, mapa.encabezado + 1); fila <= hasta; fila++) {
    if (normalizar(hoja.getRange(fila, colElemento).getValue()) !== "") {
      sincronizarDonaciones();
      return;
    }
  }
}

/**
 * Sends the whole `Donaciones` sheet, not just the edited cell.
 *
 * One POST per edit is simpler than isolating a single cell, and 56 items ×
 * 6 points is nothing to resend — the same trade `sincronizarCentros` and
 * `sincronizarTurnos` already make for their own sheets.
 */
function sincronizarDonaciones() {
  var hoja = hojaPorNombre(HOJA_DONACIONES);
  var mapa = mapearEncabezados(hoja, ["Categoría", "Elemento"]);
  var colCategoria = mapa.columna("Categoría");
  var colElemento = mapa.columna("Elemento");

  var columnasCentro = [];
  var ultimaColumna = hoja.getLastColumn();
  var encabezados = hoja.getRange(mapa.encabezado, 1, 1, ultimaColumna).getValues()[0];

  for (var col = colElemento + 1; col <= ultimaColumna; col++) {
    var nombreCentro = valorDeCelda(encabezados[col - 1]);
    if (nombreCentro) columnasCentro.push({ columna: col, nombre: nombreCentro });
  }

  if (columnasCentro.length === 0) return;

  var tabla = leerTabla(hoja, mapa);
  var filas = [];

  for (var f = 0; f < tabla.length; f++) {
    var categoria = tabla[f].texto(colCategoria);
    var elemento = tabla[f].texto(colElemento);
    if (!categoria || !elemento) continue;

    var estados = {};
    for (var i = 0; i < columnasCentro.length; i++) {
      estados[columnasCentro[i].nombre] = tabla[f].texto(columnasCentro[i].columna);
    }

    filas.push({ fila: tabla[f].fila, categoria: categoria, elemento: elemento, estados: estados });
  }

  if (filas.length === 0) return;

  llamar("/api/hooks/sheets/donaciones", { filas: filas });
}

// --- Banco de sangre ------------------------------------------------------

/**
 * Manda la hoja `Banco de Sangre` completa.
 *
 * Como en las demás, va todo y no solo la fila editada: el backend desactiva los
 * bancos que ya no aparecen, así que un envío parcial dejaría fuera de servicio
 * a los que no viajaron.
 *
 * Cada envío refresca `actualizadoEn` en el backend, y eso no es un detalle: el
 * front deriva de ahí el «sin reporte hoy». Un coordinador que abre la hoja y
 * confirma la lista sin cambiar una celda igual necesita que el envío ocurra —
 * el valor no cambió, pero el hecho de que alguien lo mirara sí, y eso es lo que
 * se le está diciendo al donante.
 */
function esHojaDeSangre(nombre) {
  for (var i = 0; i < HOJAS_SANGRE.length; i++) {
    if (normalizar(nombre) === normalizar(HOJAS_SANGRE[i])) return true;
  }

  return false;
}

/** La pestaña de bancos, con cualquiera de sus dos nombres. */
function hojaDeSangre() {
  var libroActual = libro();

  for (var i = 0; i < HOJAS_SANGRE.length; i++) {
    var hoja = libroActual.getSheetByName(HOJAS_SANGRE[i]);
    if (hoja) return hoja;
  }

  throw new Error("No encontré la hoja de bancos ('" + HOJAS_SANGRE.join("' ni '") + "').");
}

function sincronizarBancosSangre() {
  var hoja = hojaDeSangre();
  var mapa = mapearEncabezados(hoja, OBLIGATORIAS_SANGRE);
  var colNombre = mapa.columna("Banco de Sangre");
  var tabla = leerTabla(hoja, mapa);
  var filas = [];

  for (var i = 0; i < tabla.length; i++) {
    var nombre = tabla[i].texto(colNombre);
    if (!nombre) continue;

    filas.push({
      bancoDeSangre: nombre,
      direccion: tabla[i].texto(mapa.columna("Dirección")),
      localidad: tabla[i].texto(mapa.columna("Localidad")),
      // La columna se llamó "del punto" antes de llamarse "del banco"; aceptar
      // las dos evita que un renombre vacíe el horario sin que nadie se entere.
      horarioOficial:
        tabla[i].texto(mapa.columna("Horario oficial del banco")) ||
        tabla[i].texto(mapa.columna("Horario oficial del punto")),
      tipoDeSangre: tabla[i].texto(mapa.columna("Tipo de Sangre")),
      linkMaps: tabla[i].texto(mapa.columna("Link Google Maps")),
      recibiendoHoy: tabla[i].texto(mapa.columna("Recibiendo hoy")),
      activo: tabla[i].texto(mapa.columna("Activo")),
    });
  }

  if (filas.length === 0) return;

  llamar("/api/hooks/sheets/sangre", { filas: filas });
}

// --- Reservas -------------------------------------------------------------

/**
 * Manda solo las filas que el coordinador acaba de tocar.
 *
 * A diferencia de `Centros` y `Turnos`, acá no se reenvía la hoja entera: cada
 * fila abre una transacción de reserva en el backend, así que mandar las mil
 * por marcar una asistencia sería mucho más caro que releer un tablero.
 *
 * Una fila sin `ID` se salta: sin código, el backend la leería como una
 * inscripción nueva y la crearía. Un renglón a medio escribir no debe nacer
 * como reserva por haber tocado su celda de asistencia.
 */
function alEditarReservas(e, hoja) {
  var mapa = mapearEncabezados(hoja, ["Nombre completo", "Celular"]);

  var primera = e.range.getColumn();
  var ultima = primera + e.range.getNumColumns() - 1;

  if (!tocaAlgunaColumna(mapa, COLUMNAS_QUE_SINCRONIZAN_RESERVAS, primera, ultima)) return;

  var colId = mapa.columna("ID");
  if (!colId) return;

  var desde = e.range.getRow();
  var hasta = desde + e.range.getNumRows() - 1;
  var filas = [];

  for (var fila = Math.max(desde, mapa.encabezado + 1); fila <= hasta; fila++) {
    if (normalizar(hoja.getRange(fila, colId).getValue()) !== "") filas.push(fila);
  }

  if (filas.length > 0) enviarReservas(hoja, mapa, filas);
}

function sincronizarReservas(fila) {
  var hoja = hojaPorNombre(HOJA_RESERVAS);
  var mapa = mapearEncabezados(hoja, ["Nombre completo", "Celular"]);

  if (fila <= mapa.encabezado) return;

  enviarReservas(hoja, mapa, [fila]);
}

function sincronizarTodasLasReservas() {
  var hoja = hojaPorNombre(HOJA_RESERVAS);
  var mapa = mapearEncabezados(hoja, ["Nombre completo", "Celular"]);
  var filas = [];

  for (var fila = mapa.encabezado + 1; fila <= hoja.getLastRow(); fila++) {
    if (leer(hoja, fila, mapa.columna("Nombre completo"))) filas.push(fila);
  }

  if (filas.length > 0) enviarReservas(hoja, mapa, filas);
}

function enviarReservas(hoja, mapa, numerosDeFila) {
  var filas = [];

  for (var i = 0; i < numerosDeFila.length; i++) {
    var fila = numerosDeFila[i];
    var nombre = leer(hoja, fila, mapa.columna("Nombre completo"));
    if (!nombre) continue;

    filas.push({
      fila: fila,
      codigo: leer(hoja, fila, mapa.columna("ID")),
      nombreCompleto: nombre,
      celular: leer(hoja, fila, mapa.columna("Celular")),
      edad: leer(hoja, fila, mapa.columna("Edad")),
      idTurno: leer(hoja, fila, mapa.columna("ID_Turno")),
      puntoDeAcopio: leer(hoja, fila, mapa.columna("Punto de acopio")),
      fechaJornada: leer(hoja, fila, mapa.columna("Fecha jornada")),
      jornada: leer(hoja, fila, mapa.columna("Jornada")),
      autorizoDatos: leer(hoja, fila, mapa.columna("Autorizó datos")),
      contactoEmergencia: leer(hoja, fila, mapa.columna("Contacto emergencia")),
      celEmergencia: leer(hoja, fila, mapa.columna("Cel. emergencia")),
      eps: leer(hoja, fila, mapa.columna("EPS")),
      estado: leer(hoja, fila, mapa.columna("Estado")),
      // La digitan los coordinadores en la puerta: solo se lee, nunca se escribe.
      asistencia: leer(hoja, fila, mapa.columna("Asistencia")),
    });
  }

  if (filas.length === 0) return;

  var respuesta = llamar("/api/hooks/sheets/reservas", { filas: filas });

  // Un backend inalcanzable se registra y ya: pisar la celda de Validación con
  // un aviso nuestro borraba lo que la hoja calcula ahí por su cuenta.
  if (!respuesta || !respuesta.success) {
    Logger.log("El backend no respondió; no se escribe nada en la hoja.");
    return;
  }

  escribirResultados(hoja, mapa, respuesta.data.resultados);
}

/**
 * Devuelve a la hoja lo que contestó el backend.
 *
 * El código va primero: es lo que hace que un reenvío de la misma fila
 * actualice en vez de intentar crear otra vez.
 */
function escribirResultados(hoja, mapa, resultados) {
  var colId = mapa.columna("ID");
  var colValidacion = mapa.columna("Validación");
  var colEstado = mapa.columna("Estado");

  for (var i = 0; i < resultados.length; i++) {
    var resultado = resultados[i];

    if (colId && resultado.codigo) hoja.getRange(resultado.fila, colId).setValue(resultado.codigo);
    if (colValidacion) hoja.getRange(resultado.fila, colValidacion).setValue(resultado.validacion);
    if (colEstado && resultado.estado) {
      hoja.getRange(resultado.fila, colEstado).setValue(resultado.estado);
    }
  }
}

// --- Entrada: el backend escribe en la hoja -------------------------------

/**
 * Recibe reservas del backend y las deja en la hoja `Reservas`.
 *
 * Es la otra mitad del control de dos lados: sin esto, un voluntario que se
 * inscribe en la web nunca aparece en la lista que los coordinadores leen en la
 * portería.
 *
 * No hay riesgo de bucle: los activadores de edición responden a acciones de
 * una persona, no a escrituras hechas por un script, así que lo que se escriba
 * acá no vuelve a disparar `alEditar`.
 */
/**
 * Diagnóstico: abre la URL del despliegue en el navegador.
 *
 * Existe para responder la pregunta que más cuesta: si la URL sirve la versión
 * con este código o una anterior. Apps Script sirve la versión *desplegada*, no
 * la guardada, así que pegar el archivo y guardar no basta — hay que crear una
 * versión nueva. Si acá ves JSON, el despliegue está al día; si ves HTML de
 * Google, no lo está.
 */
function doGet() {
  return respuesta({
    success: true,
    data: {
      servicio: "VolBogotá — sync de la hoja",
      escribeReservas: true,
      hoja: libro().getName(),
    },
  });
}

function doPost(e) {
  try {
    var cuerpo = JSON.parse(e.postData.contents);

    if (cuerpo.token !== PropertiesService.getScriptProperties().getProperty("HOOK_TOKEN")) {
      return respuesta({ success: false, error: "Token inválido." });
    }

    var reservas = cuerpo.reservas || [];
    var turnos = cuerpo.turnos || [];
    if (reservas.length === 0 && turnos.length === 0) {
      return respuesta({ success: true, data: { escritas: 0 } });
    }

    // Un candado: dos inscripciones simultáneas podrían calcular la misma fila
    // libre y una sobreescribiría a la otra.
    var candado = LockService.getScriptLock();
    candado.waitLock(20000);

    try {
      var escritas = 0;
      if (reservas.length) escritas += escribirReservas(reservas);
      if (turnos.length) escritas += escribirTurnos(turnos);

      return respuesta({ success: true, data: { escritas: escritas } });
    } finally {
      candado.releaseLock();
    }
  } catch (error) {
    // El backend no puede arreglar nada con un stack trace, pero sí necesita
    // saber que no quedó escrito para reintentarlo con /api/hooks/sheets/push.
    Logger.log("doPost falló: " + error);
    return respuesta({ success: false, error: String(error) });
  }
}

function escribirReservas(reservas) {
  var hoja = hojaPorNombre(HOJA_RESERVAS);
  var mapa = mapearEncabezados(hoja, ["Nombre completo", "Celular"]);
  var indice = indicePorCodigo(hoja, mapa);
  var escritas = 0;

  for (var i = 0; i < reservas.length; i++) {
    var reserva = reservas[i];
    var fila = indice[reserva.codigo];

    // Sin fila para ese código es una inscripción que nació en la web: va al
    // final. Con fila, es una que ya estaba y solo cambió de estado u horas.
    if (!fila) {
      fila = hoja.getLastRow() + 1;
      indice[reserva.codigo] = fila;
    }

    escribirCelda(hoja, mapa, fila, "ID", reserva.codigo);
    escribirCelda(hoja, mapa, fila, "Fecha/hora registro", reserva.fechaRegistro);
    escribirCelda(hoja, mapa, fila, "Nombre completo", reserva.nombreCompleto);
    escribirCelda(hoja, mapa, fila, "Celular", reserva.celular);
    escribirCelda(hoja, mapa, fila, "Edad", reserva.edad);
    escribirCelda(hoja, mapa, fila, "Punto de acopio", reserva.puntoDeAcopio);
    escribirCelda(hoja, mapa, fila, "Fecha jornada", reserva.fechaJornada);
    escribirCelda(hoja, mapa, fila, "Jornada", reserva.jornada);
    escribirCelda(hoja, mapa, fila, "ID_Turno", reserva.idTurno);
    escribirCelda(hoja, mapa, fila, "Autorizó datos", reserva.autorizoDatos);
    escribirCelda(hoja, mapa, fila, "Contacto emergencia", reserva.contactoEmergencia);
    escribirCelda(hoja, mapa, fila, "Cel. emergencia", reserva.celEmergencia);
    escribirCelda(hoja, mapa, fila, "EPS", reserva.eps);
    escribirCelda(hoja, mapa, fila, "Estado", reserva.estado);
    escribirCelda(hoja, mapa, fila, "Validación", reserva.validacion);

    escritas++;
  }

  return escritas;
}

/** Código de reserva → número de fila, para no recorrer la hoja por cada una. */
/**
 * Refleja en `Turnos` el contador que lleva el backend.
 *
 * Solo viaja `Reservados`: disponibles, ocupación y estado son fórmulas sobre
 * esa celda, así que la hoja los recalcula y no hay una segunda copia de la
 * aritmética que se pueda desfasar.
 */
function escribirTurnos(turnos) {
  var hoja = hojaPorNombre(HOJA_TURNOS);
  var mapa = mapearEncabezados(hoja, ["ID_Turno", "Reservados"]);
  var indice = indicePorIdTurno(hoja, mapa);
  var escritas = 0;

  for (var i = 0; i < turnos.length; i++) {
    // Un turno que el tablero no tiene no se agrega: esa hoja la arma ella sola
    // desde `Centros`, y una fila suelta al final le rompería las fórmulas.
    var fila = indice[String(turnos[i].idTurno || "").trim()];
    if (!fila) continue;

    escribirCelda(hoja, mapa, fila, "Reservados", turnos[i].reservados);
    escritas++;
  }

  return escritas;
}

function indicePorIdTurno(hoja, mapa) {
  var colId = mapa.columna("ID_Turno");
  var indice = {};
  if (!colId || hoja.getLastRow() <= mapa.encabezado) return indice;

  var alto = hoja.getLastRow() - mapa.encabezado;
  var valores = hoja.getRange(mapa.encabezado + 1, colId, alto, 1).getValues();

  for (var i = 0; i < valores.length; i++) {
    var id = String(valores[i][0] || "").trim();
    if (id) indice[id] = mapa.encabezado + 1 + i;
  }

  return indice;
}

function indicePorCodigo(hoja, mapa) {
  var colId = mapa.columna("ID");
  var indice = {};
  if (!colId || hoja.getLastRow() <= mapa.encabezado) return indice;

  var alto = hoja.getLastRow() - mapa.encabezado;
  var valores = hoja.getRange(mapa.encabezado + 1, colId, alto, 1).getValues();

  for (var i = 0; i < valores.length; i++) {
    var codigo = String(valores[i][0] || "").trim();
    if (codigo) indice[codigo] = mapa.encabezado + 1 + i;
  }

  return indice;
}

/**
 * Escribe una celda solo si esa columna existe y hay algo que poner.
 *
 * Las columnas que el contrato no modela — Actividad, EPS, contacto de
 * emergencia, Notas — se dejan intactas: son del coordinador, no nuestras, y
 * pisarlas con vacío borraría lo que alguien escribió a mano.
 */
function escribirCelda(hoja, mapa, fila, titulo, valor) {
  var columna = mapa.columna(titulo);
  if (!columna) return;
  if (valor === null || valor === undefined || valor === "") return;

  hoja.getRange(fila, columna).setValue(valor);
}

function respuesta(datos) {
  return ContentService.createTextOutput(JSON.stringify(datos)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

// --- Utilidades -----------------------------------------------------------

/**
 * El libro sobre el que trabajamos.
 *
 * `getActiveSpreadsheet()` devuelve null dentro de un `doPost` o un `doGet`: la
 * "hoja activa" solo existe cuando el script corre desde su contenedor — un
 * menú o un activador —, no en una petición HTTP. Usarlo ahí hacía que la
 * escritura desde el backend fallara antes de tocar una celda.
 *
 * `SHEET_ID` sale de la URL de la hoja, entre `/d/` y `/edit`.
 */
function libro() {
  var id = PropertiesService.getScriptProperties().getProperty("SHEET_ID");
  if (id) return SpreadsheetApp.openById(id);

  var activa = SpreadsheetApp.getActiveSpreadsheet();
  if (activa) return activa;

  throw new Error(
    "Falta SHEET_ID en las propiedades del script. Sin él, el backend no puede " +
      "escribir en la hoja: una petición web no tiene hoja activa.",
  );
}

function hojaPorNombre(nombre) {
  var hoja = libro().getSheetByName(nombre);
  if (!hoja) throw new Error("No encontré la hoja '" + nombre + "'.");
  return hoja;
}

/**
 * Localiza la fila de encabezados y mapea cada columna por su título.
 *
 * Leer por título y no por posición: entre la primera y la segunda versión del
 * archivo el encabezado bajó una fila y aparecieron columnas nuevas, lo que
 * habría corrido todos los índices en silencio.
 */
function mapearEncabezados(hoja, obligatorias) {
  var maxFilas = Math.min(12, hoja.getLastRow());
  var maxColumnas = hoja.getLastColumn();

  for (var fila = 1; fila <= maxFilas; fila++) {
    var titulos = {};
    var valores = hoja.getRange(fila, 1, 1, maxColumnas).getValues()[0];

    for (var col = 0; col < valores.length; col++) {
      var texto = normalizar(valores[col]);
      if (texto) titulos[texto] = col + 1;
    }

    var completo = true;
    for (var i = 0; i < obligatorias.length; i++) {
      if (!titulos[normalizar(obligatorias[i])]) completo = false;
    }

    if (completo) {
      return {
        encabezado: fila,
        columna: function (titulo) {
          return titulos[normalizar(titulo)] || null;
        },
      };
    }
  }

  throw new Error("No encontré la fila de encabezados en '" + hoja.getName() + "'.");
}

/**
 * El título de la hoja vive dentro de la misma celda que el primer encabezado,
 * así que un `===` no encontraría "Punto de acopio". Se compara sin acentos,
 * en minúscula, y aceptando que el título esté contenido en la celda.
 */
function normalizar(valor) {
  if (valor === null || valor === undefined) return "";

  return String(valor).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function leer(hoja, fila, columna) {
  if (!columna) return null;

  return valorDeCelda(hoja.getRange(fila, columna).getValue());
}

function valorDeCelda(valor) {
  if (valor === null || valor === undefined || valor === "") return null;

  if (valor instanceof Date) return Utilities.formatDate(valor, "UTC", "yyyy-MM-dd");

  return String(valor).trim();
}

/**
 * Toda la tabla en una sola llamada.
 *
 * Cada `getRange().getValue()` es un viaje de ida y vuelta a los servidores de
 * Google. Leer `Centros` y `Turnos` celda por celda eran unos seiscientos, que
 * es de donde salía el grueso de los veinte segundos; `getValues()` los deja en
 * uno. Cada fila expone `texto(columna)` con el mismo contrato que `leer`.
 */
function leerTabla(hoja, mapa) {
  var primeraFila = mapa.encabezado + 1;
  var alto = hoja.getLastRow() - mapa.encabezado;
  if (alto <= 0) return [];

  var valores = hoja.getRange(primeraFila, 1, alto, hoja.getLastColumn()).getValues();
  var tabla = [];

  for (var i = 0; i < valores.length; i++) {
    tabla.push(filaDeTabla(valores[i], primeraFila + i));
  }

  return tabla;
}

function filaDeTabla(valores, numero) {
  return {
    fila: numero,
    texto: function (columna) {
      // `columna` es 1-based, como todo lo que devuelve `mapa.columna`.
      return columna ? valorDeCelda(valores[columna - 1]) : null;
    },
  };
}

/**
 * Los backends a los que se sincroniza.
 *
 * `API_URL` es el de siempre; `API_URL2` es un segundo destino para probar
 * contra un backend local por un túnel. Cuando existen los dos se les manda a
 * ambos, y ninguno depende del otro: cada uno lleva su propio try/catch, así
 * que el local caído no impide que producción reciba, ni al revés.
 *
 * El primero de la lista es el que manda. Eso importa porque cada backend
 * genera su propio código de reserva, y en la celda solo cabe uno: escribir el
 * de un backend de pruebas dejaría a la hoja apuntando a una reserva que
 * producción no conoce. El secundario recibe los datos, y su respuesta se
 * registra en el log sin tocar la hoja.
 */
function destinos() {
  var props = PropertiesService.getScriptProperties();
  var lista = [];

  var principal = props.getProperty("API_URL");
  var prueba = props.getProperty("API_URL2");

  if (principal) lista.push({ nombre: "API_URL", url: principal });
  if (prueba) lista.push({ nombre: "API_URL2", url: prueba });

  return lista;
}

/** Menú: dice a qué backends está mandando la hoja y cuál manda. */
function dondeEstoySincronizando() {
  var lista = destinos();

  if (lista.length === 0) {
    SpreadsheetApp.getUi().alert(
      "Sincronizando contra",
      "Ninguno: falta API_URL en las propiedades del script.",
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
    return;
  }

  var lineas = [];
  for (var i = 0; i < lista.length; i++) {
    lineas.push(
      lista[i].nombre +
        (i === 0 ? "  (manda: su respuesta es la que se escribe en la hoja)" : "  (solo recibe)") +
        "\n" +
        lista[i].url,
    );
  }

  SpreadsheetApp.getUi().alert(
    "Sincronizando contra",
    lineas.join("\n\n"),
    SpreadsheetApp.getUi().ButtonSet.OK,
  );
}

/**
 * Manda a todos los destinos y devuelve la respuesta del primero.
 *
 * Un destino que falla no interrumpe a los demás: se registra y se sigue. Si el
 * que manda es el que falló, devuelve null y quien llama marca las filas como
 * pendientes.
 */
function llamar(ruta, cuerpo) {
  var lista = destinos();
  var token = PropertiesService.getScriptProperties().getProperty("HOOK_TOKEN");

  if (lista.length === 0 || !token) {
    throw new Error("Faltan API_URL (o API_URL2) o HOOK_TOKEN en las propiedades del script.");
  }

  var respuestaPrincipal = null;
  var alguienRespondio = false;

  for (var i = 0; i < lista.length; i++) {
    var datos = enviarA(lista[i], ruta, cuerpo);
    if (datos) alguienRespondio = true;
    if (i === 0) respuestaPrincipal = datos;
  }

  // Que ningún destino conteste no puede pasar por "Completed": es el síntoma
  // de una URL caída, y en silencio parece que la sincronización funcionó.
  if (!alguienRespondio) {
    throw new Error("Ningún backend respondió. Revisa API_URL / API_URL2: " + urlsDe(lista));
  }

  return respuestaPrincipal;
}

function urlsDe(lista) {
  var urls = [];
  for (var i = 0; i < lista.length; i++) urls.push(lista[i].nombre + "=" + lista[i].url);
  return urls.join(", ");
}

/** Una petición a un destino. Nunca lanza: devuelve null si no se pudo. */
function enviarA(destino, ruta, cuerpo) {
  try {
    var respuesta = UrlFetchApp.fetch(destino.url + ruta, {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-sheets-token": PropertiesService.getScriptProperties().getProperty("HOOK_TOKEN"),
      },
      payload: JSON.stringify(cuerpo),
      // Sin esto, un 4xx lanza una excepción y perdemos el mensaje de error, que
      // es justamente lo que hay que mostrarle al coordinador.
      muteHttpExceptions: true,
    });

    var texto = respuesta.getContentText();
    var datos = JSON.parse(texto);

    if (!datos.success) {
      Logger.log("Error de " + destino.nombre + ": " + texto);
    }

    return datos;
  } catch (error) {
    // Red caída, túnel muerto o una respuesta que no es JSON. El otro destino
    // sigue su camino.
    Logger.log("No se pudo llamar a " + destino.nombre + " (" + destino.url + "): " + error);
    return null;
  }
}
