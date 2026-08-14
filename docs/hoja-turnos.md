# La hoja `Turnos` manda sobre cada turno

Hasta ahora `Turnos` era un tablero derivado: `Centros` daba la capacidad de cada
jornada y el backend armaba el producto centro × fecha × jornada. Eso no permitía
que un punto tuviera cupos distintos según el día, ni que abriera de noche un
solo día.

Ahora el reparto es:

| Hoja      | Qué decide                                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------------------------- |
| `Centros` | El catálogo — dirección, localidad, actividades, `Activo`, observaciones — y la **capacidad nominal** de cada jornada. |
| `Turnos`  | La **autoridad efectiva** sobre un turno concreto: cuando una fila difiere de lo nominal, gana la fila.                |

Así se autoriza un sobrecupo para un día concreto (El Campín 300 el jueves y 150
el viernes) o se abre la noche un solo día.

## Columnas que lee el backend

| Columna           | Obligatoria | Nota                                                                                                        |
| ----------------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| `Punto de acopio` | sí          | El **mismo nombre** que en `Centros`. Es el vínculo entre las dos hojas.                                    |
| `Fecha`           | sí          | `DD/MM/AAAA` o una celda con formato de fecha.                                                              |
| `Jornada`         | sí          | `AM`, `PM` o `Noche`.                                                                                       |
| `Horario`         | no          | `8:00 a.m. - 2:00 p.m.`, `08:00-14:00`, `7 p.m. a 10 p.m.`. Vacío usa el horario por defecto de la jornada. |
| `Cupos totales`   | sí          | Vacío se lee como 0, que cierra el turno.                                                                   |
| `Validación`      | no          | La escribe el script: `OK` o por qué se rechazó la fila.                                                    |

`Reservados` la sigue escribiendo el backend tras cada reserva y **no** dispara
sincronización: si lo hiciera, cada inscripción reenviaría el tablero entero.

## Las dos hojas viajan siempre juntas

Edites lo que edites, se manda **el mismo payload con las dos hojas**: `Centros`
completa y el tablero `Turnos` completo. No hay una sincronización de centros y
otra de turnos.

Es por necesidad, no por comodidad. Ninguna de las dos hojas describe el programa
por su cuenta — `Centros` da lo nominal y `Turnos` la excepción — así que
reconstruir desde una sola pisa lo que dice la otra. Mandarlas juntas es lo que
hace que corregir una dirección no borre un sobrecupo autorizado.

```
Editas Centros ──┐
                 ├──► POST /api/hooks/sheets/centros  { filas, fechas, turnos }
Editas Turnos  ──┘         una sola reconstrucción
```

`POST /api/hooks/sheets/turnos` sigue existiendo para empujar solo el tablero
—toma los puntos de Firestore en vez de la hoja—, pero el Apps Script ya no lo
usa.

## `Cupos totales` carga las dos cosas

La celda puede tener una fórmula que busca lo nominal en `Centros`:

```
=IFERROR(INDEX(Centros!$E$2:$F$7;MATCH($B45;Centros!$A$2:$A$7;0);MATCH("Cupos "&$E45;Centros!$E$1:$F$1;0));0)
```

…o un número escrito encima —`400`— para ese turno concreto. **Apps Script manda
el valor calculado en los dos casos**, así que el backend no distingue: una sola
columna carga lo nominal y la excepción. Escribir encima reemplaza la fórmula de
esa celda; para volver atrás se copia de una fila vecina.

Un formato condicional sobre `=NOT(ISFORMULA($F45))` deja a la vista cuáles filas
están quemadas.

## Reglas que hay que tener claras

- **Cupos 0 cierra el turno**, lo diga `Centros` o lo diga `Turnos`.
- **Borrar una fila no borra el turno**: vuelve al cupo nominal que le da
  `Centros`. Un turno solo desaparece del público si su punto se desactiva.
- **Una fecha fuera del calendario crea el turno.** El calendario sale de la hoja
  `Listas`; una fila de `Turnos` con otra fecha abre ese día igual.
- **Un punto desactivado deja sus turnos cerrados**, diga lo que diga el tablero.
- **Bajar los cupos por debajo de lo ya reservado se aplica** y deja el turno
  visiblemente sobrevendido. Nunca se descartan voluntarios ya inscritos.
- **Una fila mala no tumba el lote**: vuelve con su motivo en `Validación` y las
  demás se aplican.

## El vínculo es el nombre del punto, y eso tiene un costo

`Turnos` referencia el punto por su nombre visible y el backend lo convierte en
id con `slugify` — la misma ruta que usa `Reservas`. **Renombrar un punto en la
hoja genera un id nuevo**, y con él un centro duplicado y turnos huérfanos. Ya
pasó en producción con `estadio-el-campin-3`.

La corrección de raíz es una columna `ID` explícita y estable en `Centros`,
referenciada desde `Turnos`, en vez de derivar la llave del nombre. Está
pendiente a propósito: exige tocar la hoja maestra.

Mientras tanto: **no se renombra un punto**. Si hay que corregir el nombre, hay
que arrastrar también sus turnos y sus reservas.

## Qué falta hacer fuera del código

1. **Quitar las fórmulas de `Turnos`** que hoy arman el tablero desde `Centros`.
   Mientras estén, la hoja se sobrescribe sola y no se puede editar una fila.
2. **Migrar los cupos actuales** a filas: 7 puntos × 4 días × 3 jornadas = 84
   filas.
3. **Pegar el `sync.gs` nuevo** en el Apps Script y crear **Nueva versión** en
   _Implementar → Administrar implementaciones_. El Web app sirve la versión
   desplegada, no el código guardado.

El menú pasa a tener un solo ítem, **«Sincronizar centros y turnos»**, en lugar
de los dos anteriores.
