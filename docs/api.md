# API VolBogotá — contrato para el front

Base URL local: `http://localhost:3000`

Todos los endpoints viven bajo `/api`. No hay autenticación en esta tanda: los
seis `GET` son públicos y el `POST` de inscripción también (lo protege la
validación, no un token).

---

## El sobre de respuesta

**Toda** respuesta usa la misma envoltura. No hay excepciones, ni siquiera en errores.

```jsonc
// éxito
{ "success": true, "data": { /* lo que pediste */ } }

// error
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "El turno no existe.",
    "details": [ /* opcional, solo en errores de validación */ ]
  }
}
```

`message` viene en español y es **apto para mostrarle al usuario tal cual**.

### Códigos de error

| HTTP | `code`                  | Cuándo pasa                                           |
| ---- | ----------------------- | ----------------------------------------------------- |
| 404  | `NOT_FOUND`             | El punto o el turno no existe                         |
| 409  | `CONFLICT`              | Turno lleno, no disponible, o celular ya inscrito ahí |
| 422  | `UNPROCESSABLE_ENTITY`  | No pasó validación — trae `details` por campo         |
| 500  | `INTERNAL_SERVER_ERROR` | Error inesperado. El mensaje es genérico a propósito  |

En un 422, `details` viene listo para pintar el error bajo cada input:

```json
[
  { "field": "celular", "message": "El celular debe tener 10 dígitos y empezar por 3." },
  { "field": "edad", "message": "Debes tener al menos 18 años para inscribirte." }
]
```

---

## Vocabulario

| Concepto    | Qué es                                                               |
| ----------- | -------------------------------------------------------------------- |
| **Punto**   | Punto de acopio autorizado. 6 en total. `id` es un slug: `cruz-roja` |
| **Jornada** | `AM` · `PM` — siempre en mayúsculas. La jornada noche se eliminó     |
| **Turno**   | Un punto + una fecha + una jornada. 48 en total (6 × 4 días × 2)     |
| **Reserva** | La inscripción de un voluntario a un turno                           |

El `turnoId` es predecible — `{puntoId}_{YYYY-MM-DD}_{jornada en minúscula}`, o
sea `cruz-roja_2026-08-13_am`. Aun así, **no lo armes a mano**: úsalo como viene
en las respuestas.

Programa: **13 al 16 de agosto de 2026**, 6 puntos, **8.400 cupos**.

Dos jornadas por día: `AM` de 8:00 a.m. a 2:00 p.m. y `PM` de 1:00 p.m. a
5:00 p.m. Se solapan una hora — es lo que dice la hoja maestra, no un error de
transcripción.

> **Fechas**: van como strings `YYYY-MM-DD`, sin hora ni zona horaria. No las
> pases por `new Date()` sin fijar la zona o te puede correr un día.

### Los seis puntos

| Punto                   | Localidad      | Horario oficial       | Cupos AM/PM |
| ----------------------- | -------------- | --------------------- | ----------- |
| U. Jorge Tadeo Lozano   | Santa Fe       | 8:00 a.m. - 9:00 p.m. | 150 / 150   |
| Punto Usaquén           | Usaquén        | 8:00 a.m. - 9:00 p.m. | 150 / 150   |
| CC Unicentro            | Usaquén        | 9:00 a.m. - 5:00 p.m. | 150 / 150   |
| Cruz Roja               | Barrios Unidos | 24 horas              | 150 / 150   |
| Palacio de los Deportes | Teusaquillo    | 8:00 a.m. - 8:00 p.m. | 150 / 150   |
| Estadio El Campín       | Teusaquillo    | 8:00 a.m. - 8:00 p.m. | 300 / 300   |

⚠️ **Palacio de los Deportes recoge donaciones para el Chocó**, no para el sismo
de Bogotá. Viene dicho en su campo `observaciones` — vale la pena mostrarlo
distinto en la UI para que nadie done al destino equivocado.

⚠️ El `horario` del turno es el horario nominal de la jornada; el
`horarioOficial` del punto es cuando la puerta está realmente abierta, y no
siempre coinciden — Unicentro abre a las 9:00 a.m., no a las 8:00.
**Muestra el horario oficial del punto** o mandarás gente a un sitio cerrado.

---

## `GET /api/catalogos`

Todo lo que necesitan los selects del formulario, en una sola llamada. **Empieza por acá.**

