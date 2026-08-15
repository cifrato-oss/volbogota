/**
 * Seeds the blood bank list, for a screen that has nothing to show yet.
 *
 *   pnpm run seed:sangre                 # writes to Firestore and prints the TSV
 *   pnpm run seed:sangre -- --solo-tsv   # prints the TSV, writes nothing
 *   pnpm run seed:sangre -- --limpiar    # deletes every bank it ever seeded
 *
 * Everything written here carries `esMock: true`, and the app hides those unless
 * `NEXT_PUBLIC_MOSTRAR_MOCK=true`. That is what makes it safe to run against
 * production, which is the only Firestore this project has: an invented bank is
 * visible to whoever is building the screen and to nobody else.
 *
 * The rows below are real Bogotá blood banks with real addresses, because mock
 * data that reads as mock ("Banco 1", "Calle 123") makes a screen impossible to
 * judge: nobody can tell whether the layout survives "IDCBIS - Banco Distrital
 * de Sangre" until they see that string in it.
 *
 * The `Tipo de Sangre` values are the interesting part. They cover every shape
 * the parser has to survive — one type, a family, a family plus a type, a blank,
 * and a hand-typed variant — because those are the cases that break in
 * production and never in a demo.
 *
 * Maps links are `?api=1&query=` searches rather than `maps.app.goo.gl` short
 * links, which cannot be invented: a fabricated short link resolves to nothing
 * and a coordinator would find out by tapping it.
 *
 * Coordinates are geocoded from the institution's name, one request at a time
 * with a pause between them — Nominatim asks for roughly one a second and this
 * runs once, by hand. Names resolve where addresses do not: "Cra. 104B #152B-40"
 * is not in OpenStreetMap, but "Clínica Shaio" is. A bank that does not resolve
 * gets no coordinates and therefore no pin, which is the honest outcome — a pin
 * on an approximate spot looks exactly like a pin on an exact one.
 */

import { COLLECTIONS, getDb } from "@/server/db/firestore";
import { idDeBanco, parsearTipos } from "@/server/modules/sangre/sangre.schema";

type FilaMock = {
  nombre: string;
  direccion: string;
  localidad: string;
  horario: string;
  /** Written exactly as a coordinator would type it into the cell. */
  tipos: string;
  recibiendo: "Sí" | "No";
};

