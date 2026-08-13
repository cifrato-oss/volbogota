import type { ApiResponse } from "@/types/api";

/**
 * Typed client for our own API.
 *
 * It unwraps the `ApiResponse` envelope so callers work with plain data, and
 * turns any failure into `ApiClientError`. Use it from Client Components; from
 * Server Components prefer calling the service in `src/server/modules` directly
 * instead of paying for an HTTP round trip to ourselves.
 */

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type RequestOptions = Omit<RequestInit, "body" | "method"> & {
  body?: unknown;
  searchParams?: Record<string, string | number | boolean | undefined>;
};

async function request<TData>(
  method: string,
  path: string,
  { body, searchParams, headers, ...init }: RequestOptions = {},
): Promise<TData> {
  const url = new URL(path, getBaseUrl());

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    ...init,
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (response.status === 204) {
    return undefined as TData;
  }

  let payload: ApiResponse<TData>;

  try {
    payload = (await response.json()) as ApiResponse<TData>;
  } catch {
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

  return payload.data;
}

function getBaseUrl(): string {
  // In the browser, relative URLs already resolve against the current origin.
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export const apiClient = {
  get: <TData>(path: string, options?: RequestOptions) => request<TData>("GET", path, options),
  post: <TData>(path: string, options?: RequestOptions) => request<TData>("POST", path, options),
  put: <TData>(path: string, options?: RequestOptions) => request<TData>("PUT", path, options),
  patch: <TData>(path: string, options?: RequestOptions) => request<TData>("PATCH", path, options),
  delete: <TData>(path: string, options?: RequestOptions) =>
    request<TData>("DELETE", path, options),
};
