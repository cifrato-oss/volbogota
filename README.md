# Centros de Acopio Bogotá

Monolito en **Next.js 16 (App Router) + TypeScript**: el front y la API viven en
el mismo repo y el mismo deploy, pero separados por capas.

Web de voluntariado para los **centros de acopio oficiales de Bogotá**, del 13 al
16 de agosto de 2026. En producción: [centrosdeacopiobogota.org](https://centrosdeacopiobogota.org).

## Quiénes lo hicieron

- **Andrés Sanabria** — [@80asv](https://github.com/80asv)
- **Julio Márquez** — [@julio439](https://github.com/julio439)
- **Cristian Rojas** — [@MrSancks](https://github.com/MrSancks)
- **Juan Bernal** — [@jfbg98](https://github.com/jfbg98) — mantiene el repo, la
  infraestructura y el proyecto de Firebase

## Requisitos

- Node.js `>= 20.19` (ver `engines` en `package.json`)
- pnpm 10+ (el proyecto lo declara en `packageManager`)

## De dónde sale la data

```
Excel maestro  ──import──▶  Firestore  ──▶  API  ──▶  front
(administración)            (runtime)
```

El **Excel es la fuente administrativa**: los coordinadores editan centros,
cupos, direcciones y actividades ahí. **Firestore es el runtime**: atiende las
lecturas del evento y absorbe las inscripciones concurrentes con transacciones.

`scripts/import-excel.ts` empuja el catálogo del Excel a Firestore. Correrlo de
nuevo es la forma normal de que un cambio de cupos llegue a producción: los
contadores de `reservados` se leen antes y se conservan, así que **un import
nunca borra inscripciones**.

## Arranque

```bash
pnpm install
cp .env.example .env.local
gcloud auth application-default login
gcloud auth application-default set-quota-project volbogota
pnpm run dev
```

No hay que poner ninguna llave: `.env.example` ya trae `FIREBASE_PROJECT_ID=volbogota`
y las credenciales salen de ADC, que la app detecta sola. Eso deja el entorno local
leyendo y escribiendo **la misma base que sirve el evento** — ver
[Firestore desde local](#firestore-desde-local) antes de probar una inscripción.

- Front: http://localhost:3000
- API: http://localhost:3000/api/health
- Contrato de endpoints para el front: [`docs/api.md`](docs/api.md)

### Sin credenciales, con el emulador

Levanta Firestore local, siembra el Excel y arranca la app apuntando ahí:

```bash
pnpm run emulator
```

```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 pnpm run import:excel -- --file ./Voluntariado_Bogota_Centros_Acopio.xlsx
```

```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 pnpm run dev
```

## Scripts

| Script                     | Qué hace                                         |
| -------------------------- | ------------------------------------------------ |
| `pnpm run dev`             | Servidor de desarrollo                           |
| `pnpm run build`           | Build de producción                              |
| `pnpm start`               | Sirve el build                                   |
| `pnpm run lint`            | ESLint                                           |
| `pnpm run typecheck`       | Genera tipos de rutas y corre `tsc --noEmit`     |
| `pnpm run format`          | Prettier sobre todo el repo                      |
| `pnpm test`                | Vitest (una pasada)                              |
| `pnpm run test:watch`      | Vitest en watch                                  |
| `pnpm run verify`          | Formato + lint + tipos + tests (lo mismo que CI) |
| `pnpm run emulator`        | Firestore local en el puerto 8080                |
| `pnpm run import:excel`    | Excel → Firestore. `--file <ruta>`, `--dry`      |
| `pnpm run stress:reservas` | Prueba de sobreventa contra el emulador          |
| `pnpm run admin:hash`      | Genera el `passwordHash` de una cuenta del panel |
| `pnpm run limpiar:cupos`   | Deja `cuposPorJornada` solo con AM y PM          |
| `pnpm run limpiar:noche`   | Borra los turnos huérfanos de la jornada noche   |

## Estructura

```
src/
├── app/                       # Rutas (App Router)
│   ├── (web)/                 # Front público — el grupo no aparece en la URL
│   │   ├── layout.tsx         # Shell: header + footer
│   │   └── page.tsx
│   ├── api/                   # API HTTP — route handlers delgados
│   │   └── health/route.ts    # GET /api/health
│   ├── layout.tsx             # Layout raíz: <html>, fuentes, metadata
│   ├── error.tsx              # Error boundary
│   ├── not-found.tsx          # 404
│   └── globals.css            # Tailwind v4 + tokens de tema
│
├── server/                    # Backend. Nunca se importa desde el cliente.
│   ├── config/env.ts          # Variables de entorno validadas con zod
│   ├── db/client.ts           # Punto único de acceso a datos (+ singleton)
│   ├── http/
│   │   ├── errors.ts          # AppError y atajos (notFound, forbidden…)
│   │   ├── responses.ts       # ok / created / noContent / fail
│   │   └── route-handler.ts   # withRoute, parseJsonBody, parseSearchParams
│   ├── lib/logger.ts          # Logger estructurado
│   └── modules/               # Un módulo por dominio (ver su README)
│       └── health/
│
├── components/                # UI reutilizable (sin acceso a src/server)
│   └── layout/
├── config/site.ts             # Metadata estática del producto
├── lib/                       # Utilidades de cliente y servidor
│   ├── api-client.ts          # Cliente tipado de nuestra propia API
│   └── utils.ts               # cn()
└── types/api.ts               # Sobre de respuesta compartido
```

### La regla de las capas

```
route handler / Server Component  →  service (src/server/modules)  →  repository  →  db
```

- El **route handler** parsea, valida y formatea. No tiene lógica de negocio.
- El **service** es la única capa que decide. Lanza `AppError`, nunca `Response`.
- Un **Server Component** llama al service directo, sin dar la vuelta por HTTP.
- `src/components` y `src/lib` **no pueden importar `src/server`** — hay una regla
  de ESLint que lo bloquea, porque arrastraría secretos al bundle del navegador.

## Contrato de la API

Toda respuesta usa el mismo sobre (`src/types/api.ts`):

```jsonc
// 200
{ "success": true, "data": { "status": "ok" } }

// 4xx / 5xx
{ "success": false, "error": { "code": "NOT_FOUND", "message": "El equipo no existe." } }
```

Un endpoint nuevo se ve así:

```ts
// src/app/api/teams/route.ts
import { created } from "@/server/http/responses";
import { parseJsonBody, withRoute } from "@/server/http/route-handler";
import { createTeam } from "@/server/modules/teams/teams.service";
import { createTeamSchema } from "@/server/modules/teams/teams.schema";

export const POST = withRoute(async (request) => {
  const input = await parseJsonBody(request, createTeamSchema);
  return created(await createTeam(input));
});
```

`withRoute` captura cualquier error: los `AppError` salen con su status y su
mensaje; cualquier otra excepción se registra y sale como 500 genérico, sin
filtrar detalles internos.

## Convenciones

- **Código en inglés** (nombres, comentarios, commits). **Textos de UI y mensajes
  de la API en español**, que es lo que ve el usuario.
- Variables de entorno: se declaran en `src/server/config/env.ts`, se documentan
  en `.env.example` y recién ahí se usan. Si falta una, la app no arranca.
- Middleware: en Next 16 el archivo se llama `proxy.ts` (antes `middleware.ts`) y
  va en `src/`.
- Tests junto al código (`*.test.ts`). Los de componentes abren con
  `// @vitest-environment jsdom`.

## CI

`.github/workflows/ci.yml` corre formato, lint, tipos, tests y build en cada PR.
Localmente es lo mismo que `pnpm run verify`.

## Producción: crear el proyecto de Firebase

> Esto **ya está hecho**: el proyecto es `volbogota` (número `761468343345`), con
> Firestore `(default)` en `us-central1`. Queda como referencia de cómo se armó y
> por si hay que rehacerlo. Para desplegar, ver
> [Despliegue: Firebase App Hosting](#despliegue-firebase-app-hosting).
>
> Los alias de `.firebaserc`: `prod` → `volbogota`, `dev` → `volbogota-dev`,
> `acopio` → `centros-de-acopio-5e6a1` (el proyecto donde se probó primero, que no
> es el que sirve).

Estos pasos van una sola vez, en orden. El paso 4 no es opcional.

**1. Crear el proyecto** en [console.firebase.google.com](https://console.firebase.google.com)
y habilitar **Firestore Database**. Región `nam5` o `us-central1`.

> Al crear Firestore, la consola ofrece «modo de prueba». Ese modo deja la base
> **abierta a lectura y escritura para cualquiera** durante 30 días. Acá se
> guardan nombres, celulares y edades de voluntarios: elige **modo bloqueado** y
> deja que el paso 4 ponga las reglas reales.

**2. Credenciales.** Hay tres caminos, y el primero puede estar cerrado:

**a) Cuenta de servicio** (⚙️ → Cuentas de servicio → Generar nueva clave privada).
Descarga un JSON con `client_email` y `private_key`. Muchas organizaciones lo
prohíben con `constraints/iam.disableServiceAccountKeyCreation` — si el botón
falla, es eso, y no hay que insistir: es un guardarraíl razonable.

**b) Credenciales por defecto**, para desarrollo sin llave descargable:

```bash
gcloud auth application-default login
```

La app las detecta sola; no hay que poner `FIREBASE_CLIENT_EMAIL` ni
`FIREBASE_PRIVATE_KEY`.

**c) Identidad del runtime**, que es lo que conviene en producción: desplegando
en Cloud Run o Firebase App Hosting, la cuenta de servicio va adjunta al
servicio y **no existe ninguna llave que filtrar**. Es la única opción que no
tiene un secreto rotando por ahí.

**2-bis. Generar la clave de servicio** (solo si vas por la vía a): Configuración del proyecto → Cuentas de
servicio → _Generar nueva clave privada_. Descarga el JSON.

**3. Escribir `.env.local`**:

```bash
cp .env.example .env.local
```

Por la vía **b** o **c** no hay nada más que llenar. Por la vía **a**, a partir del
JSON descargado — que **no se commitea**; `.gitignore` ya cubre `.env*`:

- `FIREBASE_PROJECT_ID` → `project_id` del JSON
- `FIREBASE_CLIENT_EMAIL` → `client_email`
- `FIREBASE_PRIVATE_KEY` → `private_key`, **entre comillas y con los `\n` tal
  como vienen** en el archivo

**4. Publicar las reglas de seguridad.** Sin esto la base queda con las reglas
por defecto del proyecto, no con las de este repo:

```bash
npx firebase login
```

```bash
npx firebase use --add
```

```bash
pnpm run firebase:rules
```

**5. Sembrar el catálogo** desde el Excel maestro:

```bash
pnpm run import:excel -- --file ./Voluntariado_Bogota_Centros_Acopio_2.xlsx
```

**6. Comprobar** que la app ve lo que debe:

```bash
pnpm run verify:firestore
```

### La sal no se rota

`CELULAR_HASH_SALT` entra en el digest que deduplica inscripciones por turno.
Cambiarla después de que existan inscripciones reales invalida todos los
digests guardados y rompe la deduplicación en silencio. Se define una vez, antes
de abrir la web, y se guarda donde se guardan los secretos del deploy.

## Despliegue: Firebase App Hosting

El backend `volbogota` está conectado al repo `cifrato-oss/volbogota` y **despliega
solo en cada push a `main`**. No hay comando de deploy que correr; el equivalente es
hacer merge. El dominio de App Hosting es
`https://volbogota--volbogota.us-central1.hosted.app`.

La configuración del deploy vive en [`apphosting.yaml`](apphosting.yaml), commiteado
acá. Sin ese archivo el backend arranca sin ninguna variable y todo `/api/*`
responde 500 — la home sí sirve, así que el síntoma es una web que se ve bien y no
deja inscribirse.

**Firestore no necesita credenciales.** App Hosting adjunta la cuenta de servicio
`firebase-app-hosting-compute@volbogota.iam.gserviceaccount.com` al servicio, y
`db/drivers/firestore.driver.ts` cae solo al camino de ADC. Esa cuenta ya trae
permisos de Firestore por `roles/firebase.sdkAdminServiceAgent`, así que no hay
ningún rol que conceder ni ninguna llave que rotar.

### Los secretos

Van en Cloud Secret Manager, no en `apphosting.yaml`, que solo lleva el nombre:

```bash
openssl rand -base64 48 | tr -d '\n' | npx firebase apphosting:secrets:set CELULAR_HASH_SALT --project volbogota --data-file - --force
```

```bash
openssl rand -base64 48 | tr -d '\n' | npx firebase apphosting:secrets:set ADMIN_API_TOKEN --project volbogota --data-file - --force
```

El `tr -d '\n'` no es cosmético: `openssl` cierra con un salto de línea y el token
quedaría con un `\n` adentro, que no coincide con lo que se manda en el header.

`--force` crea el secreto y le concede acceso a la cuenta de servicio del backend
de una sola vez. Para leer uno después:

```bash
npx firebase apphosting:secrets:access ADMIN_API_TOKEN --project volbogota
```

## Dominio propio con DNS en Route 53

App Hosting no expone los dominios por CLI: se agregan en la consola de Firebase
(**App Hosting → el backend → Dominios personalizados → Agregar dominio**), y ahí
mismo salen los registros que hay que crear. El proceso tiene dos rondas:

1. **Verificación de propiedad.** Firebase da un registro `TXT` en el apex. Se crea
   en la hosted zone de Route 53 y se espera a que verifique.
2. **Registros de servicio.** Una vez verificado, Firebase entrega los `A` (y
   `AAAA`) del apex y el `CNAME` de `www`. El certificado TLS lo emite y renueva
   Google; no hay nada que hacer con ACM.

El apex no admite `CNAME` por especificación de DNS, y el **Alias de Route 53 no
sirve acá**: solo apunta a recursos de AWS (CloudFront, ELB, S3, otro registro de la
misma zona), no a un hostname externo como `hosted.app`. App Hosting resuelve esto
entregando un registro `A` con una IP anycast, y lo hace igual para el apex y para
`www` — los dos son un `A` a la misma IP, no un `CNAME`.

Cada hostname es un recurso `Domain` aparte y trae su propio `TXT` de propiedad. El
`CNAME` de `_acme-challenge_*`, en cambio, es uno solo para los dos.

Los TTL bajos (300s) valen la pena hasta que todo resuelva: un TTL de un día
convierte un registro equivocado en un día de espera.

Al terminar hay que cambiar `NEXT_PUBLIC_APP_URL` en `apphosting.yaml` por el
dominio propio. Next.js incrusta las `NEXT_PUBLIC_*` en el bundle durante
`next build`, así que **no basta con cambiar la variable**: hace falta un
despliegue nuevo para que el JavaScript del navegador la vea.

## Firestore desde local

`gcloud auth application-default login` deja las credenciales por defecto en el
sistema y la app las detecta sola. `set-quota-project` evita el `PERMISSION_DENIED`
por proyecto de cuota que aparece en varias APIs de Google:

```bash
gcloud auth application-default login
```

```bash
gcloud auth application-default set-quota-project volbogota
```

```bash
pnpm run verify:firestore
```

Esto apunta local **a la base de producción**, que es lo que se decidió: se trabaja
contra los datos de verdad. Con dos consecuencias que conviene tener presentes:

- Una inscripción de prueba desde local **queda guardada en producción**. Para
  probar sin tocarla: `DB_DRIVER=memory`, o el emulador.
- La sal de local no es la del deploy. `env.ts` cae a una sal de desarrollo cuando
  `CELULAR_HASH_SALT` está vacía, así que un digest hecho desde local no deduplica
  contra los de producción aunque vayan a la misma base. Para que coincidan, traer
  la de verdad con `apphosting:secrets:access` y ponerla en `.env.local`.