const BANCOS: FilaMock[] = [
  {
    nombre: "Hemocentro Distrital - IDCBIS",
    direccion: "Cra. 32 #18-81",
    localidad: "Los Mártires",
    horario: "7:00 a.m. - 7:00 p.m.",
    tipos: "O-, RH-",
    recibiendo: "Sí",
  },
  {
    nombre: "Banco de Sangre Cruz Roja Colombiana",
    direccion: "Av. Cra. 68 #68B-31",
    localidad: "Barrios Unidos",
    horario: "7:00 a.m. - 5:00 p.m.",
    tipos: "Todos",
    recibiendo: "Sí",
  },
  {
    nombre: "Hospital El Tunal - Banco de Sangre",
    direccion: "Cra. 20 #47B-35 Sur",
    localidad: "Tunjuelito",
    horario: "8:00 a.m. - 9:00 p.m.",
    tipos: "A+",
    recibiendo: "Sí",
  },
  {
    nombre: "Fundación Santa Fe de Bogotá",
    direccion: "Cra. 7 #117-15",
    localidad: "Usaquén",
    horario: "6:00 a.m. - 4:00 p.m.",
    tipos: "O+, O-",
    recibiendo: "Sí",
  },
  {
    nombre: "Clínica Shaio - Banco de Sangre",
    direccion: "Dg. 115A #70C-75",
    localidad: "Suba",
    horario: "7:00 a.m. - 6:00 p.m.",
    tipos: "RH-",
    recibiendo: "Sí",
  },
  {
    nombre: "Hospital Militar Central",
    direccion: "Tv. 3C #49-02",
    localidad: "Chapinero",
    horario: "7:00 a.m. - 3:00 p.m.",
    tipos: "O+, A+, B+",
    recibiendo: "Sí",
  },
  {
    nombre: "Hospital Universitario San Ignacio",
    direccion: "Cra. 7 #40-62",
    localidad: "Chapinero",
    horario: "7:00 a.m. - 4:00 p.m.",
    // A hand-typed variant on purpose: the parser has to fold it.
    tipos: "O positivo",
    recibiendo: "Sí",
  },
  {
    nombre: "Hospital de Kennedy - Banco de Sangre",
    direccion: "Tv. 74F #40B-54 Sur",
    localidad: "Kennedy",
    horario: "8:00 a.m. - 6:00 p.m.",
    tipos: "AB-, AB+",
    recibiendo: "Sí",
  },
  {
    nombre: "Clínica del Country",
    direccion: "Cra. 16 #82-57",
    localidad: "Chapinero",
    horario: "8:00 a.m. - 2:00 p.m.",
    tipos: "B-",
    recibiendo: "Sí",
  },
  {
    nombre: "Hospital Simón Bolívar",
    direccion: "Cra. 7 #165-00",
    localidad: "Usaquén",
    horario: "7:00 a.m. - 7:00 p.m.",
    tipos: "RH+",
    recibiendo: "Sí",
  },
  {
    nombre: "Hospital de Suba - Banco de Sangre",
    direccion: "Cra. 104B #152B-40",
    localidad: "Suba",
    horario: "8:00 a.m. - 5:00 p.m.",
    // Blank on purpose: open, but nobody said which types. Its own card state.
    tipos: "",
    recibiendo: "Sí",
  },
  {
    nombre: "Clínica Colsanitas - Sede Reina Sofía",
    direccion: "Cra. 31 #125A-23",
    localidad: "Usaquén",
    horario: "6:00 a.m. - 2:00 p.m.",
    tipos: "O-",
    recibiendo: "Sí",
  },
  {
    nombre: "Hospital de Engativá",
    direccion: "Tv. 100A #80A-50",
    localidad: "Engativá",
    horario: "8:00 a.m. - 4:00 p.m.",
    tipos: "A-, B-",
    recibiendo: "No",
  },
  {
    nombre: "Punto Secretaría Distrital de Salud",
    direccion: "Cra. 32 #12-81",
    localidad: "Los Mártires",
    horario: "9:00 a.m. - 5:00 p.m.",
    tipos: "",
    recibiendo: "No",
  },
  {
    nombre: "Hospital de Bosa - Banco de Sangre",
    direccion: "Cra. 87C #62-15 Sur",
    localidad: "Bosa",
    horario: "8:00 a.m. - 3:00 p.m.",
    tipos: "O+, RH-",
    recibiendo: "No",
  },
  {
    nombre: "Clínica Marly",
    direccion: "Calle 50 #9-67",
    localidad: "Chapinero",
    horario: "7:00 a.m. - 1:00 p.m.",
    tipos: "AB+",
    recibiendo: "No",
  },
];

const COLUMNAS = [
  "Banco de Sangre",
  "Dirección",
  "Localidad",
  "Horario oficial del banco",
  "Tipo de Sangre",
  "Link Google Maps",
  "Recibiendo hoy",
];

type Punto = { lat: number; lng: number };

/**
 * The institution without the words that describe the service inside it.
 *
 * "Hospital El Tunal" is in OpenStreetMap; "Hospital El Tunal - Banco de
 * Sangre" is not, because the blood bank is a department and the map knows
 * buildings. Stripping the suffix took this from seven names resolving to
 * fifteen.
 */
function soloLaInstitucion(nombre: string): string {
  return nombre
    .replace(/\s*-\s*Banco (Distrital )?de Sangre\s*$/i, "")
    .replace(/^Banco de Sangre\s+/i, "")
    .replace(/^Hemocentro Distrital\s*-\s*/i, "")
    .replace(/^Punto\s+/i, "")
    .replace(/\s*-\s*Sede\s+/i, " ")
    .trim();
}

async function geocodificar(nombre: string): Promise<Punto | null> {
  const exacto = await buscar(nombre);
  if (exacto) return exacto;

  const limpio = soloLaInstitucion(nombre);
  if (limpio === nombre) return null;

  await esperar(1200);
  return buscar(limpio);
}

async function buscar(nombre: string): Promise<Punto | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${nombre}, Bogotá, Colombia`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "co");

  try {
    const respuesta = await fetch(url, {
      headers: { "user-agent": "volbogota-seed/1.0", "accept-language": "es" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!respuesta.ok) return null;

    const [primero] = (await respuesta.json()) as Array<{ lat: string; lon: string }>;
    if (!primero) return null;

    const punto = { lat: Number(primero.lat), lng: Number(primero.lon) };
    // Same guard the sync uses: a point outside Bogotá is a wrong answer, and a
    // wrong pin is worse than none because nobody can tell.
    return punto.lat > 3.8 && punto.lat < 5.2 && punto.lng > -74.6 && punto.lng < -73.7
      ? punto
      : null;
  } catch {
    return null;
  }
}

function esperar(ms: number): Promise<void> {
  return new Promise((listo) => setTimeout(listo, ms));
}

function linkMaps(fila: FilaMock): string {
  const consulta = encodeURIComponent(`${fila.nombre}, ${fila.direccion}, Bogotá`);
  return `https://www.google.com/maps/search/?api=1&query=${consulta}`;
}

