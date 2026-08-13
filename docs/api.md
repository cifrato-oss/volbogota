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
| **Jornada** | `AM` · `PM` · `NOCHE` — siempre en mayúsculas                        |
| **Turno**   | Un punto + una fecha + una jornada. 72 en total (6 × 4 días × 3)     |
| **Reserva** | La inscripción de un voluntario a un turno                           |

El `turnoId` es predecible — `{puntoId}_{YYYY-MM-DD}_{jornada en minúscula}`, o
sea `cruz-roja_2026-08-13_am`. Aun así, **no lo armes a mano**: úsalo como viene
en las respuestas.

Programa: **13 al 16 de agosto de 2026**, 6 puntos, **11.400 cupos**.

> **Fechas**: van como strings `YYYY-MM-DD`, sin hora ni zona horaria. No las
> pases por `new Date()` sin fijar la zona o te puede correr un día.

### Los seis puntos

| Punto                   | Localidad      | Horario oficial       | Noche  |
| ----------------------- | -------------- | --------------------- | ------ |
| U. Jorge Tadeo Lozano   | Santa Fe       | 8:00 a.m. - 9:00 p.m. | sí     |
| Punto Usaquén           | Usaquén        | 8:00 a.m. - 9:00 p.m. | sí     |
| CC Unicentro            | Usaquén        | 9:00 a.m. - 5:00 p.m. | **no** |
| Cruz Roja               | Barrios Unidos | 24 horas              | sí     |
| Palacio de los Deportes | Teusaquillo    | 8:00 a.m. - 8:00 p.m. | **no** |
| Estadio El Campín       | Teusaquillo    | 8:00 a.m. - 8:00 p.m. | sí     |

⚠️ **Palacio de los Deportes recoge donaciones para el Chocó**, no para el sismo
de Bogotá. Viene dicho en su campo `observaciones` — vale la pena mostrarlo
distinto en la UI para que nadie done al destino equivocado.

⚠️ **La jornada noche (7–10 p.m.) se pasa del cierre en 3 de los 6 puntos.** El
`horario` del turno es el horario nominal de la jornada; el `horarioOficial` del
punto es cuando la puerta está realmente abierta. Hasta que los alineen,
**muestra el horario oficial del punto** o mandarás gente a un sitio cerrado.

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
    "observaciones": "Sede administrativa. Opera 24 horas: es el único punto donde caben las 3 jornadas completas.",
    "actividades": ["Empaque", "Clasificación", "Carga y descarga"],
    "cuposPorJornada": { "AM": 150, "PM": 150, "NOCHE": 150 },
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

| Param         | Valores           | Efecto                               |
| ------------- | ----------------- | ------------------------------------ |
| `centro`      | id de punto       | Solo ese punto                       |
| `fecha`       | `YYYY-MM-DD`      | Solo ese día                         |
| `jornada`     | `AM` `PM` `NOCHE` | Solo esa jornada                     |
| `disponibles` | `true` `false`    | Con `true` esconde llenos y cerrados |

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
- **`estado`** = `ABIERTO` o `CERRADO`. Los 8 turnos de Unicentro-noche y
  Palacio-noche vienen `CERRADO` con `cuposTotales: 0`

**Un turno es inscribible si `estado === "ABIERTO" && !agotado`.** Eso es
exactamente lo que filtra `disponibles=true` — 64 de los 72.

`horarioOficialCentro` está denormalizado acá para que no tengas que pedir el
punto solo para saber a qué hora abre.

Un param inválido devuelve `422`, no lo ignora en silencio.

## `GET /api/turnos/{id}`

Un turno, mismo objeto. `404` si no existe.

---

## `GET /api/disponibilidad`

La grilla completa **punto × fecha × jornada** en una respuesta, para pintar el
calendario sin una petición por celda.

```json
{
  "fechas": ["2026-08-13", "2026-08-14", "2026-08-15", "2026-08-16"],
  "centros": [
    {
      "id": "cruz-roja",
      "nombre": "Cruz Roja",
      "localidad": "Barrios Unidos",
      "dias": [
        {
          "fecha": "2026-08-13",
          "jornadas": [
            {
              "jornada": "AM",
              "turnoId": "cruz-roja_2026-08-13_am",
              "cuposTotales": 150,
              "disponibles": 149,
              "agotado": false,
              "estado": "ABIERTO"
            }
          ]
        }
      ]
    }
  ],
  "totales": { "cupos": 11400, "reservados": 0, "disponibles": 11400 }
}
```

`centros[].dias` trae **una entrada por cada fecha de `fechas`**, en el mismo
orden. `jornadas` viene ordenado AM → PM → Noche. `totales` sirve directo para un
contador tipo «quedan 11.398 cupos».

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
  "codigo": "VB-ATLEB5",
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

`codigo` es el comprobante del voluntario. La confirmación trae **dirección y
horario oficial** para que la pantalla de «listo, quedaste inscrito» le diga a
dónde ir sin otra petición. `jornada` viene como etiqueta lista para mostrar
(`"Noche"`, no `"NOCHE"`).

### Errores que tienes que manejar

| HTTP | Situación                      | `message`                                                |
| ---- | ------------------------------ | -------------------------------------------------------- |
| 422  | Campos inválidos               | Revisa `details` y píntalos bajo cada input              |
| 404  | El turno no existe             | `El turno no existe.`                                    |
| 409  | Ya no hay cupo                 | `El turno ya no tiene cupos disponibles.`                |
| 409  | Turno cerrado o punto retirado | `El turno no está disponible para inscripción.`          |
| 409  | Celular repetido en ese turno  | `Ya hay una inscripción con este celular en este turno.` |

**El `409` de cupo es esperable, no es un bug.** Los cupos se validan en el
servidor al momento del `POST`: entre que el usuario vio «quedan 3» y le dio
enviar, alguien más pudo tomarlos. Recarga los turnos y pídele que elija otro —
no reintentes automáticamente.

El mismo celular **sí puede** inscribirse en turnos distintos. La restricción es
una inscripción por celular **por turno**.

---

## Notas para el front

**Los cupos cambian mientras el usuario mira la pantalla.** Estos endpoints son
REST: dan una foto del momento. Dos caminos para que el número baje solo:

1. **Polling** — re-pedir `/api/disponibilidad` cada 15–30 s. Simple y suficiente.
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

Queda con los 6 puntos, 72 turnos y 11.400 cupos reales, sin tocar producción.
