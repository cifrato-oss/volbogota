/**
 * VolBogotá — sincronización de la hoja maestra hacia el backend.
 *
 * Va pegado en la hoja: Extensiones → Apps Script → pega este archivo.
 * Luego, en Configuración del proyecto → Propiedades del script, agrega:
 *
 *   API_URL     https://tu-despliegue.vercel.app     (sin barra final)
 *   HOOK_TOKEN  el valor de SHEETS_HOOK_TOKEN del .env
 *
 * Y en Activadores (el reloj de la izquierda) → Añadir activador:
 *   función  alEditar · desde hoja de cálculo · Al editar
 *
 * Tiene que ser un activador INSTALABLE, no la función simple `onEdit`: los
 * activadores simples no pueden hacer peticiones de red, así que un `onEdit`
 * normal nunca llamaría al backend.
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

/** Se dispara con cada edición. Solo actúa sobre las dos hojas que sincronizamos. */
function alEditar(e) {
  var hoja = e.range.getSheet();
  var nombre = hoja.getName();

  if (nombre === HOJA_CENTROS) {
    sincronizarCentros();
  } else if (nombre === HOJA_RESERVAS) {
    sincronizarReservas(e.range.getRow());
  }
}

/** Menú manual, para reenviar todo sin esperar a una edición. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("VolBogotá")
    .addItem("Sincronizar centros", "sincronizarCentros")
    .addItem("Sincronizar todas las reservas", "sincronizarTodasLasReservas")
    .addToUi();
}

// --- Centros --------------------------------------------------------------

function sincronizarCentros() {
  var hoja = hojaPorNombre(HOJA_CENTROS);
  var mapa = mapearEncabezados(hoja, ["Dirección", "Cupos AM"]);
  var filas = [];

  for (var fila = mapa.encabezado + 1; fila <= hoja.getLastRow(); fila++) {
    var nombre = leer(hoja, fila, mapa.columna("Punto de acopio") || mapa.columna("Centro"));
    if (!nombre) continue;

    filas.push({
      puntoDeAcopio: nombre,
      direccion: leer(hoja, fila, mapa.columna("Dirección")),
      localidad: leer(hoja, fila, mapa.columna("Localidad")),
      horarioOficial: leer(hoja, fila, mapa.columna("Horario oficial del punto")),
      cuposAm: leer(hoja, fila, mapa.columna("Cupos AM")),
      cuposPm: leer(hoja, fila, mapa.columna("Cupos PM")),
      cuposNoche: leer(hoja, fila, mapa.columna("Cupos Noche")),
      actividades: leer(hoja, fila, mapa.columna("Actividades habilitadas")),
      linkMaps: leer(hoja, fila, mapa.columna("Link Google Maps")),
      activo: leer(hoja, fila, mapa.columna("Activo")),
      observaciones: leer(hoja, fila, mapa.columna("Observaciones")),
    });
  }

  if (filas.length === 0) return;

  // El backend descarta la fila TOTAL y las notas al pie; acá las mandamos
  // todas para no duplicar esa regla en dos sitios.
  llamar("/api/hooks/sheets/centros", { filas: filas, fechas: fechasDelPrograma() });
}

/** Las fechas salen de la hoja Listas; si no están, el backend usa las ya cargadas. */
function fechasDelPrograma() {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Listas");
  if (!hoja) return undefined;

  var fechas = [];
  var valores = hoja.getRange(1, 3, hoja.getLastRow(), 1).getValues();

  for (var i = 0; i < valores.length; i++) {
    var valor = valores[i][0];
    if (valor instanceof Date) fechas.push(Utilities.formatDate(valor, "UTC", "yyyy-MM-dd"));
  }

  return fechas.length > 0 ? fechas : undefined;
}

// --- Reservas -------------------------------------------------------------

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
      estado: leer(hoja, fila, mapa.columna("Estado")),
      checkIn: leer(hoja, fila, mapa.columna("Check-in")),
      checkOut: leer(hoja, fila, mapa.columna("Check-out")),
    });
  }

  if (filas.length === 0) return;

  var respuesta = llamar("/api/hooks/sheets/reservas", { filas: filas });

  // El backend caído no puede costarle el registro a nadie: la hoja sigue
  // siendo operativa por sí sola. Se marcan las filas como pendientes y
  // "Sincronizar todas las reservas" las reconcilia cuando vuelva.
  if (!respuesta || !respuesta.success) {
    marcarPendientes(hoja, mapa, filas);
    return;
  }

  escribirResultados(hoja, mapa, respuesta.data.resultados);
}

var PENDIENTE = "Pendiente de sincronizar";

function marcarPendientes(hoja, mapa, filas) {
  var colValidacion = mapa.columna("Validación");
  if (!colValidacion) return;

  for (var i = 0; i < filas.length; i++) {
    hoja.getRange(filas[i].fila, colValidacion).setValue(PENDIENTE);
  }
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
function doPost(e) {
  try {
    var cuerpo = JSON.parse(e.postData.contents);

    if (cuerpo.token !== PropertiesService.getScriptProperties().getProperty("HOOK_TOKEN")) {
      return respuesta({ success: false, error: "Token inválido." });
    }

    var reservas = cuerpo.reservas || [];
    if (reservas.length === 0) {
      return respuesta({ success: true, data: { escritas: 0 } });
    }

    // Un candado: dos inscripciones simultáneas podrían calcular la misma fila
    // libre y una sobreescribiría a la otra.
    var candado = LockService.getScriptLock();
    candado.waitLock(20000);

    try {
      var escritas = escribirReservas(reservas);
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
    escribirCelda(hoja, mapa, fila, "Estado", reserva.estado);
    escribirCelda(hoja, mapa, fila, "Check-in", reserva.checkIn);
    escribirCelda(hoja, mapa, fila, "Check-out", reserva.checkOut);
    escribirCelda(hoja, mapa, fila, "Horas", reserva.horas);
    escribirCelda(hoja, mapa, fila, "Validación", reserva.validacion);

    escritas++;
  }

  return escritas;
}

/** Código de reserva → número de fila, para no recorrer la hoja por cada una. */
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

function hojaPorNombre(nombre) {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
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

  var valor = hoja.getRange(fila, columna).getValue();
  if (valor === null || valor === undefined || valor === "") return null;

  if (valor instanceof Date) return Utilities.formatDate(valor, "UTC", "yyyy-MM-dd");

  return String(valor).trim();
}

function llamar(ruta, cuerpo) {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("API_URL");
  var token = props.getProperty("HOOK_TOKEN");

  if (!url || !token) {
    throw new Error("Faltan API_URL o HOOK_TOKEN en las propiedades del script.");
  }

  var respuesta = UrlFetchApp.fetch(url + ruta, {
    method: "post",
    contentType: "application/json",
    headers: { "x-sheets-token": token },
    payload: JSON.stringify(cuerpo),
    // Sin esto, un 4xx lanza una excepción y perdemos el mensaje de error, que
    // es justamente lo que hay que mostrarle al coordinador.
    muteHttpExceptions: true,
  });

  var texto = respuesta.getContentText();
  var datos = JSON.parse(texto);

  if (!datos.success) {
    Logger.log("Error del backend: " + texto);
  }

  return datos;
}
