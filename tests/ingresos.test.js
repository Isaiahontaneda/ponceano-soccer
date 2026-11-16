import test from "node:test";
import assert from "node:assert/strict";
import { agruparIngresos, validarRangoIngresos } from "../backend/validaciones/ingresos.js";

const RESERVAS = [
  { fecha: "2026-11-07", estado: "CONFIRMADA", precio: 48.6 },
  { fecha: "2026-11-07", estado: "CONFIRMADA", precio: 54 },
  { fecha: "2026-11-09", estado: "PENDIENTE", precio: 40 },
  { fecha: "2026-12-01", estado: "CONFIRMADA", precio: 50 },
];

test("agrupa por día, con las filas ordenadas", () => {
  const { filas } = agruparIngresos([...RESERVAS].reverse(), "dia");
  assert.deepEqual(filas, [
    {
      periodo: "2026-11-07",
      confirmadas: { cantidad: 2, monto: 102.6 },
      pendientes: { cantidad: 0, monto: 0 },
    },
    {
      periodo: "2026-11-09",
      confirmadas: { cantidad: 0, monto: 0 },
      pendientes: { cantidad: 1, monto: 40 },
    },
    {
      periodo: "2026-12-01",
      confirmadas: { cantidad: 1, monto: 50 },
      pendientes: { cantidad: 0, monto: 0 },
    },
  ]);
});

test("agrupa por mes y calcula los totales", () => {
  const { filas, totales } = agruparIngresos(RESERVAS, "mes");
  assert.deepEqual(
    filas.map((f) => f.periodo),
    ["2026-11", "2026-12"]
  );
  assert.deepEqual(filas[0].confirmadas, { cantidad: 2, monto: 102.6 });
  assert.deepEqual(filas[0].pendientes, { cantidad: 1, monto: 40 });
  assert.deepEqual(totales, {
    confirmadas: { cantidad: 3, monto: 152.6 },
    pendientes: { cantidad: 1, monto: 40 },
  });
});

test("las canceladas y los estados desconocidos no cuentan", () => {
  const { filas, totales } = agruparIngresos(
    [
      { fecha: "2026-11-07", estado: "CANCELADA", precio: 54 },
      { fecha: "2026-11-07", estado: "OTRO", precio: 54 },
    ],
    "dia"
  );
  assert.deepEqual(filas, []);
  assert.equal(totales.confirmadas.monto, 0);
  assert.equal(totales.pendientes.monto, 0);
});

test("0.10 + 0.20 da 0.30 exacto", () => {
  const { totales } = agruparIngresos(
    [
      { fecha: "2026-11-07", estado: "CONFIRMADA", precio: 0.1 },
      { fecha: "2026-11-07", estado: "CONFIRMADA", precio: 0.2 },
    ],
    "dia"
  );
  assert.equal(totales.confirmadas.monto, 0.3);
});

test("48.60 + 54.00 da 102.60 (también si el precio llega como texto)", () => {
  const { totales } = agruparIngresos(
    [
      { fecha: "2026-11-07", estado: "PENDIENTE", precio: "48.60" },
      { fecha: "2026-11-07", estado: "PENDIENTE", precio: "54.00" },
    ],
    "dia"
  );
  assert.equal(totales.pendientes.monto, 102.6);
});

test("lista vacía: sin filas y totales en cero", () => {
  assert.deepEqual(agruparIngresos([], "dia"), {
    filas: [],
    totales: {
      confirmadas: { cantidad: 0, monto: 0 },
      pendientes: { cantidad: 0, monto: 0 },
    },
  });
});

test("rechaza un rango con «desde» posterior a «hasta»", () => {
  const { errores } = validarRangoIngresos({ desde: "2026-11-10", hasta: "2026-11-09" });
  assert.equal(errores.length, 1);
});

test("acepta 366 días y rechaza 367", () => {
  const de366 = validarRangoIngresos({ desde: "2026-01-01", hasta: "2027-01-01" });
  const de367 = validarRangoIngresos({ desde: "2026-01-01", hasta: "2027-01-02" });
  assert.deepEqual(de366.errores, []);
  assert.equal(de367.errores.length, 1);
});

test("rechaza una fecha que no existe (2026-02-30)", () => {
  const { errores } = validarRangoIngresos({ desde: "2026-02-30", hasta: "2026-03-01" });
  assert.equal(errores.length, 1);
});

test("rechaza un valor de agrupar inválido", () => {
  const { errores } = validarRangoIngresos({
    desde: "2026-11-01",
    hasta: "2026-11-30",
    agrupar: "semana",
  });
  assert.equal(errores.length, 1);
});

test("agrupar es «dia» por defecto", () => {
  const { errores, datos } = validarRangoIngresos({ desde: "2026-11-01", hasta: "2026-11-30" });
  assert.deepEqual(errores, []);
  assert.deepEqual(datos, { desde: "2026-11-01", hasta: "2026-11-30", agrupar: "dia" });
});
