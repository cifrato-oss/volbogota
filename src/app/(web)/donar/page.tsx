import type { Metadata } from "next";

import { ElegirCentro } from "@/components/centros/elegir-centro";

export const metadata: Metadata = {
  title: "Quiero donar",
};

export default function DonarPage() {
  return (
    <ElegirCentro
      titulo="Elige un centro para donar"
      descripcion="Consulta qué necesita cada punto de acopio antes de llevar tu donación."
      hrefBase="/donar"
      mostrarCupos={false}
    />
  );
}
