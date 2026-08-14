"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/get-error-message";

/**
 * Coordinator panel.
 *
 * The session lives in an `httpOnly` cookie, so this component never holds a
 * credential: it cannot read the cookie, and it does not need to — the browser
 * attaches it to every same-origin request on its own. An XSS on this page has
 * nothing to steal, which is the difference from keeping a token in
 * `sessionStorage`.
 *
 * That also means the page cannot tell whether it is logged in by looking at
 * anything local. It asks `/api/admin/sesion`, and that answer is the source of
 * truth for which half of this component renders.
 */

type Sesion = { usuario: string | null; nombre: string };

type ResumenOperativo = {
  cupos: { ofertados: number; reservados: number; disponibles: number; ocupacion: number };
  reservas: { total: number };
  asistencia: { asistieron: number; sinMarcar: number };
  porCentro: Array<{
    id: string;
    nombre: string;
    cupos: number;
    reservados: number;
    disponibles: number;
    ocupacion: number;
    asistieron: number;
  }>;
};

type Sobre<T> = { success: boolean; data?: T; error?: { message?: string } };

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const respuesta = await fetch(url, { cache: "no-store", ...init });
  const sobre = (await respuesta.json()) as Sobre<T>;

  if (!respuesta.ok || !sobre.success || sobre.data === undefined) {
    throw new Error(sobre.error?.message ?? "No se pudo completar la operación.");
  }

  return sobre.data;
}

export function PanelAdmin() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [resumen, setResumen] = useState<ResumenOperativo | null>(null);
  const [comprobando, setComprobando] = useState(true);

  const cargarResumen = useCallback(async () => {
    setResumen(await pedir<ResumenOperativo>("/api/admin/resumen"));
  }, []);

  // A 401 here is the normal case for a visitor who has not logged in, so it
  // ends in the login form rather than an error state.
  useEffect(() => {
    void (async () => {
      try {
        const quien = await pedir<Sesion>("/api/admin/sesion");
        setSesion(quien);
        await cargarResumen();
      } catch {
        setSesion(null);
      } finally {
        setComprobando(false);
      }
    })();
  }, [cargarResumen]);

  if (comprobando) {
    return <p className="text-muted-foreground py-12 text-center text-sm">Cargando…</p>;
  }

  if (!sesion) {
    return (
      <Login
        onEntrar={async (quien) => {
          setSesion(quien);
          await cargarResumen();
        }}
      />
    );
  }

  async function salir() {
    await fetch("/api/admin/logout", { method: "POST" });
    setSesion(null);
    setResumen(null);
  }

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Panel de coordinación</h1>
          <p className="text-muted-foreground text-sm">{sesion.nombre}</p>
        </div>

        <Button variant="outline" size="sm" onClick={() => void salir()}>
          Salir
        </Button>
      </header>

      {resumen ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Cifra titulo="Cupos ofertados" valor={resumen.cupos.ofertados} />
            <Cifra titulo="Reservados" valor={resumen.cupos.reservados} />
            <Cifra titulo="Disponibles" valor={resumen.cupos.disponibles} />
            <Cifra titulo="Sin marcar" valor={resumen.asistencia.sinMarcar} />
          </section>

          <DescargarPorCentro centros={resumen.porCentro} />

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold">Por centro</h2>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead className="text-muted-foreground border-b text-left">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Centro</th>
                    <th className="py-2 pr-4 text-right font-medium">Cupos</th>
                    <th className="py-2 pr-4 text-right font-medium">Reservados</th>
                    <th className="py-2 pr-4 text-right font-medium">Disponibles</th>
                    <th className="py-2 text-right font-medium">Ocupación</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.porCentro.map((centro) => (
                    <tr key={centro.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{centro.nombre}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{centro.cupos}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{centro.reservados}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{centro.disponibles}</td>
                      <td className="py-2 text-right tabular-nums">
                        {Math.round(centro.ocupacion * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">Cargando el resumen…</p>
      )}
    </div>
  );
}

function Cifra({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <Card className="p-4">
      <p className="text-muted-foreground text-xs">{titulo}</p>
      <p className="font-heading text-2xl font-bold tabular-nums">
        {valor.toLocaleString("es-CO")}
      </p>
    </Card>
  );
}

/**
 * Downloads the reservations of one centre.
 *
 * The cookie would let a plain `<a href>` work, but a failure would then land in
 * the browser as a file called `.csv` containing an error in JSON. Fetching lets
 * an expired session say so on screen.
 */
function DescargarPorCentro({ centros }: { centros: ResumenOperativo["porCentro"] }) {
  const [centroId, setCentroId] = useState("");
  const [fecha, setFecha] = useState("");
  const [bajando, setBajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function descargar() {
    setBajando(true);
    setError(null);

    try {
      const params = new URLSearchParams({ formato: "xlsx" });
      if (centroId) params.set("centro", centroId);
      if (fecha) params.set("fecha", fecha);

      const respuesta = await fetch(`/api/admin/export?${params}`, { cache: "no-store" });

      if (!respuesta.ok) {
        const sobre = (await respuesta.json().catch(() => null)) as Sobre<never> | null;
        throw new Error(sobre?.error?.message ?? "No se pudo generar el archivo.");
      }

      const blob = await respuesta.blob();
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      const partes = ["reservas", centroId || "todos", fecha].filter(Boolean);

      enlace.href = url;
      enlace.download = `${partes.join("-")}.xlsx`;
      enlace.click();

      // Without this the blob stays in memory for the life of the document.
      URL.revokeObjectURL(url);
    } catch (causa) {
      setError(getErrorMessage(causa));
    } finally {
      setBajando(false);
    }
  }

  return (
    <Card className="space-y-4 p-4">
      <div>
        <h2 className="font-heading text-lg font-semibold">Descargar inscritos</h2>
        <p className="text-muted-foreground text-sm">
          Abre en Excel. Deja el centro en blanco para bajar todos.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="centro">Centro de acopio</Label>
          <select
            id="centro"
            value={centroId}
            onChange={(evento) => setCentroId(evento.target.value)}
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          >
            <option value="">Todos los centros</option>
            {centros.map((centro) => (
              <option key={centro.id} value={centro.id}>
                {centro.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fecha">Fecha (opcional)</Label>
          <Input
            id="fecha"
            type="date"
            value={fecha}
            onChange={(evento) => setFecha(evento.target.value)}
          />
        </div>

        <Button onClick={() => void descargar()} disabled={bajando}>
          {bajando ? "Generando…" : "Descargar"}
        </Button>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </Card>
  );
}

function Login({ onEntrar }: { onEntrar: (sesion: Sesion) => Promise<void> }) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar() {
    setEntrando(true);
    setError(null);

    try {
      const quien = await pedir<Sesion>("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: usuario.trim(), password }),
      });

      setPassword("");
      await onEntrar(quien);
    } catch (causa) {
      setError(getErrorMessage(causa));
    } finally {
      setEntrando(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 py-12">
      <header className="space-y-1 text-center">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Panel de coordinación</h1>
        <p className="text-muted-foreground text-sm">Entra con tu usuario y contraseña.</p>
      </header>

      <form
        className="space-y-3"
        onSubmit={(evento) => {
          evento.preventDefault();
          void enviar();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="usuario">Usuario</Label>
          <Input
            id="usuario"
            autoComplete="username"
            autoCapitalize="none"
            value={usuario}
            onChange={(evento) => setUsuario(evento.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(evento) => setPassword(evento.target.value)}
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={entrando || !usuario.trim() || !password}
        >
          {entrando ? "Entrando…" : "Entrar"}
        </Button>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </form>
    </div>
  );
}
