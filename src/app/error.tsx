"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary. Rendered when a Server or Client Component throws
 * below the root layout.
 *
 * This runs in the browser, so it must not import anything from `src/server`.
 * Wire it to a client-side reporter (Sentry, Datadog RUM…) when one is added.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled render error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col items-start justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold tracking-tight">Algo salió mal</h1>
      <p className="text-foreground/70">
        No pudimos cargar esta página. Intenta de nuevo en un momento.
      </p>
      <button
        type="button"
        onClick={reset}
        className="border-foreground/20 hover:bg-foreground/5 rounded-md border px-4 py-2 text-sm transition-colors"
      >
        Reintentar
      </button>
    </div>
  );
}
