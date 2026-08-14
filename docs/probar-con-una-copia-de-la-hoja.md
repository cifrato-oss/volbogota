# Probar contra tu propia copia de la hoja

Cómo montar el circuito completo hoja ⇄ backend local: clonar la hoja maestra,
dejar su Apps Script al día, exponer tu `localhost` por un túnel y apuntar la
copia a él.

**Por qué una copia y no la maestra.** La hoja maestra es producción: su Apps
Script tiene un activador que llama al backend desplegado en cuanto alguien toca
`Activo` o una columna de cupos. Editar una celda ahí para "probar algo" cambia
lo que ve el público. Una copia trae los mismos datos y el mismo script, pero
nace desconectada de todo — y ahí es donde se valida un cambio antes de tocar la
maestra.

## El circuito

```
Tu copia de la hoja ──POST /api/hooks/sheets/centros──▶  túnel  ──▶  localhost:3000
Tu copia de la hoja ──POST /api/hooks/sheets/turnos ──▶  túnel  ──▶  localhost:3000
Tu copia de la hoja ──POST /api/hooks/sheets/donaciones▶ túnel  ──▶  localhost:3000
   (Apps Script, al editar o desde el menú)                          (pnpm run dev)

Tu copia de la hoja ◀──────POST al Web app /exec──────────────────── localhost:3000
   (hoja Reservas)          (tras crear una reserva)

Tu copia de la hoja ──────CSV gviz, sin credenciales─────────────▶  localhost:3000
   (rehidratación cuando el backend arranca vacío)
```

Son tres conexiones distintas y se configuran por separado. Se puede tener la
primera funcionando y las otras dos no; los pasos de abajo las encienden de a
una.

| Sentido              | Quién llama                    | Qué autoriza                        | Variable                           |
| -------------------- | ------------------------------ | ----------------------------------- | ---------------------------------- |
| Hoja → backend       | Apps Script (`UrlFetchApp`)    | Header `x-sheets-token`             | `SHEETS_HOOK_TOKEN` / `HOOK_TOKEN` |
| Backend → hoja       | Backend (`doPost` del Web app) | `token` en el cuerpo                | `SHEETS_WEBHOOK_URL`               |
| Hoja → backend (CSV) | Backend, al arrancar vacío     | Nada: archivo compartido por enlace | `SHEET_ID`                         |

## Dónde va cada variable

Hay **dos** sitios de configuración y se confunden con facilidad, porque el mismo
valor va en los dos con nombres distintos.

| Sitio                      | Qué es                                       | Cómo se llega                                                                                                                     |
| -------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Propiedades del script** | La configuración del Apps Script de tu copia | En la copia: _Extensiones → Apps Script → ⚙️ Configuración del proyecto → Propiedades del script → Editar propiedades del script_ |
| **`.env.local`**           | La configuración de tu backend local         | Archivo en la raíz del repo, a partir de `cp .env.example .env.local`                                                             |

Y así se emparejan:

```
Propiedades del script (Apps Script)          .env.local (backend)
─────────────────────────────────────         ──────────────────────────────
API_URL     https://…trycloudflare.com  ────▶ (es tu backend: no va en .env)
HOOK_TOKEN  <el mismo secreto>          ◀───▶ SHEETS_HOOK_TOKEN  <el mismo>
SHEET_ID    <id de tu copia>            ◀───▶ SHEET_ID           <el mismo>
(la URL /exec del Web app)              ────▶ SHEETS_WEBHOOK_URL <esa URL>
```

Las dos que **tienen que coincidir carácter por carácter** son `HOOK_TOKEN` /
`SHEETS_HOOK_TOKEN` y los dos `SHEET_ID`. Las otras dos son direcciones cruzadas:
el script apunta a tu backend por `API_URL`, y tu backend apunta al script por
`SHEETS_WEBHOOK_URL`.

En producción no hay `.env.local`: las mismas variables viven en
[`apphosting.yaml`](../apphosting.yaml) y en Cloud Secret Manager. No las toques
para probar en local.

## 1. Clonar la hoja maestra

Hoja maestra — **`Voluntariado_Bogota_Centros_Acopio_2`**:

```
https://docs.google.com/spreadsheets/d/1pNlI33ldIVLCkLXdh32c1vF3qVTx0-QYmcDl-clcVpg/edit
```

_Archivo → Hacer una copia_. El id de tu copia es el trozo de su URL entre `/d/`
y `/edit`: lo vas a necesitar tres veces.

## 2. Qué se copia y qué no

Esto es lo que más tiempo cuesta si se da por sentado:

| Cosa                                                         | ¿Viaja en la copia?                               |
| ------------------------------------------------------------ | ------------------------------------------------- |
| Datos, fórmulas, formato condicional                         | Sí                                                |
| El código del Apps Script (`sync.gs`)                        | Sí, **pero en la versión que tuviera la maestra** |
| Propiedades del script (`API_URL`, `HOOK_TOKEN`, `SHEET_ID`) | **No** — hay que ponerlas de nuevo                |
| El activador instalable `alEditar`                           | **No** — hay que crearlo                          |
| La implementación Web app (la URL `/exec`)                   | **No** — hay que desplegarla                      |
| Los permisos de compartir                                    | **No** — la copia nace privada                    |

Trata las propiedades como no copiadas y **revísalas antes de tocar nada**: una
copia que heredara `API_URL` apuntando a producción mandaría tus pruebas al
backend real, que es justo lo que la copia existe para evitar.

## 3. Validar que el `sync.gs` de la copia esté al día

La copia hereda el código que tuviera la maestra el día que la clonaste, y la
maestra se actualiza a mano. **Que el script exista no significa que sea el
actual.** La versión buena es la del repo:
[`docs/apps-script/sync.gs`](apps-script/sync.gs).

**Comprobación rápida, sin leer código.** Abre la copia y mira el menú
**VolBogotá** (recarga la pestaña si no aparece). Al día se ve así:

```
Sincronizar centros
Sincronizar turnos
Sincronizar donaciones
Sincronizar todas las reservas
─────────────────────────────
¿A dónde estoy sincronizando?
```

Si ves **un solo ítem «Sincronizar centros y turnos»**, es la versión vieja: la
que mandaba las dos hojas en el mismo POST porque el backend derivaba los turnos
del producto de puntos × fechas × jornadas. Con esa versión cada edición de un
cupo relee el tablero entero — de ahí salían los ~20 s — y no puedes validar ni
las jornadas abiertas ni el horario por fila.

**Cómo actualizarlo:** _Extensiones → Apps Script_, selecciona todo en el archivo
del editor y pega encima el contenido de `docs/apps-script/sync.gs`. Guardar
(⌘S).

**Y después, lo que se olvida siempre:** guardar **no** cambia lo que responde el
Web app. La URL `/exec` sirve la versión desplegada, no el código guardado. Hay
que ir a _Implementar → Administrar implementaciones → ✏️ editar → Versión:
**Nueva versión** → Implementar_.

Se nota cuando falta: `onOpen` sale `Completed` en el log (corre desde `Head`) y
`doPost` sale `Failed` (corre desde la versión congelada).

**Verificación desde la terminal** — con el Web app ya desplegado (paso 9), un
`GET` a la URL `/exec` dice qué versión está sirviendo y sobre qué libro:

```bash
curl -sL "https://script.google.com/macros/s/TU_ID_DE_DESPLIEGUE/exec"
```

```json
{
  "success": true,
  "data": {
    "servicio": "VolBogotá — sync de la hoja",
    "escribeReservas": true,
    "hoja": "Copy of Voluntariado_Bogota_Centros_Acopio_2"
  }
}
```

Si `hoja` no es el nombre de **tu** copia, el `SHEET_ID` de las propiedades
apunta a otro libro. Si en vez de JSON sale HTML, el despliegue no es
«Cualquiera» o no hay ninguna versión desplegada.

## 4. Compartir la copia por enlace

_Compartir → Acceso general → **Cualquier persona con el enlace · Lector**_.

No es opcional: la lectura por CSV (`gviz/tq?tqx=out:csv`) no manda credenciales,
así que una copia privada devuelve HTML de login y el backend arranca vacío. Se
comprueba desde la terminal — si esto imprime encabezados, está bien:

```bash
curl -s "https://docs.google.com/spreadsheets/d/TU_ID/gviz/tq?tqx=out:csv&sheet=Centros" | head -1
```

