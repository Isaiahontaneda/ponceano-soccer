// Red de seguridad del Core: los precios de ejemplo con las tarifas reales del negocio.
import test from "node:test";
import assert from "node:assert/strict";
import { calcularPrecio } from "../backend/core/calcularPrecio.js";

const TARIFAS = [
  { tipoCodigo: "BASE", nombre: "Base", valor: 40 },
  { tipoCodigo: "FRANJA_HORARIA", nombre: "Día", valor: 0, horaInicio: "08:00", horaFin: "17:59" },
  { tipoCodigo: "FRANJA_HORARIA", nombre: "Hora pico", valor: 0.25, horaInicio: "18:00", horaFin: "21:59" },
  { tipoCodigo: "FRANJA_HORARIA", nombre: "Noche", valor: 0.125, horaInicio: "22:00", horaFin: "23:59" },
  { tipoCodigo: "DIA_SEMANA", nombre: "Sábado", valor: 0.1, diaSemana: 6 },
  { tipoCodigo: "FECHA_ESPECIAL", nombre: "Feriado", valor: 0.2, fecha: "2026-11-02" },
  { tipoCodigo: "CLIENTE_FRECUENTE", nombre: "Cliente frecuente", valor: 0.1, minReservas: 3 },
];

const precio = (fecha, horaInicio, reservasConfirmadas30Dias = 0) =>
  calcularPrecio({ fecha, horaInicio, reservasConfirmadas30Dias }, TARIFAS).precio;

test("lunes de día: solo la tarifa base", () => {
  assert.equal(precio("2026-11-09", "10:00"), 40);
});

test("lunes en hora pico: +25 %", () => {
  assert.equal(precio("2026-11-09", "19:00"), 50);
});

test("lunes de noche: +12.5 %", () => {
  assert.equal(precio("2026-11-09", "22:00"), 45);
});

test("sábado en hora pico: los recargos se suman (+35 %)", () => {
  assert.equal(precio("2026-11-07", "19:00"), 54);
});

test("lunes feriado de día: +20 %", () => {
  assert.equal(precio("2026-11-02", "10:00"), 48);
});

test("sábado en hora pico, cliente con 3 reservas: −10 % sobre el subtotal", () => {
  assert.equal(precio("2026-11-07", "19:00", 3), 48.6);
});
