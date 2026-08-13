import { ApiClientError } from "@/lib/api-client";

const FALLBACK = "No pudimos cargar la información. Inténtalo de nuevo.";

/**
 * Extracts a user-facing message from an unknown thrown value.
 *
 * `ApiClientError` already carries a Spanish, end-user-ready message from the
 * API; anything else falls back to a generic message.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  return FALLBACK;
}