## 5. Levantar el backend local

En `.env.local`:

| Variable             | Qué poner                               | Por qué                                                    |
| -------------------- | --------------------------------------- | ---------------------------------------------------------- |
| `SHEET_ID`           | el id de **tu copia**                   | de dónde se rehidrata el catálogo                          |
| `SHEETS_HOOK_TOKEN`  | un token nuevo tuyo                     | tiene que ser idéntico al `HOOK_TOKEN` de tu copia         |
| `SHEETS_WEBHOOK_URL` | la URL `/exec` de **tu copia** (paso 9) | déjala vacía hasta desplegar el Web app                    |
| `DB_DRIVER`          | `memory`                                | que las reservas de prueba no queden en la base del evento |
| `ADMIN_API_TOKEN`    | cualquiera                              | solo para entrar a `/api/admin` en local                   |
| `CELULAR_HASH_SALT`  | vacía está bien                         | en local cae a una sal de desarrollo                       |

Genera tu token — **no reutilices el de producción**: vive en las propiedades del
script, legible por cualquiera con acceso de edición a la copia.

```bash
openssl rand -base64 48 | tr -d '\n'
```

Sobre `DB_DRIVER=memory`: la app arranca sin credenciales de ningún tipo, con la
misma concurrencia optimista que Firestore, y se rehidrata sola desde el CSV de
tu copia. Se pierde todo al reiniciar, que es exactamente lo que quieres de un
entorno de pruebas. La alternativa con persistencia es el emulador
(`pnpm run emulator` + `FIRESTORE_EMULATOR_HOST=localhost:8080`). Lo que **no**
hay que hacer es dejar `DB_DRIVER=firestore`: apunta a la base que sirve el
evento y una inscripción de prueba queda guardada en producción.

```bash
pnpm run dev
curl -s localhost:3000/api/health
```

Cada cambio en `.env.local` exige reiniciar `pnpm run dev`.

## 6. El túnel

Apps Script corre en los servidores de Google: no alcanza tu `localhost`. Hace
falta una URL pública que apunte a tu máquina.

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:3000
```

Imprime una URL `https://algo-algo.trycloudflare.com`. Compruébala antes de
seguir:

```bash
curl -s https://TU-TUNEL.trycloudflare.com/api/health
```

Dos cosas que ahorran una hora de desconcierto:

- **La URL cambia cada vez que relanzas el túnel.** Hay que actualizar `API_URL`
  en las propiedades del script en cada relanzada.
- **El front de Next en dev no se navega por el túnel**: devuelve 403 en los
  chunks estáticos y el WebSocket de HMR no pasa. El túnel sirve para la API; la
  web se sigue viendo en `http://localhost:3000`.

`ssh -R 80:localhost:3000 nokey@localhost.run` es la alternativa sin instalar
nada, pero se cayó seis veces en una sola sesión y la URL cambia en cada
reconexión. No vale la pena.

## 7. Las propiedades del script de la copia

_Extensiones → Apps Script → ⚙️ Configuración del proyecto → Propiedades del
script → **Editar propiedades del script** → Añadir propiedad de secuencia de
comandos_. Son tres pares nombre/valor:

| Propiedad    | Valor                                                      | Qué pasa si falta                                          |
| ------------ | ---------------------------------------------------------- | ---------------------------------------------------------- |
| `API_URL`    | `https://TU-TUNEL.trycloudflare.com` (**sin barra final**) | El script lanza «Faltan API_URL … o HOOK_TOKEN»            |
| `HOOK_TOKEN` | el mismo valor que `SHEETS_HOOK_TOKEN`                     | El backend responde 401 «Token de sincronización inválido» |
| `SHEET_ID`   | el id de tu copia                                          | `doPost` falla: una petición web no tiene hoja activa      |

Guardar propiedades es inmediato — **no** hace falta desplegar una versión nueva
para que un cambio de propiedades tenga efecto. Eso solo aplica al código.

`API_URL2` es un **segundo** destino opcional: con las dos puestas la hoja manda
a ambas, independientes, y la respuesta que se escribe en la hoja es la de
`API_URL`. En una copia de pruebas déjala vacía — apuntar a producción desde acá
es el error que la copia previene.

