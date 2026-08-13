import { getHealthStatus } from "@/server/modules/health/health.service";

export default function HomePage() {
  // Server Components call the service directly — no HTTP hop to our own API.
  const health = getHealthStatus();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">VolBogotá</h1>
        <p className="text-foreground/70">
          Estructura base lista. El front vive en <code>src/app/(web)</code> y la API en{" "}
          <code>src/app/api</code>.
        </p>
      </div>

      <dl className="border-foreground/10 grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-foreground/60">Entorno</dt>
          <dd className="font-mono">{health.environment}</dd>
        </div>
        <div>
          <dt className="text-foreground/60">Estado</dt>
          <dd className="font-mono">{health.status}</dd>
        </div>
      </dl>
    </div>
  );
}
