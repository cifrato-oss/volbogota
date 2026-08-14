"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";
import useCreateReserva from "@/queries/reservas/useCreateReserva";
import { reservaFormSchema, type ReservaFormValues } from "@/schemas/reserva-form";
import type { Reserva, Turno, ValidationErrorDetail } from "@/types/volbogota";

type ReservaFormProps = {
  turno: Turno | null;
  /** True when a shift was picked but its cupos are now 0 (or it closed). */
  turnoLleno?: boolean;
  onSuccess: (reserva: Reserva) => void;
};

const FIELD_NAMES: readonly (keyof ReservaFormValues)[] = [
  "nombre",
  "apellido",
  "celular",
  "edad",
  "eps",
  "nombreEmergencia",
  "contactoEmergencia",
  "autorizoDatos",
];

function isFieldName(value: string): value is keyof ReservaFormValues {
  return (FIELD_NAMES as readonly string[]).includes(value);
}

/** Volunteer sign-up form. Submits to POST /api/reservas via `useCreateReserva`. */
export function ReservaForm({ turno, turnoLleno = false, onSuccess }: ReservaFormProps) {
  const mutation = useCreateReserva();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<ReservaFormValues>({
    resolver: zodResolver(reservaFormSchema),
    defaultValues: {
      nombre: "",
      apellido: "",
      celular: "",
      edad: "",
      eps: "",
      nombreEmergencia: "",
      contactoEmergencia: "",
      autorizoDatos: false,
    },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit((values) => {
    if (!turno) {
      setFormError("Selecciona un turno antes de continuar.");
      return;
    }
    setFormError(null);

    mutation.mutate(
      {
        nombre: values.nombre,
        apellido: values.apellido,
        celular: values.celular,
        edad: Number(values.edad),
        eps: values.eps,
        nombreEmergencia: values.nombreEmergencia,
        contactoEmergencia: values.contactoEmergencia,
        turnoId: turno.id,
        autorizoDatos: true,
      },
      {
        onSuccess,
        onError: (error) => {
          // 422: map each field error back onto its input.
          if (
            error instanceof ApiClientError &&
            error.status === 422 &&
            Array.isArray(error.details)
          ) {
            let mappedAny = false;
            for (const detail of error.details as ValidationErrorDetail[]) {
              if (isFieldName(detail.field)) {
                setError(detail.field, { message: detail.message });
                mappedAny = true;
              }
            }
            if (mappedAny) return;
          }
          // 409 (shift full/closed/duplicate) and anything else: a banner.
          // useCreateReserva invalidates the shift cache on settle (both paths),
          // so the selector's availability refreshes right after this error.
          setFormError(getErrorMessage(error));
        },
      },
    );
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Nombre" htmlFor="nombre" error={errors.nombre?.message}>
          <Input
            id="nombre"
            autoComplete="given-name"
            aria-invalid={Boolean(errors.nombre)}
            {...register("nombre")}
          />
        </FormField>

        <FormField label="Apellido" htmlFor="apellido" error={errors.apellido?.message}>
          <Input
            id="apellido"
            autoComplete="family-name"
            aria-invalid={Boolean(errors.apellido)}
            {...register("apellido")}
          />
        </FormField>

        <FormField
          label="Celular"
          htmlFor="celular"
          error={errors.celular?.message}
          hint="10 dígitos, empieza por 3."
        >
          <Input
            id="celular"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="3001234567"
            aria-invalid={Boolean(errors.celular)}
            {...register("celular")}
          />
        </FormField>

        <FormField label="Edad" htmlFor="edad" error={errors.edad?.message}>
          <Input
            id="edad"
            type="number"
            inputMode="numeric"
            min={18}
            max={110}
            aria-invalid={Boolean(errors.edad)}
            {...register("edad")}
          />
        </FormField>
      </div>

      <FormField
        label="EPS"
        htmlFor="eps"
        error={errors.eps?.message}
        hint="Tu entidad promotora de salud."
      >
        <Input
          id="eps"
          autoComplete="off"
          placeholder="Sura, Sanitas, Nueva EPS…"
          aria-invalid={Boolean(errors.eps)}
          {...register("eps")}
        />
      </FormField>

      <fieldset className="space-y-3 border-0 p-0">
        <legend className="text-sm font-medium">Contacto de emergencia</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Nombre"
            htmlFor="nombreEmergencia"
            error={errors.nombreEmergencia?.message}
          >
            <Input
              id="nombreEmergencia"
              autoComplete="off"
              aria-invalid={Boolean(errors.nombreEmergencia)}
              {...register("nombreEmergencia")}
            />
          </FormField>

          <FormField
            label="Celular"
            htmlFor="contactoEmergencia"
            error={errors.contactoEmergencia?.message}
            hint="Puede ser celular o fijo."
          >
            <Input
              id="contactoEmergencia"
              inputMode="tel"
              autoComplete="off"
              placeholder="3001234567"
              aria-invalid={Boolean(errors.contactoEmergencia)}
              {...register("contactoEmergencia")}
            />
          </FormField>
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Controller
          control={control}
          name="autorizoDatos"
          render={({ field }) => (
            <div className="flex items-start gap-2">
              <Checkbox
                id="autorizoDatos"
                className="mt-0.5"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                onBlur={field.onBlur}
                aria-invalid={Boolean(errors.autorizoDatos)}
                aria-describedby={errors.autorizoDatos ? "autorizoDatos-error" : undefined}
              />
              <label htmlFor="autorizoDatos" className="text-sm leading-snug">
                Autorizo el{" "}
                <Link
                  href="/tratamiento-datos"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="underline underline-offset-2 hover:opacity-80"
                >
                  tratamiento de mis datos personales
                </Link>{" "}
                para la gestión del voluntariado.
              </label>
            </div>
          )}
        />
        {errors.autorizoDatos ? (
          <p id="autorizoDatos-error" className="text-destructive text-xs" role="alert">
            {errors.autorizoDatos.message}
          </p>
        ) : null}
      </div>

      {formError ? (
        <div
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm"
          role="alert"
        >
          {formError}
        </div>
      ) : null}

      <div className="space-y-2">
        <Button
          type="submit"
          size="lg"
          disabled={mutation.isPending || !turno}
          className="flex w-full sm:mx-auto sm:max-w-xs"
        >
          {mutation.isPending ? "Enviando…" : "Reservar cupo"}
        </Button>
        {!turno ? (
          <p
            className={cn(
              "text-xs sm:text-center",
              turnoLleno ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {turnoLleno
              ? "El turno que elegiste se quedó sin cupos. Elige otro turno para continuar."
              : "Selecciona un turno arriba para habilitar la reserva."}
          </p>
        ) : null}
      </div>
    </form>
  );
}