## 8. El activador (trigger)

**Primero mira si ya está.** En el editor de Apps Script, panel izquierdo, el
icono del reloj ⏰ → **Activadores**. La copia recién hecha **no** trae ninguno:
los activadores no se copian.

Ojo con este espejismo: el menú **VolBogotá** aparece igual sin activador
instalado, porque `onOpen` es un activador _simple_ y esos sí corren solos. **Ver
el menú no prueba que el activador esté.**

**Cuál es, exactamente.** _Añadir activador_, y estos cuatro campos:

| Campo              | Valor                 |
| ------------------ | --------------------- |
| Función a ejecutar | `alEditar`            |
| Implementación     | `Head`                |
| Origen del evento  | Desde hoja de cálculo |
| Tipo de evento     | **Al editar**         |

La primera vez pide autorizar la cuenta de Google — hay que pasar por _Configuración
avanzada → Ir a (proyecto sin verificar)_, que es lo normal en un script propio.

**Por qué tiene que ser este y no `onEdit`.** Los activadores simples (`onEdit`,
`onOpen`) no pueden hacer peticiones de red ni leer las propiedades del script,
así que un `onEdit` normal jamás llamaría al backend. Por eso la función se llama
`alEditar` y hay que instalarla a mano.

**Verificar que dispara.** Cambia `Cupos AM` de un punto en la hoja `Centros` y
mira **Ejecuciones** (⏱️, debajo del reloj) en el editor: debe aparecer
`alEditar` en `Completed` en segundos. Si no aparece nada, el activador no está;
si aparece `Failed`, ábrelo y el log dice cuál propiedad falta.

Solo disparan solas estas columnas — lo demás se manda desde el menú:

| Hoja      | Columnas que sincronizan al editarlas                                             | A dónde manda               |
| --------- | --------------------------------------------------------------------------------- | --------------------------- |
| `Centros` | `Activo`, `Cupos AM`, `Cupos TARDE`, `Cupos PM`, `Cupos MADRUGADA`, `Cupos Noche` | `/api/hooks/sheets/centros` |
| `Turnos`  | `Cupos totales`, `Horario`, `Jornada`                                             | `/api/hooks/sheets/turnos`  |

Cada hoja va por su lado y a su propio endpoint. `Centros` describe el punto y su
capacidad nominal; **`Turnos` es lo único que crea un turno reservable**. Editar
un cupo en `Centros` ya no relee el tablero, y por eso ya no tarda veinte
segundos.

`Reservados` no está y no puede estar: esa columna la escribe el backend, y
ponerla ahí haría que cada inscripción reenviara el tablero entero.

## 9. Desplegar el Web app de la copia

Solo para el sentido backend → hoja (que una inscripción hecha en la web aparezca
en la hoja `Reservas`). _Implementar → Nueva implementación → ⚙️ Aplicación web_:

```
Ejecutar como       Yo
Quién tiene acceso  Cualquiera
```

Las dos cosas son necesarias: quien llama es tu backend, que no tiene sesión de
Google. «Cualquiera con cuenta de Google» devolvería un redirect al login. Quien
autoriza de verdad es `HOOK_TOKEN`, que `doPost` valida en el cuerpo.

La URL `/exec` que sale de ahí es `SHEETS_WEBHOOK_URL` en tu `.env.local`.
Reinicia `pnpm run dev` después de ponerla, y compruébala con el `curl` del
paso 3.

## 10. Verificar los tres sentidos

**Hoja → backend (menú).** En la copia: **VolBogotá → «¿A dónde estoy
sincronizando?»** debe mostrar solo la URL de tu túnel. Luego los dos ítems, en
este orden — los puntos primero, porque una fila del tablero que nombre un punto
que el catálogo aún no tiene se rechaza:

1. **«Sincronizar centros»** → `POST /api/hooks/sheets/centros`
2. **«Sincronizar turnos»** → `POST /api/hooks/sheets/turnos`

```bash
curl -s localhost:3000/api/centros | head -c 400
curl -s "localhost:3000/api/catalogos" | head -c 400
```

En `/api/catalogos` las jornadas salen **derivadas del tablero**, no de una lista
fija: si tu hoja `Turnos` trae `TARDE`, ahí tiene que aparecer, con el horario
que diga su columna `Horario`.

