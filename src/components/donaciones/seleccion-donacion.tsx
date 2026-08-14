"use client";

import { Alert02Icon, CheckmarkCircle02Icon, GiftIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { ErrorState } from "@/components/shared/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsIndicator, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { CATEGORIAS_DONACION } from "@/constants/donaciones";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";
import useCrearSolicitudDonacion from "@/queries/donaciones/useCrearSolicitudDonacion";
import useNecesidadesRealtime from "@/queries/donaciones/useNecesidadesRealtime";
import type {
  CategoriaDonacion,
  NecesidadesCategoria,
  Semaforo,
  SolicitudDonacionItem,
} from "@/types/donaciones";

const SEMAFORO_UI: Record<Semaforo, { emoji: string; label: string; className: string }> = {
  ROJO: {
    emoji: "🔴",
    label: "Se necesita",
    className: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  },
  VERDE: {
    emoji: "🟢",
    label: "Suficiente",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  GRIS: {
    emoji: "⚪",
    label: "No aplica",
    className: "bg-muted text-muted-foreground",
  },
};

function SemaforoBadge({ semaforo }: { semaforo: Semaforo }) {
  const ui = SEMAFORO_UI[semaforo];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        ui.className,
      )}
    >
      <span aria-hidden>{ui.emoji}</span>
      {ui.label}
    </span>
  );
}

/** Small badge showing how many items are picked in a category (visual only + SR text). */
function CountPill({ children }: { children: number }) {
  return (
    <span className="ml-1.5 inline-flex items-center">
      <span
        aria-hidden
        className="bg-primary/10 text-primary inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums"
      >
        {children}
      </span>
      <span className="sr-only">{children} seleccionados</span>
    </span>
  );
}

/** Handling reminder shown only at the top of the Alimentos list. */
function AvisoAlimentos() {
  return (
    <div
      role="note"
      className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <HugeiconsIcon
        icon={Alert02Icon}
        className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
      />
      <p className="text-pretty">
        <strong className="font-semibold">Recuerda:</strong> revisa siempre las fechas de
        vencimiento. Tacha el código de barras del producto y escríbele encima “donación”.
      </p>
    </div>
  );
}

