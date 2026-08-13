/**
 * Application-level errors.
 *
 * Throw these from services/repositories instead of returning ad-hoc responses.
 * `withRoute` turns them into the API failure envelope with the right status.
 */

export type AppErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE_ENTITY"
  | "TOO_MANY_REQUESTS"
  | "INTERNAL_SERVER_ERROR"
  | "SERVICE_UNAVAILABLE";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: AppErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

// Shorthands. Messages are user-facing, so they are written in Spanish.
export const badRequest = (message = "Solicitud inválida.", details?: unknown) =>
  new AppError("BAD_REQUEST", message, details);

export const unauthorized = (message = "No autenticado.", details?: unknown) =>
  new AppError("UNAUTHORIZED", message, details);

export const forbidden = (message = "No tienes permisos para esta acción.", details?: unknown) =>
  new AppError("FORBIDDEN", message, details);

export const notFound = (message = "Recurso no encontrado.", details?: unknown) =>
  new AppError("NOT_FOUND", message, details);

export const conflict = (message = "El recurso ya existe.", details?: unknown) =>
  new AppError("CONFLICT", message, details);

export const unprocessable = (message = "Los datos enviados no son válidos.", details?: unknown) =>
  new AppError("UNPROCESSABLE_ENTITY", message, details);

export const tooManyRequests = (message = "Demasiadas solicitudes.", details?: unknown) =>
  new AppError("TOO_MANY_REQUESTS", message, details);

export const internalError = (message = "Ocurrió un error inesperado.", details?: unknown) =>
  new AppError("INTERNAL_SERVER_ERROR", message, details);

/** Transient: the caller should retry the exact same request. */
export const serviceUnavailable = (
  message = "El servicio está congestionado. Intenta de nuevo en unos segundos.",
  details?: unknown,
) => new AppError("SERVICE_UNAVAILABLE", message, details);
