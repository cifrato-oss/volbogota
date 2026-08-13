import { NextResponse } from "next/server";

import type { ApiFailure, ApiSuccess } from "@/types/api";

import { AppError } from "./errors";

/** 200 with a data payload. */
export function ok<TData>(data: TData, init?: ResponseInit): NextResponse<ApiSuccess<TData>> {
  return NextResponse.json({ success: true, data } as const, { status: 200, ...init });
}

/** 201 for resources created by the request. */
export function created<TData>(data: TData, init?: ResponseInit): NextResponse<ApiSuccess<TData>> {
  return NextResponse.json({ success: true, data } as const, { status: 201, ...init });
}

/** 204 for successful mutations with nothing to return. */
export function noContent(init?: ResponseInit): NextResponse<null> {
  return new NextResponse(null, { status: 204, ...init });
}

/** Failure envelope built from an `AppError`. */
export function fail(error: AppError, init?: ResponseInit): NextResponse<ApiFailure> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    } as const,
    { status: error.status, ...init },
  );
}
