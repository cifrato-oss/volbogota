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
| 404  | `NOT_FOUND`             | El centro o el turno no existe                        |
| 409  | `CONFLICT`              | Turno lleno, turno cerrado, o celular ya inscrito ahí |
| 422  | `UNPROCESSABLE_ENTITY`  | El body no pasó validación — trae `details` por campo |
| 500  | `INTERNAL_SERVER_ERROR` | Error inesperado. `message` es genérico a propósito   |

En un 422, `details` es un arreglo listo para pintar errores bajo cada input:

```json
[
  { "field": "celular", "message": "El celular debe tener 10 dígitos y empezar por 3." },
  { "field": "autorizoDatos", "message": "Debes autorizar el tratamiento de datos personales." }
]
```

`field` usa notación de punto para campos anidados: `contactoEmergencia.celular`.

---

## Vocabulario

| Concepto    | Qué es                                                            |
| ----------- | ----------------------------------------------------------------- |
| **Centro**  | Punto de acopio. 7 en total. `id` es un slug: `vive-claro`        |
| **Jornada** | `AM` · `PM` · `NOCHE` (en mayúsculas, siempre)                    |
| **Turno**   | Un centro + una fecha + una jornada. 84 en total (7 × 4 días × 3) |
| **Reserva** | La inscripción de un voluntario a un turno                        |

**`turnoId`** es predecible: `{centroId}_{YYYY-MM-DD}_{jornada en minúscula}`
→ `vive-claro_2026-08-13_am`. Igual, **no lo armes a mano**: úsalo tal como
viene en las respuestas, así un cambio de formato no rompe el front.

Fechas del programa: `2026-08-13` a `2026-08-16`. Las fechas son strings
`YYYY-MM-DD`, sin hora ni zona horaria — no las pases por `new Date()` sin
fijar la zona o te puede correr un día.

Horarios fijos por jornada:

| Jornada | Horario                |
| ------- | ---------------------- |
| `AM`    | 8:00 a.m. - 2:00 p.m.  |
| `PM`    | 1:00 p.m. - 5:00 p.m.  |
| `NOCHE` | 7:00 p.m. - 10:00 p.m. |

---

## `GET /api/catalogos`

Todo lo que necesitan los selects del formulario, en una sola llamada. **Empieza por acá.**

```json
{
  "centros": [
    {
      "id": "cc-nuestro-bogota",
      "nombre": "CC Nuestro Bogotá",
      "localidad": "Engativá",
      "actividades": ["Empaque", "Clasificación", "Carga y descarga"]
    }
  ],
  "jornadas": [
    {
      "valor": "AM",
      "etiqueta": "AM",
      "horario": { "inicio": "08:00", "fin": "14:00", "etiqueta": "8:00 a.m. - 2:00 p.m." }
    },
    {
      "valor": "PM",
      "etiqueta": "PM",
      "horario": { "inicio": "13:00", "fin": "17:00", "etiqueta": "1:00 p.m. - 5:00 p.m." }
    },
    {
      "valor": "NOCHE",
      "etiqueta": "Noche",
      "horario": { "inicio": "19:00", "fin": "22:00", "etiqueta": "7:00 p.m. - 10:00 p.m." }
    }
  ],
  "actividades": ["Empaque", "Clasificación", "Carga y descarga"],
  "fechas": ["2026-08-13", "2026-08-14", "2026-08-15", "2026-08-16"]
}
```

Usa `jornadas[].etiqueta` para mostrar y `jornadas[].valor` para enviar.

---

## `GET /api/centros`

Los centros activos, ordenados por nombre.

```json
[
  {
    "id": "vive-claro",
    "nombre": "Vive Claro",
    "direccion": "Cra. 60 #42-41",
    "localidad": "Teusaquillo",
    "linkMaps": null,
    "actividades": ["Empaque", "Clasificación", "Carga y descarga"],
    "cuposPorJornada": { "AM": 300, "PM": 300, "NOCHE": 300 },
    "activo": true
  }
]
```

> **Ojo con los nulos**: hoy solo Vive Claro tiene `direccion`. Los otros 6 vienen
> en `null`, y `linkMaps` está en `null` en los 7. La UI tiene que aguantar eso
> sin romperse ni mostrar "null". Se llenan editando el Excel y re-importando.

Los datos del coordinador **nunca** salen por acá: son personales y quedan solo
del lado admin.

