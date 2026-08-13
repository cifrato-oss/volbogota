/**
 * End-to-end check of the coordinator endpoints against a running app.
 *
 * Covers what unit tests cannot: that cancelling actually gives the seat back,
 * that the freed phone can sign up again, and that the CSV comes out with the
 * BOM and separators Excel needs under a Spanish locale.
 *
 *   pnpm run emulator
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 pnpm run dev
 *   ADMIN_API_TOKEN=<el mismo del server> pnpm run check:admin
 *
 * It creates real reservations, so point it at the emulator, never at production.
 */

const TOKEN = process.env.ADMIN_API_TOKEN;
if (!TOKEN) {
  console.error("Falta ADMIN_API_TOKEN: debe ser el mismo con el que corre el servidor.");
  process.exit(1);
}
const BASE = "http://localhost:3000";
const TURNO = process.env.TURNO ?? "punto-usaquen_2026-08-15_pm";

// Fresh numbers on every run: a phone can only hold one booking per shift, so
// reusing fixed ones makes the second run fail on a duplicate instead of on a
// real defect.
const serie = String(Math.floor(Math.random() * 9000) + 1000);
const celular = (n) => `3${serie}0${String(n).padStart(4, "0")}`;

const admin = (path, init = {}) =>
  fetch(`${BASE}${path}`, {
    ...init,
    headers: { "x-admin-token": TOKEN, "Content-Type": "application/json", ...init.headers },
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

const inscribir = (celular) =>
  fetch(`${BASE}/api/reservas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombre: "Voluntario",
      apellido: "De Prueba",
      celular,
      edad: 30,
      turnoId: TURNO,
      autorizoDatos: true,
    }),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));

const cupos = async () => {
  const r = await fetch(`${BASE}/api/turnos/${TURNO}`).then((x) => x.json());
  return `${r.data.reservados} reservados · ${r.data.disponibles} disponibles`;
};

const ok = (cond, label, extra = "") =>
  console.log(`${cond ? "✓" : "✗"} ${label}${extra ? ` — ${extra}` : ""}`);

const a = await inscribir(celular(1));
if (a.status !== 201) {
  console.error(`No pude inscribir en ${TURNO}: ${a.status} ${JSON.stringify(a.body)}`);
  process.exit(1);
}
const b = await inscribir(celular(2));
const codA = a.body.data.codigo;
const codB = b.body.data.codigo;
console.log(`inscritos: ${codA} · ${codB}   (${await cupos()})\n`);

// --- flujo de estados -------------------------------------------------------
let r = await admin(`/api/admin/reservas/${codA}`, {
  method: "PATCH",
  body: JSON.stringify({ estado: "CONFIRMADO" }),
});
ok(r.status === 200 && r.body.data.estado === "CONFIRMADO", "RESERVADO → CONFIRMADO");

r = await admin(`/api/admin/reservas/${codA}`, {
  method: "PATCH",
  body: JSON.stringify({ estado: "CONFIRMADO" }),
});
ok(r.status === 200, "repetir el mismo estado es idempotente", `${r.status}`);

r = await admin(`/api/admin/reservas/${codA}`, {
  method: "PATCH",
  body: JSON.stringify({ estado: "RESERVADO" }),
});
ok(r.status === 409, "CONFIRMADO → RESERVADO se rechaza", r.body?.error?.message);

// --- check-in / check-out ---------------------------------------------------
r = await admin(`/api/admin/reservas/${codA}/check-in`, {
  method: "POST",
  body: JSON.stringify({ hora: "13:10" }),
});
ok(r.status === 200 && r.body.data.estado === "ASISTIO", "check-in marca ASISTIO solo");

r = await admin(`/api/admin/reservas/${codA}/check-out`, {
  method: "POST",
  body: JSON.stringify({ hora: "17:00" }),
});
ok(r.status === 200 && r.body.data.horas === 3.83, "horas donadas", `${r.body.data?.horas} h`);

r = await admin(`/api/admin/reservas/${codB}/check-out`, {
  method: "POST",
  body: JSON.stringify({ hora: "17:00" }),
});
ok(r.status === 409, "check-out sin check-in se rechaza", r.body?.error?.message);

await admin(`/api/admin/reservas/${codB}/check-in`, {
  method: "POST",
  body: JSON.stringify({ hora: "15:00" }),
});
r = await admin(`/api/admin/reservas/${codB}/check-out`, {
  method: "POST",
  body: JSON.stringify({ hora: "14:00" }),
});
ok(r.status === 409, "salida anterior a la entrada se rechaza", r.body?.error?.message);

// --- cancelación libera el cupo ---------------------------------------------
r = await admin(`/api/admin/reservas/${codB}`, {
  method: "PATCH",
  body: JSON.stringify({ estado: "CANCELADO" }),
});
ok(r.status === 409, "no se cancela una asistencia ya registrada", r.body?.error?.message);

const antes = await cupos();
const c = await inscribir(celular(3));
const conLaNueva = await cupos();
r = await admin(`/api/admin/reservas/${c.body.data.codigo}`, {
  method: "PATCH",
  body: JSON.stringify({ estado: "CANCELADO" }),
});
const trasCancelar = await cupos();
ok(r.status === 200, "RESERVADO → CANCELADO");
ok(trasCancelar === antes, "cancelar devuelve el cupo");
console.log(`   ${antes}  →  ${conLaNueva}  →  ${trasCancelar}`);

const rehacer = await inscribir(celular(3));
ok(rehacer.status === 201, "el celular liberado puede reinscribirse", `${rehacer.status}`);

// --- listado, resumen y export ----------------------------------------------
r = await admin(`/api/admin/reservas?turno=${TURNO}&limite=2`);
ok(
  r.status === 200 && r.body.data.reservas.length === 2,
  "listado pagina",
  `siguiente: ${r.body.data?.siguiente ? "sí" : "no"}`,
);

r = await admin(`/api/admin/reservas?q=${celular(1)}`);
ok(r.status === 200 && r.body.data.reservas.length >= 1, "búsqueda por celular");

r = await admin(`/api/admin/resumen`);
const res = r.body.data;
ok(
  r.status === 200,
  "resumen",
  `${res?.cupos.reservados}/${res?.cupos.ofertados} cupos · ${res?.asistencia.horasDonadas} h donadas`,
);

const csv = await fetch(`${BASE}/api/admin/export`, { headers: { "x-admin-token": TOKEN } });
const bytes = Buffer.from(await csv.arrayBuffer());
ok(csv.status === 200, "export CSV", csv.headers.get("content-disposition"));

// Checked on the raw bytes: fetch().text() strips the BOM while decoding, so
// reading the string would always report it missing even when it is there.
const tieneBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
const texto = bytes.toString("utf8").replace(/^\uFEFF/, "");
ok(tieneBom, "lleva BOM UTF-8 (si no, Excel en español rompe los acentos)");
ok(texto.split("\r\n")[0].includes(";"), "separado por ; (lo que espera Excel en es-CO)");
console.log("   " + texto.split("\r\n").slice(0, 2).join("\n   "));
