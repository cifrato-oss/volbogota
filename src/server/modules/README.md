# Módulos de dominio

Cada carpeta acá es un módulo del monolito: una porción del negocio con sus
reglas, sus datos y su contrato. La regla de oro es que un módulo **no importa
archivos internos de otro módulo**; si necesita algo de un vecino, lo pide a
través del servicio público de ese vecino.

## Estructura de un módulo

```
src/server/modules/<dominio>/
  <dominio>.schema.ts      # esquemas zod: entrada, salida y tipos derivados
  <dominio>.service.ts     # reglas de negocio (la única capa que orquesta)
  <dominio>.repository.ts  # acceso a datos, importa el cliente de src/server/db
  <dominio>.service.test.ts
```

No hace falta crear los cuatro archivos de entrada. Empieza por el servicio y
divide cuando el archivo lo pida.

## Flujo de una petición

```
src/app/api/<recurso>/route.ts   →  parsea y valida (withRoute + parseJsonBody)
src/server/modules/<dominio>/…   →  aplica reglas de negocio
src/server/db/client.ts          →  toca la base de datos
```

El route handler es una capa delgada: no debe contener lógica de negocio ni
consultas. Así el mismo servicio se puede reutilizar desde un Server Component,
un cron o un script sin pasar por HTTP.

## Errores

Los servicios lanzan `AppError` (ver `src/server/http/errors.ts`), nunca
devuelven `Response`. `withRoute` los traduce al sobre de error de la API con el
status correcto.

```ts
import { notFound } from "@/server/http/errors";

export async function getTeam(id: string) {
  const team = await teamRepository.findById(id);
  if (!team) throw notFound("El equipo no existe.");
  return team;
}
```