## `GET /api/centros/{id}`

Un centro. Mismo objeto de arriba.

- `404` si el `id` no existe **o si el centro está inactivo** — para el front son
  el mismo caso.

---

## `GET /api/turnos`

La lista de turnos con su ocupación en vivo. Es el endpoint que alimenta el
selector de cupos.

**Query params** (todos opcionales, combinables):

| Param         | Valores               | Efecto                           |
| ------------- | --------------------- | -------------------------------- |
| `centro`      | id de centro          | Solo ese centro                  |
| `fecha`       | `YYYY-MM-DD`          | Solo ese día                     |
| `jornada`     | `AM` · `PM` · `NOCHE` | Solo esa jornada                 |
| `disponibles` | `true` · `false`      | `true` esconde llenos y cerrados |

```
GET /api/turnos?centro=vive-claro&fecha=2026-08-13&disponibles=true
```

```json
[
  {
    "id": "vive-claro_2026-08-13_am",
    "centroId": "vive-claro",
    "centroNombre": "Vive Claro",
    "fecha": "2026-08-13",
    "diaSemana": "Jueves",
    "jornada": "AM",
    "horario": { "inicio": "08:00", "fin": "14:00", "etiqueta": "8:00 a.m. - 2:00 p.m." },
    "cuposTotales": 300,
    "reservados": 12,
    "estado": "ABIERTO",
    "coordinador": null,
    "disponibles": 288,
    "ocupacion": 0.04,
    "agotado": false
  }
]
```

Campos derivados, ya calculados — no los recalcules en el front:

- **`disponibles`** = `cuposTotales - reservados`, nunca negativo
- **`ocupacion`** = fracción de 0 a 1. Para porcentaje, multiplica por 100
- **`agotado`** = `disponibles === 0`
- **`estado`** = `ABIERTO` o `CERRADO`. Un turno cerrado no acepta inscripciones
  aunque le queden cupos

Un turno es inscribible si `estado === "ABIERTO" && !agotado`. Eso es
exactamente lo que filtra `disponibles=true`.

Un param inválido (`fecha=13-08-2026`, `jornada=mañana`) da `422`, no lo ignora.

## `GET /api/turnos/{id}`

Un turno. Mismo objeto. `404` si no existe.

---

## `GET /api/disponibilidad`

La grilla completa **centro × fecha × jornada** en una sola respuesta, para
pintar el calendario sin disparar una petición por celda.

```json
{
  "fechas": ["2026-08-13", "2026-08-14", "2026-08-15", "2026-08-16"],
  "centros": [
    {
      "id": "cc-nuestro-bogota",
      "nombre": "CC Nuestro Bogotá",
      "localidad": "Engativá",
      "dias": [
        {
          "fecha": "2026-08-13",
          "jornadas": [
            {
              "jornada": "AM",
              "turnoId": "cc-nuestro-bogota_2026-08-13_am",
              "cuposTotales": 150,
              "disponibles": 150,
              "agotado": false,
              "estado": "ABIERTO"
            },
            {
              "jornada": "PM",
              "turnoId": "cc-nuestro-bogota_2026-08-13_pm",
              "cuposTotales": 150,
              "disponibles": 150,
              "agotado": false,
              "estado": "ABIERTO"
            },
            {
              "jornada": "NOCHE",
              "turnoId": "cc-nuestro-bogota_2026-08-13_noche",
              "cuposTotales": 150,
              "disponibles": 150,
              "agotado": false,
              "estado": "ABIERTO"
            }
          ]
        }
      ]
    }
  ],
  "totales": { "cupos": 16200, "reservados": 0, "disponibles": 16200 }
}
```

`centros[].dias` trae **una entrada por cada fecha de `fechas`**, en el mismo
orden, así que puedes indexar en paralelo. `jornadas` viene ordenado AM → PM →
Noche.

`totales` sirve directo para un contador tipo "quedan 15.898 cupos".

---

## `POST /api/reservas`

Inscribe a un voluntario en un turno.

### Body

```json
{
  "nombre": "Ana María Ramírez",
  "celular": "3001234567",
  "turnoId": "vive-claro_2026-08-13_am",
  "actividad": "Empaque",
  "autorizoDatos": true,
  "mayorDeEdad": true,
  "contactoEmergencia": { "nombre": "Pedro Pérez", "celular": "3009876543" },
  "eps": "Sura",
  "notas": "Llego 15 min tarde"
}
```

