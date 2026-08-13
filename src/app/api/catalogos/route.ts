import { ok } from "@/server/http/responses";
import { withRoute } from "@/server/http/route-handler";
import { obtenerCatalogos } from "@/server/modules/catalogo/catalogo.service";
import { asegurarCatalogo } from "@/server/modules/sheets/sheets.csv";

export const dynamic = "force-dynamic";

export const GET = withRoute(async () => {
  let catalogos = await obtenerCatalogos();

  await asegurarCatalogo(catalogos.centros.length > 0);
  if (catalogos.centros.length === 0) catalogos = await obtenerCatalogos();

  return ok(catalogos);
});