/** Tab-separated, which is what a spreadsheet splits into columns on paste. */
function comoTsv(): string {
  const filas = BANCOS.map((fila) =>
    [
      fila.nombre,
      fila.direccion,
      fila.localidad,
      fila.horario,
      fila.tipos,
      linkMaps(fila),
      fila.recibiendo,
    ].join("\t"),
  );

  return [COLUMNAS.join("\t"), ...filas].join("\n");
}

async function escribir(): Promise<void> {
  const db = getDb();
  const lote = db.batch();
  const ahora = new Date().toISOString();

  const puntos = new Map<string, Punto | null>();
  for (const fila of BANCOS) {
    const punto = await geocodificar(fila.nombre);
    puntos.set(fila.nombre, punto);
    console.log(
      punto
        ? `  ✓ ${fila.nombre.padEnd(42)} ${punto.lat.toFixed(5)}, ${punto.lng.toFixed(5)}`
        : `  · ${fila.nombre.padEnd(42)} sin ubicación (no tendrá pin)`,
    );
    await esperar(1200);
  }

  for (const fila of BANCOS) {
    // Prefixed so a seeded bank can never land on a real one's document. Ids
    // come from the name, and these are real Bogotá banks by design — without
    // the prefix, "Hospital El Tunal - Banco de Sangre" overwrote the row a
    // coordinator maintains and tagged it as mock, which in production reads as
    // the bank disappearing.
    const id = `mock-${idDeBanco(fila.nombre)}`;
    lote.set(db.collection(COLLECTIONS.bancosSangre).doc(id), {
      id,
      nombre: fila.nombre,
      direccion: fila.direccion,
      localidad: fila.localidad,
      horarioOficial: fila.horario,
      linkMaps: linkMaps(fila),
      tiposQueRecibe: parsearTipos(fila.tipos),
      resumenTipos: fila.tipos || null,
      recibiendoHoy: fila.recibiendo === "Sí",
      activo: true,
      lat: puntos.get(fila.nombre)?.lat ?? null,
      lng: puntos.get(fila.nombre)?.lng ?? null,
      actualizadoEn: ahora,
      // The tag that keeps invented banks out of production. The app hides
      // anything carrying it unless `NEXT_PUBLIC_MOSTRAR_MOCK=true`, and
      // `--limpiar` deletes exactly the documents that carry it — so seeding
      // against prod is reversible and never reaches a donor.
      esMock: true,
    });
  }

  await lote.commit();
}

/**
 * Deletes every seeded bank and nothing else.
 *
 * Keyed on the tag rather than on the names in this file, so a row renamed or
 * removed here still gets cleaned up. A bank a coordinator typed into the sheet
 * has no tag and is never touched.
 */
async function limpiar(): Promise<number> {
  const db = getDb();
  const encontrados = await db
    .collection(COLLECTIONS.bancosSangre)
    .where("esMock", "==", true)
    .get();

  if (encontrados.empty) return 0;

  const lote = db.batch();
  encontrados.docs.forEach((doc) => lote.delete(doc.ref));
  await lote.commit();

  return encontrados.size;
}

async function main(): Promise<void> {
  if (process.argv.includes("--limpiar")) {
    const borrados = await limpiar();
    console.log(`✓ ${borrados} bancos de prueba borrados de Firestore`);
    return;
  }

  const soloTsv = process.argv.includes("--solo-tsv");

  if (!soloTsv) {
    await escribir();
    console.log(`✓ ${BANCOS.length} bancos escritos en Firestore\n`);
  }

  console.log(comoTsv());

  if (!soloTsv) {
    // What the parser made of each cell, because a family expands into types the
    // sheet never spells out and that is exactly where a silent miss would hide.
    console.log("\n--- cómo quedó interpretado cada 'Tipo de Sangre' ---");
    for (const fila of BANCOS) {
      const tipos = parsearTipos(fila.tipos);
      const leido = tipos.length ? tipos.join(", ") : "(sin tipos)";
      console.log(`  ${fila.tipos.padEnd(14) || "(vacío)".padEnd(14)} → ${leido}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
