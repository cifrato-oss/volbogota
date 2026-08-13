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
    .addSeparator()
    .addItem("¿A dónde estoy sincronizando?", "dondeEstoySincronizando")
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
  var hoja = libro().getSheetByName("Listas");
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

  var valor = hoja.getRange(fila, columna).getValue();
  if (valor === null || valor === undefined || valor === "") return null;

  if (valor instanceof Date) return Utilities.formatDate(valor, "UTC", "yyyy-MM-dd");

  return String(valor).trim();
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

  for (var i = 0; i < lista.length; i++) {
    var datos = enviarA(lista[i], ruta, cuerpo);
    if (i === 0) respuestaPrincipal = datos;
  }

  return respuestaPrincipal;
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