```json
{
  "centros": [
    {
      "id": "cc-unicentro",
      "nombre": "CC Unicentro",
      "localidad": "Usaquén",
      "actividades": ["Empaque", "Clasificación", "Carga y descarga"]
    }
  ],
  "jornadas": [
    {
      "valor": "AM",
      "etiqueta": "AM",
      "horario": { "inicio": "08:00", "fin": "14:00", "etiqueta": "8:00 a.m. - 2:00 p.m." }
    }
  ],
  "actividades": ["Empaque", "Clasificación", "Carga y descarga"],
  "fechas": ["2026-08-13", "2026-08-14", "2026-08-15", "2026-08-16"]
}
```

`actividades` es **informativo** — qué se hace en cada punto. Ya no es un campo
del formulario; el `POST` no lo recibe.

---

## `GET /api/centros`

Los puntos activos, ordenados por nombre.

```json
[
  {
    "id": "cruz-roja",
    "nombre": "Cruz Roja",
    "direccion": "Carrera 24 # 73-38",
    "localidad": "Barrios Unidos",
    "linkMaps": "https://maps.app.goo.gl/KSYQ52viibBuktq48",
    "horarioOficial": "24 horas",
    "observaciones": "Sede administrativa. Opera 24 horas.",
    "actividades": ["Empaque", "Clasificación", "Carga y descarga"],
    "cuposPorJornada": { "AM": 150, "PM": 150 },
    "activo": true
  }
]
```

- **`horarioOficial`** — cuándo abre el punto de verdad. Puede ser `"24 horas"`.
- **`observaciones`** — texto libre del equipo coordinador. Puede ser `null`. Es
  donde aparece lo del Chocó y las advertencias de cierre. Muéstralo.
- **`cuposPorJornada`** — un `0` significa que el punto **no opera** en esa
  jornada, y su turno viene `CERRADO`.

Un punto retirado del Excel deja de aparecer acá y sus turnos desaparecen de
`/api/turnos`. Los datos del coordinador nunca salen por estos endpoints.

## `GET /api/centros/{id}`

Un punto. Mismo objeto. `404` si el id no existe **o si el punto está inactivo**.

---

## `GET /api/turnos`

Turnos con su ocupación en vivo. Alimenta el selector de cupos.

**Query params** (todos opcionales, combinables):

| Param         | Valores        | Efecto                               |
| ------------- | -------------- | ------------------------------------ |
| `centro`      | id de punto    | Solo ese punto                       |
| `fecha`       | `YYYY-MM-DD`   | Solo ese día                         |
| `jornada`     | `AM` `PM`      | Solo esa jornada                     |
| `disponibles` | `true` `false` | Con `true` esconde llenos y cerrados |

```json
[
  {
    "id": "cruz-roja_2026-08-13_am",
    "centroId": "cruz-roja",
    "centroNombre": "Cruz Roja",
    "fecha": "2026-08-13",
    "diaSemana": "Jueves",
    "jornada": "AM",
    "horario": { "inicio": "08:00", "fin": "14:00", "etiqueta": "8:00 a.m. - 2:00 p.m." },
    "horarioOficialCentro": "24 horas",
    "centroActivo": true,
    "cuposTotales": 150,
    "reservados": 1,
    "estado": "ABIERTO",
    "coordinador": null,
    "disponibles": 149,
    "ocupacion": 0.0067,
    "agotado": false
  }
]
```

Campos derivados, ya calculados — no los recalcules:

- **`disponibles`** = `cuposTotales − reservados`, nunca negativo
- **`ocupacion`** = fracción de 0 a 1
- **`agotado`** = `disponibles === 0`
- **`estado`** = `ABIERTO` o `CERRADO`. Un punto con `0` cupos en una jornada
  trae ese turno `CERRADO` con `cuposTotales: 0`

**Un turno es inscribible si `estado === "ABIERTO" && !agotado`.** Eso es
exactamente lo que filtra `disponibles=true`. Hoy los 48 tienen cupo, pero eso
cambia en cuanto un punto ponga una jornada en `0`.

`horarioOficialCentro` está denormalizado acá para que no tengas que pedir el
punto solo para saber a qué hora abre.

Un param inválido devuelve `422`, no lo ignora en silencio.

## `GET /api/turnos/{id}`

Un turno, mismo objeto. `404` si no existe.

---

## `POST /api/reservas`

Inscribe a un voluntario. **Cinco campos y el turno, nada más.**

### Body

```json
{
  "nombre": "Ana María",
  "apellido": "Ramírez Gómez",
  "celular": "3001234567",
  "edad": 30,
  "turnoId": "cruz-roja_2026-08-13_am",
  "autorizoDatos": true
}
```