/** The selectable rows for one category. Only 🔴 SE_NECESITA items can be ticked. */
function ListaElementos({
  categoria,
  seleccionados,
  onToggle,
}: {
  categoria: NecesidadesCategoria;
  seleccionados: Record<string, SolicitudDonacionItem>;
  onToggle: (item: SolicitudDonacionItem, checked: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      {categoria.mensaje ? (
        <p className="text-muted-foreground text-xs">{categoria.mensaje}</p>
      ) : null}
      <ul className="divide-border divide-y overflow-hidden rounded-xl border">
        {categoria.elementos.map((elemento) => {
          const seleccionable = elemento.semaforo === "ROJO";
          const checked = Boolean(seleccionados[elemento.elementoId]);
          // Only 🔴 items can be picked. An item already in the basket that a
          // coordinator later flips off stays togglable, so the donor can still
          // clear it in place instead of being stuck with a checked-disabled box.
          const bloqueado = !seleccionable && !checked;
          const inputId = `donar-${elemento.elementoId}`;
          return (
            <li
              key={elemento.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-sm transition-colors",
                checked
                  ? "bg-primary/5 hover:bg-primary/10"
                  : bloqueado
                    ? null
                    : "hover:bg-muted/60",
              )}
            >
              <Checkbox
                id={inputId}
                checked={checked}
                disabled={bloqueado}
                onCheckedChange={(value) =>
                  onToggle(
                    {
                      elementoId: elemento.elementoId,
                      categoria: categoria.categoria,
                      elemento: elemento.elemento,
                    },
                    value,
                  )
                }
              />
              <Label
                htmlFor={inputId}
                className={cn(
                  "flex-1 font-normal",
                  bloqueado ? "text-muted-foreground cursor-not-allowed" : "cursor-pointer",
                )}
              >
                {elemento.elemento}
              </Label>
              <SemaforoBadge semaforo={elemento.semaforo} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * "Quiero donar" checkout. Browse a center's needs by category — tabs on
 * desktop, a select on mobile — and tick what you can bring. Only items the
 * center actively needs (🔴 SE_NECESITA) are selectable. The basket is held here
 * keyed by `elementoId`, so it survives switching categories; the summary at the
 * bottom confirms the whole basket before submitting it to
 * `POST /api/donaciones/solicitudes`.
 */
export function SeleccionDonacion({ centroId }: { centroId: string }) {
  const { data, isPending, isError } = useNecesidadesRealtime(centroId);
  const mutation = useCrearSolicitudDonacion();

  const [seleccionados, setSeleccionados] = useState<Record<string, SolicitudDonacionItem>>({});
  const [categoria, setCategoria] = useState<CategoriaDonacion | null>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the confirmation heading once the donation is registered so
  // screen-reader users land on it (the form subtree is replaced).
  useEffect(() => {
    if (mutation.isSuccess) successHeadingRef.current?.focus();
  }, [mutation.isSuccess]);

  const items = Object.values(seleccionados);
  const hayBasket = items.length > 0;

  const conteoPorCategoria = useMemo(() => {
    const conteo: Partial<Record<CategoriaDonacion, number>> = {};
    for (const item of Object.values(seleccionados)) {
      conteo[item.categoria] = (conteo[item.categoria] ?? 0) + 1;
    }
    return conteo;
  }, [seleccionados]);

  const resumen = useMemo(() => {
    const grupos = new Map<CategoriaDonacion, SolicitudDonacionItem[]>();
    for (const item of Object.values(seleccionados)) {
      const lista = grupos.get(item.categoria) ?? [];
      lista.push(item);
      grupos.set(item.categoria, lista);
    }
    return CATEGORIAS_DONACION.filter((cat) => grupos.has(cat)).map((cat) => ({
      categoria: cat,
      items: grupos.get(cat)!,
    }));
  }, [seleccionados]);

  function alternar(item: SolicitudDonacionItem, checked: boolean) {
    setSeleccionados((prev) => {
      const next = { ...prev };
      if (checked) next[item.elementoId] = item;
      else delete next[item.elementoId];
      return next;
    });
  }

  function reiniciar() {
    mutation.reset();
    setSeleccionados({});
  }

  // Success is terminal: show the confirmation and let the donor start over.
  if (mutation.isSuccess) {
    const { codigo, totalItems } = mutation.data;
    return (
      <section
        className="border-border bg-card space-y-4 rounded-2xl border p-8 text-center"
        aria-live="polite"
      >
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-8" />
        </div>
        <div className="space-y-1">
          <h2
            ref={successHeadingRef}
            tabIndex={-1}
            className="font-heading text-xl font-semibold tracking-tight outline-none"
          >
            ¡Gracias por tu donación!
          </h2>
          <p className="text-muted-foreground mx-auto max-w-md text-sm text-pretty">
            Registramos {totalItems} {totalItems === 1 ? "elemento" : "elementos"}. Acércate al
            punto de acopio con tu donación y presenta tu código.
          </p>
        </div>
        <p className="text-sm">
          Código de referencia:{" "}
          <span className="font-mono text-base font-semibold tracking-wide">{codigo}</span>
        </p>
        <Button variant="outline" onClick={reiniciar}>
          Hacer otra donación
        </Button>
      </section>
    );
  }

  const categorias = data?.categorias ?? [];
  const primeraCategoria = categorias[0];
  const nombres = categorias.map((cat) => cat.categoria);
  const categoriaActiva =
    categoria && nombres.includes(categoria) ? categoria : (primeraCategoria?.categoria ?? null);

  // The category browser mirrors the original early-return precedence, but never
  // hides an in-progress basket: on error/empty needs with items already picked,
  // we show a note and keep the confirmation + submit below.
  let navegador: ReactNode;
  if (isError) {
    navegador = hayBasket ? (
      <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center text-sm">
        No pudimos actualizar la lista de necesidades, pero tu selección sigue disponible para
        enviarla.
      </p>
    ) : (
      <ErrorState message="No pudimos cargar las necesidades de este centro." />
    );
  } else if (isPending || !data) {
    navegador = (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  } else if (!primeraCategoria || !categoriaActiva) {
    navegador = (
      <p className="text-muted-foreground rounded-xl border border-dashed px-6 py-10 text-center text-sm">
        Este centro todavía no tiene una lista de necesidades para donar.
      </p>
    );
  } else {
    navegador = (
      <Tabs
        value={categoriaActiva}
        onValueChange={(value) => setCategoria(value as CategoriaDonacion)}
      >
        {/* Mobile: a select stands in for the tabs. */}
        <div className="md:hidden">
          <Label htmlFor="categoria-donacion" className="sr-only">
            Categoría
          </Label>
          <Select
            value={categoriaActiva}
            onValueChange={(value) => setCategoria(value as CategoriaDonacion)}
          >
            <SelectTrigger id="categoria-donacion" aria-label="Categoría">
              <SelectValue placeholder="Selecciona una categoría" />
            </SelectTrigger>
            <SelectContent>
              {categorias.map((cat) => (
                <SelectItem key={cat.categoria} value={cat.categoria}>
                  <span className="flex items-center">
                    {cat.categoria}
                    {conteoPorCategoria[cat.categoria] ? (
                      <CountPill>{conteoPorCategoria[cat.categoria]!}</CountPill>
                    ) : null}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Desktop: real tabs. */}
        <TabsList aria-label="Categorías de donación" className="hidden md:flex">
          {categorias.map((cat) => (
            <TabsTab key={cat.categoria} value={cat.categoria}>
              {cat.categoria}
              {conteoPorCategoria[cat.categoria] ? (
                <CountPill>{conteoPorCategoria[cat.categoria]!}</CountPill>
              ) : null}
            </TabsTab>
          ))}
          <TabsIndicator />
        </TabsList>

        {/* Shared panels drive a proper tab/tabpanel relationship on desktop and
            still render the active category's items on mobile. */}
        {categorias.map((cat) => (
          <TabsPanel key={cat.categoria} value={cat.categoria} className="space-y-3">
            {cat.categoria === "Alimentos" ? <AvisoAlimentos /> : null}
            <ListaElementos categoria={cat} seleccionados={seleccionados} onToggle={alternar} />
          </TabsPanel>
        ))}
      </Tabs>
    );
  }

  const mostrarConfirmacion = hayBasket || Boolean(data && primeraCategoria);

  return (
    <section className="space-y-6" aria-labelledby="donar-heading">
      <div className="space-y-1">
        <h2 id="donar-heading" className="text-lg font-semibold tracking-tight">
          ¿Qué quieres donar?
        </h2>
        <p className="text-muted-foreground text-sm text-pretty">
          Elige una categoría y marca los elementos que el centro necesita. Tu selección se guarda
          mientras navegas entre categorías.
        </p>
      </div>

      {navegador}

      {mostrarConfirmacion ? (
        <div className="border-border bg-card space-y-4 rounded-2xl border p-5">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={GiftIcon} className="text-primary size-5" />
            <h3 className="font-medium">Confirma tu donación</h3>
          </div>

          {items.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aún no has seleccionado elementos. Marca lo que puedas donar en las categorías de
              arriba.
            </p>
          ) : (
            <div className="space-y-3">
              {resumen.map(({ categoria: cat, items: grupo }) => (
                <div key={cat}>
                  <p className="text-muted-foreground text-xs font-medium">{cat}</p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {grupo.map((item) => (
                      <li key={item.elementoId}>
                        <Badge variant="secondary" className="h-6 gap-1 pr-1 pl-2.5">
                          {item.elemento}
                          <button
                            type="button"
                            onClick={() => alternar(item, false)}
                            aria-label={`Quitar ${item.elemento}`}
                            className="hover:bg-foreground/10 -mr-0.5 flex size-4 items-center justify-center rounded-full leading-none transition-colors"
                          >
                            <span aria-hidden>×</span>
                          </button>
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {mutation.isError ? (
            <p className="text-destructive text-sm" role="alert">
              {getErrorMessage(mutation.error)}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              {items.length === 1
                ? "1 elemento seleccionado"
                : `${items.length} elementos seleccionados`}
            </p>
            <Button
              size="lg"
              onClick={() => mutation.mutate({ centroId, items })}
              disabled={items.length === 0 || mutation.isPending}
            >
              {mutation.isPending ? "Enviando…" : "Hacer donación"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
