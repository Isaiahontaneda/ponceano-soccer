// Red de seguridad del Core: los precios esperados con las tarifas reales del negocio.
import test from "node:test";
import assert from "node:assert/strict";
import { calcularPrecio } from "../backend/core/calcularPrecio.js";
import { TARIFAS, historiales } from "./datos.js";

const LUNES = "2026-11-09";
const SABADO = "2026-11-07";
const FERIADO = "2026-11-02"; // lunes

// Precio con las tarifas reales. "frecuente" = el cliente tiene 3 reservas confirmadas.
function precio(fecha, horaInicio, { frecuente = false, demanda = [] } = {}) {
  const reservasConfirmadas30Dias = frecuente ? 3 : 0;
  return calcularPrecio({ fecha, horaInicio, reservasConfirmadas30Dias, historiales: demanda }, TARIFAS).precio;
}

// ----- Sin ajuste histórico (historiales vacíos)

test("lunes 10:00: base dentro del rango de la mañana", () => {
  assert.equal(precio(LUNES, "10:00"), 40);
});

test("lunes 14:00: base dentro del rango de la tarde", () => {
  assert.equal(precio(LUNES, "14:00"), 40);
});

test("lunes 19:00: hora pico +25 %", () => {
  assert.equal(precio(LUNES, "19:00"), 50);
});

test("lunes 22:00: noche +12.5 %", () => {
  assert.equal(precio(LUNES, "22:00"), 45);
});

test("sábado 14:00: +10 % dentro del rango de la tarde", () => {
  assert.equal(precio(SABADO, "14:00"), 44);
});

test("sábado 10:00: 44 se limita al máximo de la mañana (40)", () => {
  assert.equal(precio(SABADO, "10:00"), 40);
});

test("sábado 19:00: 54 se limita al máximo de la noche (50)", () => {
  assert.equal(precio(SABADO, "19:00"), 50);
});

test("lunes feriado 19:00: 58 se limita al máximo de la noche (50)", () => {
  assert.equal(precio(FERIADO, "19:00"), 50);
});

test("sábado 19:00 con cliente frecuente: 50 (rango) × 0.90", () => {
  assert.equal(precio(SABADO, "19:00", { frecuente: true }), 45);
});

test("lunes 10:00 con cliente frecuente: 40 × 0.90", () => {
  assert.equal(precio(LUNES, "10:00", { frecuente: true }), 36);
});

// ----- Con ajuste histórico

test("sábado 19:00, demanda muy alta: 59.40 se limita al máximo alto (55)", () => {
  assert.equal(precio(SABADO, "19:00", { demanda: historiales(0.95, 0.9) }), 55);
});

test("lunes 19:00, demanda muy alta: 50 × 1.10", () => {
  assert.equal(precio(LUNES, "19:00", { demanda: historiales(0.9, 0.88) }), 55);
});

test("lunes 19:00, demanda alta: 52.50 se limita al máximo normal (50)", () => {
  assert.equal(precio(LUNES, "19:00", { demanda: historiales(0.75, 0.72) }), 50);
});

test("lunes 22:00, demanda alta: 45 × 1.05", () => {
  assert.equal(precio(LUNES, "22:00", { demanda: historiales(0.75, 0.72) }), 47.25);
});

test("lunes 09:00, demanda muy baja: 40 × 0.875", () => {
  assert.equal(precio(LUNES, "09:00", { demanda: historiales(0.06, 0.1) }), 35);
});

test("lunes 09:00, demanda baja: 40 × 0.95", () => {
  assert.equal(precio(LUNES, "09:00", { demanda: historiales(0.2, 0.24) }), 38);
});

test("lunes 14:00, demanda muy baja: 35 se limita al mínimo de la tarde (38)", () => {
  assert.equal(precio(LUNES, "14:00", { demanda: historiales(0.06, 0.1) }), 38);
});

test("lunes 22:00, demanda muy baja: 39.375 se limita al mínimo de la noche (45)", () => {
  assert.equal(precio(LUNES, "22:00", { demanda: historiales(0.06, 0.1) }), 45);
});

test("sábado 19:00, historiales que no coinciden: sin ajuste, máximo 50", () => {
  assert.equal(precio(SABADO, "19:00", { demanda: historiales(0.95, 0.2) }), 50);
});

test("sábado 19:00, historial actual sin datos: sin ajuste, máximo 50", () => {
  assert.equal(precio(SABADO, "19:00", { demanda: historiales(0.95, null) }), 50);
});

test("sábado 19:00, demanda muy alta y cliente frecuente: 55 × 0.90", () => {
  assert.equal(precio(SABADO, "19:00", { demanda: historiales(0.95, 0.9), frecuente: true }), 49.5);
});

test("lunes 09:00, demanda muy baja y cliente frecuente: 35 × 0.90 (bajo el mínimo, a propósito)", () => {
  assert.equal(precio(LUNES, "09:00", { demanda: historiales(0.06, 0.1), frecuente: true }), 31.5);
});

// ----- Salida

test("la salida explica el cálculo por etapas", () => {
  const r = calcularPrecio(
    { fecha: SABADO, horaInicio: "19:00", reservasConfirmadas30Dias: 3, historiales: historiales(0.95, 0.9) },
    TARIFAS
  );
  assert.equal(r.subtotal, 54);
  assert.equal(r.historial.ajuste, 0.1);
  assert.equal(r.historial.demandaMuyAlta, true);
  assert.deepEqual(
    r.historial.comparaciones.map((c) => c.nivel),
    ["ALTA", "ALTA"]
  );
  assert.equal(r.rango.franja, "NOCHE");
  assert.equal(r.rango.maximo, 55);
  assert.equal(r.rango.aplicado, true);
  assert.equal(r.rango.motivo, "Limitado al máximo por demanda muy alta: $55.00");
  assert.equal(r.precioAntesDeDescuento, 55);
  assert.deepEqual(
    r.desglose.map((linea) => linea.etapa),
    [1, 1, 1, 1, 2, 3, 4]
  );
});