| Campo           | Tipo    | Req. | Regla                                                 |
| --------------- | ------- | ---- | ----------------------------------------------------- |
| `nombre`        | string  | sí   | 2 a 60 caracteres. Se le hace trim                    |
| `apellido`      | string  | sí   | 2 a 60 caracteres. Se le hace trim                    |
| `celular`       | string  | sí   | Celular colombiano: 10 dígitos empezando por 3        |
| `edad`          | number  | sí   | Entero, **18 o más**, máximo 110                      |
| `turnoId`       | string  | sí   | Tal como viene de `/api/turnos`                       |
| `autorizoDatos` | boolean | sí   | Tiene que ser `true`. Un `false` es 422, no se guarda |

Dos comodidades para el formulario:

- El `celular` acepta separadores: `"300 123 4567"` y `"300-123-4567"` se
  normalizan a `"3001234567"`. Mándalo como lo escriba el usuario.
- La `edad` acepta string: `"42"` se convierte a `42`. Un `<input type="number">`
  entrega string en varios navegadores.

Cualquier campo extra que mandes se ignora en silencio.

### Respuesta `201`

```json
{
  "codigo": "VB-K7M2QX9D",
  "estado": "RESERVADO",
  "nombre": "Ana María Ramírez Gómez",
  "turno": {
    "id": "cruz-roja_2026-08-13_am",
    "centroNombre": "Cruz Roja",
    "fecha": "2026-08-13",
    "jornada": "AM",
    "horario": "8:00 a.m. - 2:00 p.m.",
    "direccion": "Carrera 24 # 73-38",
    "horarioOficial": "24 horas"
  }
}
```

`codigo` es el comprobante del voluntario: `VB-` y 8 caracteres de un alfabeto
sin `O`/`0` ni `I`/`1`/`L`, para que nadie lo transcriba mal al dictarlo en la
portería. Es único — lo garantiza Firestore — y es la llave con la que el
check-in va a buscar la reserva. La confirmación trae **dirección y
horario oficial** para que la pantalla de «listo, quedaste inscrito» le diga a
dónde ir sin otra petición. `jornada` viene como etiqueta lista para mostrar,
no como el valor del enum.

### Errores que tienes que manejar

| HTTP | Situación                      | `message`                                                         |
| ---- | ------------------------------ | ----------------------------------------------------------------- |
| 422  | Campos inválidos               | Revisa `details` y píntalos bajo cada input                       |
| 404  | El turno no existe             | `El turno no existe.`                                             |
| 409  | Ya no hay cupo                 | `El turno ya no tiene cupos disponibles.`                         |
| 409  | Turno cerrado o punto retirado | `El turno no está disponible para inscripción.`                   |
| 409  | Celular repetido en ese turno  | `Ya hay una inscripción con este celular en este turno.`          |
| 409  | Choque de código (rarísimo)    | `No pudimos generar tu código de confirmación. Intenta de nuevo.` |

El de choque de código es el único 409 que se reintenta solo: pasa con
probabilidad del orden de 1 en 10 millones y reenviar el mismo body funciona.

**El `409` de cupo, en cambio, es esperable y no es un bug.** Los cupos se validan en el
servidor al momento del `POST`: entre que el usuario vio «quedan 3» y le dio
enviar, alguien más pudo tomarlos. Recarga los turnos y pídele que elija otro —
no reintentes automáticamente.

El mismo celular **sí puede** inscribirse en turnos distintos. La restricción es
una inscripción por celular **por turno**.

---

## Notas para el front

**Los cupos cambian mientras el usuario mira la pantalla.** Estos endpoints son
REST: dan una foto del momento. Dos caminos para que el número baje solo:

1. **Polling** — re-pedir `/api/turnos` cada 15–30 s. Simple y suficiente.
2. **Firestore en vivo** — suscribirse a la colección `turnos` con el SDK cliente
   y `onSnapshot`. Las reglas ya están puestas: `turnos` y `centros` de lectura
   pública, `reservas` cerrada. Falta montar la config del SDK cliente — pídemela.

**Cero datos de otros voluntarios.** Ningún endpoint público expone nombres,
celulares ni edades. Solo contadores agregados. Ley 1581 de 2012.

**Textos** — `error.message` ya viene en español y redactado para el usuario
final.

---

## Probar sin backend a mano

```bash
npm run emulator
```

```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 npm run import:excel -- --file ./Voluntariado_Bogota_Centros_Acopio_2.xlsx
```

```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 npm run dev
```

Queda con los 6 puntos, 48 turnos y 8.400 cupos reales, sin tocar producción.

