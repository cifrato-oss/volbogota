import { CentroDetalle } from "@/components/centros/centro-detalle";

export default async function VoluntarioCentroPage({ params }: PageProps<"/voluntarios/[id]">) {
  const { id } = await params;
  return <CentroDetalle centroId={id} />;
}
