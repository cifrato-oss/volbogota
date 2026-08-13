import { ok } from "@/server/http/responses";
import { withRoute } from "@/server/http/route-handler";
import { listarCentros } from "@/server/modules/catalogo/catalogo.service";
import { asegurarCatalogo } from "@/server/modules/sheets/sheets.csv";

export const dynamic = "force-dynamic";

export const GET = withRoute(async () => {
  let centros = await listarCentros();

  // Un backend recién arrancado no tiene nada hasta que alguien edite la hoja.
  // Antes que devolver una lista vacía, se lee la hoja y se responde con datos.
  await asegurarCatalogo(centros.length > 0);
  if (centros.length === 0) centros = await listarCentros();

  return ok(centros);
});
