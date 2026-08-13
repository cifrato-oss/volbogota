# VolBogotá

Monolito en **Next.js 16 (App Router) + TypeScript**: el front y la API viven en
el mismo repo y el mismo deploy, pero separados por capas.

## Requisitos

- Node.js `>= 20.19` (ver `engines` en `package.json`)
- npm 10+

## Arranque

```bash
npm install
cp .env.example .env.local
npm run dev
```

- Front: http://localhost:3000
- API: http://localhost:3000/api/health

## Scripts

| Script               | Qué hace                                         |
| -------------------- | ------------------------------------------------ |
| `npm run dev`        | Servidor de desarrollo                           |
| `npm run build`      | Build de producción                              |
| `npm start`          | Sirve el build                                   |
| `npm run lint`       | ESLint                                           |
| `npm run typecheck`  | Genera tipos de rutas y corre `tsc --noEmit`     |
| `npm run format`     | Prettier sobre todo el repo                      |
| `npm test`           | Vitest (una pasada)                              |
| `npm run test:watch` | Vitest en watch                                  |
| `npm run verify`     | Formato + lint + tipos + tests (lo mismo que CI) |

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
Localmente es lo mismo que `npm run verify`.
