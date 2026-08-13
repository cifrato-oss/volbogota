import { CentroDetalle } from "@/components/centros/centro-detalle";

export default async function CentroPage({ params }: PageProps<"/centros/[id]">) {
  const { id } = await params;
  return <CentroDetalle centroId={id} />;
}
