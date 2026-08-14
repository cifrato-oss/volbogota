import type { Metadata } from "next";

import { DonarSangre } from "@/components/sangre/donar-sangre";

export const metadata: Metadata = {
  title: "Quiero donar sangre",
  description:
    "Mira qué tipos de sangre está recibiendo hoy cada punto de donación en Bogotá y confirma antes de desplazarte.",
};

export default function SangrePage() {
  return <DonarSangre />;
}
