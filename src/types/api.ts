/**
 * Shared contract between the API layer and any consumer (web app, mobile, scripts).
 * Every endpoint under `src/app/api` answers with this envelope.
 */

export type ApiSuccess<TData> = {
  success: true;
  data: TData;
};

export type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<TData> = ApiSuccess<TData> | ApiFailure;
