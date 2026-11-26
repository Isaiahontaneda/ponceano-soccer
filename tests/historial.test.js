import test from "node:test";
import assert from "node:assert/strict";
import { calcularPrecio, clasificarDemanda, decidirAjusteDemanda } from "../backend/core/calcularPrecio.js";
import { REGLAS_CLIENTE, TARIFAS, cliente, historiales } from "./datos.js";

const LUNES = "2026-11-09";
const SABADO = "2026-11-07";

// ----- Comparaciones 4 y 5: nivel de demanda

test("clasificarDemanda en los bordes exactos", () => {
  assert.equal(clasificarDemanda(0.7), "ALTA");
  assert.equal(clasificarDemanda(0.6999), "NORMAL");
  assert.equal(clasificarDemanda(0.25), "BAJA");
  assert.equal(clasificarDemanda(0.2501), "NORMAL");
  assert.equal(clasificarDemanda(null), "SIN_DATOS");
});

// ----- Regla de decisión

test("ALTA y ALTA con promedio >= 0.85: +10 % y demanda muy alta", () => {
  assert.deepEqual(decidirAjusteDemanda(["ALTA", "ALTA"], [0.95, 0.9]), {
    ajuste: 0.1,
    demandaMuyAlta: true,
    motivo: "Ambos historiales muestran demanda muy alta",
  });
});

test("ALTA y ALTA con promedio exacto 0.85: +10 %", () => {
  assert.equal(decidirAjusteDemanda(["ALTA", "ALTA"], [0.8, 0.9]).ajuste, 0.1);
});

test("ALTA y ALTA con promedio < 0.85: +5 %, sin demanda muy alta", () => {
  assert.deepEqual(decidirAjusteDemanda(["ALTA", "ALTA"], [0.84, 0.85]), {
    ajuste: 0.05,
    demandaMuyAlta: false,
    motivo: "Ambos historiales muestran demanda alta",
  });
});

test("BAJA y BAJA con promedio <= 0.15: −12.5 %", () => {
  assert.deepEqual(decidirAjusteDemanda(["BAJA", "BAJA"], [0.06, 0.1]), {
    ajuste: -0.125,
    demandaMuyAlta: false,
    motivo: "Ambos historiales muestran demanda muy baja",
  });
});

test("BAJA y BAJA con promedio exacto 0.15 (0.10 y 0.20): −12.5 %", () => {
  assert.equal(decidirAjusteDemanda(["BAJA", "BAJA"], [0.1, 0.2]).ajuste, -0.125);
});

test("BAJA y BAJA con promedio > 0.15: −5 %", () => {
  assert.deepEqual(decidirAjusteDemanda(["BAJA", "BAJA"], [0.15, 0.16]), {
    ajuste: -0.05,
    demandaMuyAlta: false,
    motivo: "Ambos historiales muestran demanda baja",
  });
});

test("algún historial sin datos: 0 %", () => {
  const esperado = { ajuste: 0, demandaMuyAlta: false, motivo: "Historial insuficiente: no se ajusta" };
  assert.deepEqual(decidirAjusteDemanda(["ALTA", "SIN_DATOS"], [0.95, null]), esperado);
  assert.deepEqual(decidirAjusteDemanda(["SIN_DATOS", "BAJA"], [null, 0.1]), esperado);
  assert.deepEqual(decidirAjusteDemanda([], []), esperado);
});

test("historiales que no coinciden: 0 %", () => {
  const esperado = { ajuste: 0, demandaMuyAlta: false, motivo: "Los historiales no coinciden: no se ajusta" };
  assert.deepEqual(decidirAjusteDemanda(["ALTA", "BAJA"], [0.95, 0.2]), esperado);
  assert.deepEqual(decidirAjusteDemanda(["ALTA", "NORMAL"], [0.95, 0.5]), esperado);
  assert.deepEqual(decidirAjusteDemanda(["NORMAL", "NORMAL"], [0.5, 0.5]), esperado);
  assert.deepEqual(decidirAjusteDemanda(["BAJA", "NORMAL"], [0.1, 0.5]), esperado);
});

// ----- Etapa 3: rango publicado
// Con solo una tarifa base, el precio antes del rango es exactamente la base.

function precioConBase(base, horaInicio, demanda = []) {
  const tarifas = [{ tipoCodigo: "BASE", nombre: "Base", valor: base }];
  return calcularPrecio({ fecha: LUNES, horaInicio, historiales: demanda }, tarifas).precio;
}

test("rango de la mañana: debajo, dentro y encima", () => {
  assert.equal(precioConBase(30, "10:00"), 35);
  assert.equal(precioConBase(37, "10:00"), 37);
  assert.equal(precioConBase(50, "10:00"), 40);
});

test("rango de la tarde: debajo, dentro y encima", () => {
  assert.equal(precioConBase(30, "14:00"), 38);
  assert.equal(precioConBase(42, "14:00"), 42);
  assert.equal(precioConBase(50, "14:00"), 45);
});

test("rango de la noche: debajo, dentro y encima", () => {
  assert.equal(precioConBase(40, "19:00"), 45);
  assert.equal(precioConBase(47, "19:00"), 47);
  assert.equal(precioConBase(60, "19:00"), 50);
});

test("bordes 11:59 (mañana) y 12:00 (tarde)", () => {
  assert.equal(precioConBase(44, "11:59"), 40);
  assert.equal(precioConBase(44, "12:00"), 44);
});

test("bordes 17:59 (tarde) y 18:00 (noche)", () => {
  assert.equal(precioConBase(48, "17:59"), 45);
  assert.equal(precioConBase(48, "18:00"), 48);
});

test("máximo de la noche: 50 normal y 55 solo con demanda muy alta", () => {
  assert.equal(precioConBase(60, "19:00"), 50);
  assert.equal(precioConBase(60, "19:00", historiales(0.95, 0.9)), 55); // 66 → 55
  assert.equal(precioConBase(50, "19:00", historiales(0.95, 0.9)), 55); // 55 exacto
});

test("con demanda alta (+5 %, no muy alta) el máximo de la noche sigue en 50", () => {
  assert.equal(precioConBase(50, "19:00", historiales(0.75, 0.72)), 50); // 52.50 → 50
});

// ----- Orden de las etapas

test("el beneficio del cliente se aplica DESPUÉS del rango", () => {
  const resultado = calcularPrecio(
    { fecha: SABADO, horaInicio: "19:00", historiales: historiales(0.95, 0.9), cliente: cliente({ sellos: 3 }) },
    TARIFAS,
    REGLAS_CLIENTE
  );
  // 54 × 1.10 = 59.40 → 55 (rango) → × 0.85 = 46.75.
  // No 50.49, que saldría con el descuento antes del rango (59.40 × 0.85) o sin rango.
  assert.equal(resultado.precio, 46.75);
});
