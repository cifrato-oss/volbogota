/**
 * Database access point.
 *
 * No driver is wired up yet. When one is chosen (Prisma, Drizzle, Kysely, pg…),
 * instantiate it here through `singleton` and export it — everything else in
 * `src/server` should import the client from this module and nowhere else.
 *
 * ```ts
 * import { PrismaClient } from "@prisma/client";
 *
 * export const db = singleton("db", () => new PrismaClient());
 * ```
 */

type GlobalCache = typeof globalThis & {
  __volbogota_singletons__?: Map<string, unknown>;
};

/**
 * Keeps one instance alive across hot reloads. Without this, `next dev`
 * re-evaluates modules on every change and opens a new connection pool each time
 * until the database refuses connections.
 */
export function singleton<TValue>(name: string, factory: () => TValue): TValue {
  const cache = globalThis as GlobalCache;
  cache.__volbogota_singletons__ ??= new Map<string, unknown>();

  const existing = cache.__volbogota_singletons__.get(name);
  if (existing !== undefined) {
    return existing as TValue;
  }

  const created = factory();
  cache.__volbogota_singletons__.set(name, created);
  return created;
}