---

# Endpoints de coordinación (`/api/admin`)

**Todos exigen autenticación.** Devuelven nombres, celulares y edades de
voluntarios: sin el token esto sería una fuga de datos personales.

```
x-admin-token: <token>
```

o bien `Authorization: Bearer <token>`. Sin token o con token inválido → `401`.

> El token es **compartido**, no un sistema de identidad. Para una operación de
> cuatro días con un puñado de coordinadores es el trato honesto: nada que
> crear, nada que resetear a las 2 a.m. El costo también es real — **no hay
> rastro de quién hizo cada cambio**, y revocarle el acceso a una persona
> implica rotarlo para todas. Si esto sobrevive al evento, se reemplaza por
> Firebase Auth con custom claims.

## `GET /api/admin/reservas`

| Param     | Valores                    | Efecto                              |
| --------- | -------------------------- | ----------------------------------- |
| `turno`   | `turnoId`                  | Solo ese turno                      |
| `centro`  | id de punto                | Solo ese punto                      |
| `fecha`   | `YYYY-MM-DD`               | Solo ese día                        |
| `jornada` | `AM` `PM`                  | Solo esa jornada                    |
| `estado`  | ver estados abajo          | Solo ese estado                     |
| `q`       | texto (2–60)               | Busca en nombre, apellido y celular |
| `limite`  | 1–500 (default 100)        | Tamaño de página                    |
| `desde`   | `siguiente` de la anterior | Cursor de paginación                |

```json
{
  "reservas": [/* … */],
  "siguiente": "2026-08-13T14:05:00.000Z"
}
```

`siguiente` en `null` significa que no hay más páginas. Pásalo como `desde` para
la siguiente.

> `q` filtra **dentro de la página**, no sobre toda la colección: Firestore no
> hace búsqueda por subcadena. Con pocos miles de filas alcanza; si el listado
> crece, hay que montar un buscador aparte.

## `GET /api/admin/reservas/{codigo}`

Una reserva completa, con todos sus datos personales. El código es el id del
documento, así que es una lectura directa.

## `PATCH /api/admin/reservas/{codigo}`

```json
{ "estado": "CONFIRMADO" }
```

Estados y transiciones permitidas:

```
RESERVADO   → CONFIRMADO · ASISTIO · NO_ASISTIO · CANCELADO
CONFIRMADO  → ASISTIO · NO_ASISTIO · CANCELADO
ASISTIO     ⇄ NO_ASISTIO          (solo para corregir un error de digitación)
CANCELADO   → (final)
```

- Mandar el estado que ya tiene devuelve `200` sin cambiar nada. Es
  **idempotente a propósito**: un doble toque con mala señal no debe dar error.
- Una transición no permitida devuelve `409` diciendo cuál era.
- **`CANCELADO` libera el cupo**: baja el contador del turno y suelta el
  candado del celular, así que esa persona puede volver a inscribirse en ese
  mismo turno. Las dos escrituras van en una transacción.

## `POST /api/admin/reservas/{codigo}/check-in` · `/check-out`

```json
{ "hora": "08:05" }
```

`hora` es opcional — omitirla usa la hora actual de Bogotá, que es el caso
normal en la portería. Formato `HH:MM` en 24 horas.

- El **check-in marca `ASISTIO`** automáticamente. No hay que registrarlo dos veces.
- El **check-out calcula `horas`**, que alimentan los certificados de voluntariado.
- Check-out sin check-in previo → `409`.
- Salida anterior o igual a la entrada → `409`, en vez de guardar un negativo.

## `GET /api/admin/resumen`

La hoja `Resumen` calculada en vivo: cupos ofertados/reservados/disponibles,
reservas por estado, asistencia, horas donadas, y desgloses por punto y por día.

Los cupos salen de los contadores de turno; la asistencia se cuenta recorriendo
las reservas, porque nada lleva un acumulado y —a diferencia del cupo— no
necesita ser exacta bajo concurrencia.

## `GET /api/admin/export`

Devuelve un **CSV**, no el sobre JSON: el navegador lo baja como archivo.

| Param    | Efecto         |
| -------- | -------------- |
| `fecha`  | Solo ese día   |
| `centro` | Solo ese punto |

Las columnas siguen el orden de la hoja `Reservas` para que **se pueda pegar
directo** en el Excel maestro. Sale con BOM UTF-8 y separado por `;`, que es lo
que Excel espera en configuración regional española — sin eso, los acentos se
rompen y todo cae en una sola columna.
