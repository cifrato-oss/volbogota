import type { Metadata } from "next";

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Tratamiento de datos personales",
  description:
    "Política de tratamiento de datos personales del programa de voluntariados de Bogotá, conforme a la Ley 1581 de 2012.",
};

const ACTUALIZADO = "13 de agosto de 2026";

export default function TratamientoDatosPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Política de tratamiento de datos personales
        </h1>
        <p className="text-muted-foreground text-sm">Última actualización: {ACTUALIZADO}</p>
      </header>

      <section className="space-y-3">
        <p className="text-pretty">
          En {siteConfig.name} tratamos tus datos personales conforme a la Ley 1581 de 2012 y sus
          decretos reglamentarios. Al inscribirte como voluntario autorizas de forma libre, previa e
          informada el tratamiento de tu información en los términos descritos aquí.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Responsable</h2>
        <p className="text-muted-foreground text-pretty">
          El responsable del tratamiento es el programa de {siteConfig.name}. Para cualquier
          solicitud relacionada con tus datos, escríbenos a{" "}
          <a href="mailto:datos@volbogota.gov.co" className="text-foreground underline">
            datos@volbogota.gov.co
          </a>
          .
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Datos que recolectamos</h2>
        <p className="text-muted-foreground">Para gestionar tu inscripción recolectamos:</p>
        <ul className="text-muted-foreground list-disc space-y-1 pl-5">
          <li>Nombre y apellido.</li>
          <li>Número de celular de contacto.</li>
          <li>Edad.</li>
          <li>El centro de acopio y la jornada en la que te inscribes.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Finalidad</h2>
        <p className="text-muted-foreground text-pretty">
          Usamos tus datos únicamente para: gestionar y confirmar tu cupo de voluntariado,
          contactarte con información logística de tu jornada, controlar el aforo de cada centro y
          generar reportes agregados de participación. No compartimos tu información con terceros
          con fines comerciales ni la usamos para publicidad.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Tus derechos</h2>
        <p className="text-muted-foreground text-pretty">
          Como titular puedes conocer, actualizar y rectificar tus datos; solicitar prueba de la
          autorización; ser informado sobre su uso; presentar quejas ante la Superintendencia de
          Industria y Comercio; y revocar la autorización o solicitar la supresión de tus datos
          cuando no exista un deber legal de conservarlos. Para ejercerlos, escríbenos al correo de
          contacto indicado arriba.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Conservación y seguridad</h2>
        <p className="text-muted-foreground text-pretty">
          Conservamos tus datos mientras dure el programa y por el tiempo necesario para cumplir
          obligaciones legales. Aplicamos medidas técnicas y administrativas razonables para
          proteger tu información contra acceso no autorizado, pérdida o alteración.
        </p>
      </section>

      <p className="text-muted-foreground text-sm">
        Este documento es de carácter informativo para el programa de voluntariados y puede
        actualizarse; publicaremos aquí cualquier cambio.
      </p>
    </article>
  );
}
