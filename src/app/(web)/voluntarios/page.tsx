import type { Metadata } from "next";

import { ElegirCentro } from "@/components/centros/elegir-centro";

export const metadata: Metadata = {
  title: "Quiero ser voluntario",
};

export default function VoluntariosPage() {
  return (
    <ElegirCentro
      titulo="Elige un centro y reserva tu cupo"
      descripcion="Selecciona la fecha y hora que mejor se ajuste a tu disponibilidad."
      hrefBase="/voluntarios"
    />
  );
}
