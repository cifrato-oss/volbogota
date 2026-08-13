import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col items-start justify-center gap-4 px-4">
      <p className="text-foreground/60 font-mono text-sm">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Página no encontrada</h1>
      <p className="text-foreground/70">La ruta que buscas no existe o fue movida.</p>
      <Link
        href="/"
        className="border-foreground/20 hover:bg-foreground/5 rounded-md border px-4 py-2 text-sm transition-colors"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
