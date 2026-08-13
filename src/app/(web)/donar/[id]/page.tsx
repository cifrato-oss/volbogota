import { CentroDonar } from "@/components/donaciones/centro-donar";

export default async function DonarCentroPage({ params }: PageProps<"/donar/[id]">) {
  const { id } = await params;
  return <CentroDonar centroId={id} />;
}