| Campo                | Tipo    | Req. | Regla                                                    |
| -------------------- | ------- | ---- | -------------------------------------------------------- |
| `nombre`             | string  | sí   | 3 a 120 caracteres. Se le hace trim                      |
| `celular`            | string  | sí   | Celular colombiano: 10 dígitos empezando por 3           |
| `turnoId`            | string  | sí   | Tal como viene de `/api/turnos`                          |
| `actividad`          | string  | sí   | `Empaque` · `Clasificación` · `Carga y descarga`         |
| `autorizoDatos`      | boolean | sí   | **Tiene que ser `true`**. `false` es 422, no se guarda   |
| `mayorDeEdad`        | boolean | sí   | **Tiene que ser `true`**                                 |
| `contactoEmergencia` | objeto  | no   | `{ nombre, celular }`, mismas reglas de nombre y celular |
| `eps`                | string  | no   | Máx. 80                                                  |
| `notas`              | string  | no   | Máx. 500                                                 |

El `celular` acepta separadores: `"300 123 4567"` y `"300-123-4567"` se
normalizan a `"3001234567"`. Puedes mandarlo como lo escriba el usuario.

### Respuesta `201`

```json
{
  "codigo": "VB-GDRHOR",
  "estado": "RESERVADO",
  "nombre": "Ana María Ramírez",
  "turno": {
    "id": "vive-claro_2026-08-13_am",
    "centroNombre": "Vive Claro",
    "fecha": "2026-08-13",
    "jornada": "AM",
    "horario": "8:00 a.m. - 2:00 p.m."
  },
  "actividad": "Empaque"
}
```

`codigo` es el comprobante que se le muestra al voluntario. Ahí `jornada` viene
como etiqueta lista para mostrar (`"Noche"`, no `"NOCHE"`).

### Errores que tienes que manejar

| HTTP | Situación                     | `message`                                                |
| ---- | ----------------------------- | -------------------------------------------------------- |
| 422  | Campos inválidos              | Revisa `details` y píntalos bajo cada input              |
| 404  | El turno no existe            | `El turno no existe.`                                    |
| 409  | Ya no hay cupo                | `El turno ya no tiene cupos disponibles.`                |
| 409  | Turno cerrado                 | `El turno está cerrado.`                                 |
| 409  | Celular repetido en ese turno | `Ya hay una inscripción con este celular en este turno.` |

**El `409` de cupo es esperable, no es un bug.** Los cupos se validan en el
servidor en el momento del `POST`: entre que el usuario vio "quedan 3" y le dio
enviar, alguien más pudo tomarlos. Cuando llegue un 409 de cupo, recarga los
turnos y pídele que elija otro — no reintentes automáticamente.

El mismo celular **sí puede** inscribirse en turnos distintos. La restricción es
una inscripción por celular **por turno**.

---

## Notas para el front

**Los cupos cambian mientras el usuario mira la pantalla.** Estos endpoints son
REST: te dan una foto del momento. Para que el número baje solo hay dos caminos:

1. **Polling**: re-pedir `/api/disponibilidad` cada 15–30 s. Simple, suficiente
   para casi todo.
2. **Firestore en vivo**: suscribirse a la colección `turnos` con el SDK cliente
   y `onSnapshot`. Actualiza de verdad en tiempo real, sin polling. Las reglas
   ya están puestas: `turnos` y `centros` son de solo lectura pública, `reservas`
   está cerrada. Las escrituras siguen yendo por el `POST`.

Si quieren la opción 2, dime y monto la config del SDK cliente.

**Textos**: `error.message` ya viene en español y redactado para el usuario
final. No necesitas un diccionario de códigos, aunque el `code` está ahí si
quieres ramificar la lógica.

**Cero datos de otros voluntarios.** Ningún endpoint público expone nombres,
celulares ni contactos de emergencia — solo contadores agregados. Es requisito
de la Ley 1581 de 2012, no una decisión de diseño.

---

## Probar sin backend a mano

```bash
npm run emulator
```

```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 npm run import:excel -- --file ./Voluntariado_Bogota_Centros_Acopio.xlsx
```

```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 npm run dev
```

Queda con los 7 centros, 84 turnos y 16.200 cupos reales, sin tocar producción.