**Hoja → backend (automático).** Cambia `Cupos AM` en `Centros` sin tocar el
menú: la sincronización debe salir sola, y **solo** debe verse el POST a
`/centros`. Es la prueba del activador del paso 8.

**Backend → hoja.** Inscríbete en `http://localhost:3000` y la fila tiene que
aparecer sola en la hoja `Reservas` de tu copia, con su código `VB-`.

## Trampas conocidas

- **El Web app sirve la versión desplegada, no el código guardado.** Pegar el
  `sync.gs` nuevo y guardar no cambia nada hasta crear una **Nueva versión** en
  _Administrar implementaciones_. Síntoma: `onOpen` `Completed`, `doPost`
  `Failed`.
- **`getActiveSpreadsheet()` devuelve `null` dentro de `doPost`/`doGet`.** La
  hoja activa solo existe cuando el script corre desde su contenedor — un menú o
  un activador —, no en una petición HTTP. Para eso está la propiedad `SHEET_ID`.
- **El menú aparece sin activador instalado.** `onOpen` es simple; `alEditar` no.
- **Renombrar un punto crea un centro nuevo.** El vínculo entre `Centros` y
  `Turnos` es el nombre visible, que el backend convierte en id con `slugify`.
  Ver [`hoja-turnos.md`](hoja-turnos.md).
- **«Ningún backend respondió»** en el log del script casi siempre es el túnel
  muerto o una `API_URL` con barra final.

## Checklist

- [ ] Copia hecha desde la maestra
- [ ] Menú **VolBogotá** con «Sincronizar centros» y «Sincronizar turnos» separados (si sale «centros y turnos» junto: repegar `sync.gs` del repo)
- [ ] Copia compartida «cualquiera con el enlace · Lector» y el CSV responde
- [ ] `.env.local` con `SHEET_ID` de la copia, `SHEETS_HOOK_TOKEN` propio y `DB_DRIVER=memory`
- [ ] `pnpm run dev` arriba y `/api/health` responde
- [ ] Túnel arriba y `/api/health` responde **por la URL del túnel**
- [ ] Propiedades del script: `API_URL` = túnel, `HOOK_TOKEN` = tu token, `SHEET_ID` = la copia
- [ ] Activador `alEditar` · desde hoja de cálculo · Al editar, y `Ejecuciones` lo confirma
- [ ] Web app desplegado como **Yo / Cualquiera**, con versión nueva, y su `/exec` en `SHEETS_WEBHOOK_URL`
- [ ] `curl` al `/exec` devuelve JSON con el nombre de **tu** copia
- [ ] «¿A dónde estoy sincronizando?» muestra **solo** el túnel

---

**Estado al 14 de agosto de 2026.** La copia con la que se validó la jornada
noche es `1cA_toUQnXpbUbxDUjOGqtx7VHyuZdv2i2vxc-agTLHQ`. Ese es el patrón de
trabajo — el cambio de estructura se valida en una copia y solo después se lleva
a la maestra, junto con el `sync.gs` que lo entiende.

**Lo que cambió con la separación de las hojas.** `Centros` dejó de crear turnos:
ahora es informativa y cada fila de `Turnos` es un turno literal, con su punto,
día, jornada, horario y cupos. Tres consecuencias al probar:

- **Las jornadas son abiertas.** `AM`, `TARDE`, `PM`, `MADRUGADA`, y también
  `MADRUGADA 1` o `MADRUGADA 2` si el programa las abre. Se normalizan a una sola
  grafía y el id del turno queda slugificado (`punto_2026-08-15_madrugada-2`).
- **El horario lo manda la columna `Horario` de la fila.** Solo si la dejas vacía
  se usa el default de la jornada (`AM 8–13`, `TARDE 13–18`, `PM 18–21`). Una
  jornada inventada sin horario propio se rechaza con su motivo en `Validación`,
  en vez de publicar una hora que nadie autorizó.
- **Un turno que desaparece del tablero se cierra, no se borra** — una reserva
  puede seguir apuntándole. Ojo con esto en la primera sincronización: todo lo
  que no esté en la hoja queda en `CERRADO` con cupos 0.
