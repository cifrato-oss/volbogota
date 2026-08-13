import type { z } from "zod";

import { logger } from "@/server/lib/logger";

/**
 * Parses a page of Firestore documents, dropping the ones that do not fit the
 * schema.
 *
 * A single bad document should cost its own card, not the whole page. Parsing
 * inside a `.map` used to throw, which reached `withRoute` as an unexpected
 * error and answered 500 — six good collection points vanishing because a
 * seventh was malformed. That is not hypothetical: coordinators edit Firestore
 * from the console during the event, and a document with `activo: true` and
 * nothing else is enough to do it.
 *
 * Every discard is logged with its id and the failing fields. Serving less data
 * than exists is its own kind of bug, and the log is what turns "a point is
 * missing from the website" into a one-minute lookup.
 */
export function parseValidos<TOut>(
  coleccion: string,
  docs: FirebaseFirestore.DocumentSnapshot[],
  schema: z.ZodType<TOut>,
  extras: Record<string, unknown> = {},
): TOut[] {
  const validos: TOut[] = [];

  for (const doc of docs) {
    const parsed = schema.safeParse({ ...extras, id: doc.id, ...doc.data() });

    if (parsed.success) {
      validos.push(parsed.data);
      continue;
    }

    logger.warn(`Documento descartado en '${coleccion}': no cumple el esquema.`, {
      id: doc.id,
      problemas: parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "(raíz)"}: ${issue.message}`,
      ),
    });
  }

  return validos;
}
