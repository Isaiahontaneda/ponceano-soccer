// Red de seguridad del Core: los precios esperados con las tarifas y reglas reales del negocio.
import test from "node:test";
import assert from "node:assert/strict";
import { calcularPrecio } from "../backend/core/calcularPrecio.js";
import { REGLAS_CLIENTE, TARIFAS, cliente, historiales } from "./datos.js";

const LUNES = "2026-11-09";
const SABADO = "2026-11-07";
const FERIADO = "2026-11-02"; // lunes

// Fechas de la tabla de precios esperados (sección 3.2).
const LUNES_30 = "2026-11-30";
const SABADO_5 = "2026-12-05";

// Precio con las tarifas y reglas reales. Sin "datosCliente" se calcula "Sin cliente".
function calcular(fecha, horaInicio, { datosCliente = null, demanda = [], reglas = REGLAS_CLIENTE } = {}) {
  return calcularPrecio({ fecha, horaInicio, historiales: demanda, cliente: datosCliente }, TARIFAS, reglas);
}
const precio = (...args) => calcular(...args).precio;

// ----- Sin ajuste histórico ni cliente

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

// ----- Con ajuste histórico, sin cliente

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

// ----- Tabla de precios esperados con beneficios del cliente (sección 3.2)

test("3.2 lunes 10:00, sin cliente: $40.00", () => {
  assert.equal(precio(LUNES_30, "10:00"), 40);
});

test("3.2 lunes 10:00, primera reserva: 40 × 0.90 (bienvenida)", () => {
  assert.equal(precio(LUNES_30, "10:00", { datosCliente: cliente({ reservasPrevias: 0 }) }), 36);
});

test("3.2 lunes 10:00, 3 confirmadas desde el último sello: 40 × 0.85", () => {
  assert.equal(precio(LUNES_30, "10:00", { datosCliente: cliente({ sellos: 3 }) }), 34);
});

test("3.2 lunes 10:00, 2 confirmadas desde el último sello: sin beneficio", () => {
  assert.equal(precio(LUNES_30, "10:00", { datosCliente: cliente({ sellos: 2 }) }), 40);
});

test("3.2 lunes 10:00, 3 sellos y 9 días: gana el mayor (40 × 0.85)", () => {
  const r = calcular(LUNES_30, "10:00", { datosCliente: cliente({ sellos: 3, dias: 9 }) });
  assert.equal(r.precio, 34);
  assert.deepEqual(
    r.beneficios.evaluadas.filter((e) => e.aplica).map((e) => e.nombre),
    ["Tarjeta de sellos", "Reserva anticipada"]
  );
  assert.equal(r.beneficios.aplicada.nombre, "Tarjeta de sellos");
});

test("3.2 sábado 19:00, 7 días exactos: 54 → 50 (rango) × 0.95", () => {
  assert.equal(precio(SABADO_5, "19:00", { datosCliente: cliente({ dias: 7 }) }), 47.5);
});

test("3.2 sábado 19:00, 6 días: sin beneficio", () => {
  assert.equal(precio(SABADO_5, "19:00", { datosCliente: cliente({ dias: 6 }) }), 50);
});

test("3.2 sábado 19:00, demanda muy alta y 3 sellos: 55 (rango) × 0.85", () => {
  assert.equal(
    precio(SABADO_5, "19:00", { datosCliente: cliente({ sellos: 3 }), demanda: historiales(0.95, 0.9) }),
    46.75
  );
});

test("3.2 lunes 09:00, demanda muy baja: 35 × 0.90 (valle)", () => {
  assert.equal(precio(LUNES_30, "09:00", { datosCliente: cliente(), demanda: historiales(0.06, 0.1) }), 31.5);
});

test("3.2 lunes 14:00, demanda baja: 38 × 0.90 (valle)", () => {
  assert.equal(precio(LUNES_30, "14:00", { datosCliente: cliente(), demanda: historiales(0.2, 0.24) }), 34.2);
});

test("3.2 lunes 09:00, historiales en desacuerdo: no hay valle", () => {
  assert.equal(precio(LUNES_30, "09:00", { datosCliente: cliente(), demanda: historiales(0.95, 0.1) }), 40);
});

test("3.2 lunes 10:00, primera reserva con la bienvenida inactiva: sin beneficio", () => {
  const reglas = REGLAS_CLIENTE.map((r) => (r.tipoCodigo === "BIENVENIDA" ? { ...r, activa: false } : r));
  assert.equal(precio(LUNES_30, "10:00", { datosCliente: cliente({ reservasPrevias: 0 }), reglas }), 40);
});

test("3.2 lunes 10:00, primera reserva con la bienvenida vencida el 2026-11-29: sin beneficio", () => {
  const reglas = REGLAS_CLIENTE.map((r) => (r.tipoCodigo === "BIENVENIDA" ? { ...r, vigenteHasta: "2026-11-29" } : r));
  assert.equal(precio(LUNES_30, "10:00", { datosCliente: cliente({ reservasPrevias: 0 }), reglas }), 40);
});

test("3.2 lunes 10:00, sin cliente aunque falten 30 días: sin beneficios", () => {
  // Sin cliente no hay datos de anticipación que evaluar: el Core no mira ninguna regla.
  const r = calcular(LUNES_30, "10:00");
  assert.equal(r.precio, 40);
  assert.deepEqual(r.beneficios, { evaluadas: [], aplicada: null });
});

// ----- Salida

test("la salida explica el cálculo por etapas", () => {
  const r = calcular(SABADO, "19:00", { datosCliente: cliente({ sellos: 3 }), demanda: historiales(0.95, 0.9) });
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
  assert.equal(r.descuento, 0.15);
  assert.deepEqual(r.beneficios.aplicada, { id: 1, nombre: "Tarjeta de sellos", descuento: 0.15 });
  assert.deepEqual(
    r.desglose.map((linea) => linea.etapa),
    [1, 1, 1, 1, 2, 3, 4]
  );
  assert.deepEqual(r.desglose.at(-1), { etapa: 4, concepto: "Tarjeta de sellos", tipo: "BENEFICIO", porcentaje: -15 });
});

test("una tarifa CLIENTE_FRECUENTE que quede en la base se ignora", () => {
  const conViejas = [...TARIFAS, { tipoCodigo: "CLIENTE_FRECUENTE", nombre: "Cliente frecuente", valor: 0.1, minReservas: 3 }];
  const r = calcularPrecio({ fecha: LUNES, horaInicio: "10:00", cliente: cliente({ sellos: 9 }) }, conViejas, []);
  assert.equal(r.precio, 40);
});
