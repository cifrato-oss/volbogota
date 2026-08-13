import axios, { AxiosError } from "axios";

import { ApiClientError } from "@/lib/api-client";
import type { ApiResponse } from "@/types/api";

/**
 * Axios instance for our own API.
 *
 * A response interceptor unwraps the `ApiResponse` envelope so callers receive
 * plain data in `response.data`, and turns any failure — HTTP error, envelope
 * error, or transport error — into an `ApiClientError`. Use it from Client
 * Components (typically via the TanStack Query hooks in `@/queries`); from
 * Server Components prefer calling the service in `src/server/modules` directly.
 */

function getBaseUrl(): string {
  // In the browser, relative URLs already resolve against the current origin.
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function isEnvelope(value: unknown): value is ApiResponse<unknown> {
  return typeof value === "object" && value !== null && "success" in value;
}

export const httpClient = axios.create({
  baseURL: getBaseUrl(),
  headers: { "Content-Type": "application/json" },
});

httpClient.interceptors.response.use(
  (response) => {
    const payload = response.data as unknown;

    if (!isEnvelope(payload)) {
      throw new ApiClientError(
        response.status,
        "INVALID_RESPONSE",
        "La respuesta del servidor no es válida.",
      );
    }

    if (!payload.success) {
      throw new ApiClientError(
        response.status,
        payload.error.code,
        payload.error.message,
        payload.error.details,
      );
    }

    response.data = payload.data;
    return response;
  },
  (error: unknown) => {
    if (error instanceof ApiClientError) {
      return Promise.reject(error);
    }

    if (error instanceof AxiosError) {
      const status = error.response?.status ?? 0;
      const payload = error.response?.data as unknown;

      if (isEnvelope(payload) && !payload.success) {
        return Promise.reject(
          new ApiClientError(
            status,
            payload.error.code,
            payload.error.message,
            payload.error.details,
          ),
        );
      }

      return Promise.reject(
        new ApiClientError(
          status,
          "NETWORK_ERROR",
          "No se pudo conectar con el servidor. Inténtalo de nuevo.",
        ),
      );
    }

    return Promise.reject(new ApiClientError(0, "UNKNOWN_ERROR", "Ocurrió un error inesperado."));
  },
);
