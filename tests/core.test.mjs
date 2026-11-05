import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularPrecio, ErrorSinTarifaBase } from "../lib/core/calcularPrecio.js";

// Datos reales cargados en el negocio.
const TARIFAS = [
  { tipoCodigo: "BASE", nombre: "Tarifa base", valor: 40 },
  { tipoCodigo: "FRANJA_HORARIA", nombre: "Día", valor: 0, horaInicio: "08:00:00", horaFin: "17:59:00" },
  { tipoCodigo: "FRANJA_HORARIA", nombre: "Hora pico", valor: 0.25, horaInicio: "18:00:00", horaFin: "21:59:00" },
  { tipoCodigo: "FRANJA_HORARIA", nombre: "Noche", valor: 0.125, horaInicio: "22:00:00", horaFin: "23:59:00" },
  { tipoCodigo: "DIA_SEMANA", nombre: "Sábado", valor: 0.1, diaSemana: 6 },
  { tipoCodigo: "FECHA_ESPECIAL", nombre: "Feriado", valor: 0.2, fecha: "2026-11-02" },
  { tipoCodigo: "CLIENTE_FRECUENTE", nombre: "Cliente frecuente", valor: 0.1, minReservas: 3 },
];

const calcular = (fecha, horaInicio, reservas = 0, tarifas = TARIFAS) =>
  calcularPrecio({ fecha, horaInicio, reservasConfirmadas30Dias: reservas }, tarifas);

test("lunes 2026-11-09 10:00, sin historial -> 40.00", () => {
  const r = calcular("2026-11-09", "10:00");
  assert.equal(r.precio, 40);
  assert.equal(r.recargos, 0);
  assert.equal(r.descuento, 0);
});

test("lunes 2026-11-09 19:00 (hora pico) -> 50.00", () => {
  const r = calcular("2026-11-09", "19:00");
  assert.equal(r.precio, 50);
  assert.equal(r.comparaciones.franja.aplicada, true);
  assert.equal(r.comparaciones.franja.regla.nombre, "Hora pico");
});

test("lunes 2026-11-09 22:00 (noche) -> 45.00", () => {
  assert.equal(calcular("2026-11-09", "22:00").precio, 45);
});

test("sábado 2026-11-07 19:00 -> 40 × (1 + 0.25 + 0.10) = 54.00", () => {
  const r = calcular("2026-11-07", "19:00");
  assert.equal(r.precio, 54);
  assert.equal(r.recargos, 0.35);
  assert.equal(r.subtotal, 54);
  assert.equal(r.comparaciones.calendario.aplicada, true);
  assert.equal(r.comparaciones.calendario.reglas[0].nombre, "Sábado");
});

test("lunes feriado 2026-11-02 10:00 -> 40 × 1.20 = 48.00", () => {
  const r = calcular("2026-11-02", "10:00");
  assert.equal(r.precio, 48);
  assert.equal(r.comparaciones.calendario.reglas[0].nombre, "Feriado");
});

test("sábado 2026-11-07 19:00 con cliente de 3 o más reservas -> 54 × 0.90 = 48.60", () => {
  const r = calcular("2026-11-07", "19:00", 3);
  assert.equal(r.precio, 48.6);
  assert.equal(r.descuento, 0.1);
  assert.equal(r.subtotal, 54);
  assert.equal(r.comparaciones.clienteFrecuente.aplicada, true);
});

test("cliente con 2 reservas (por debajo del mínimo) no recibe descuento", () => {
  const r = calcular("2026-11-07", "19:00", 2);
  assert.equal(r.precio, 54);
  assert.equal(r.comparaciones.clienteFrecuente.aplicada, false);
  assert.equal(r.comparaciones.clienteFrecuente.regla, null);
});

test("hora fuera de toda franja (03:00): sin recargo de franja, solo calendario y descuento", () => {
  const r = calcular("2026-11-07", "03:00", 3);
  assert.equal(r.comparaciones.franja.aplicada, false);
  assert.equal(r.comparaciones.franja.regla, null);
  // 40 × 1.10 (solo sábado) × 0.90 = 39.60
  assert.equal(r.recargos, 0.1);
  assert.equal(r.precio, 39.6);
});

test("sin tarifa base lanza un error claro", () => {
  const sinBase = TARIFAS.filter((t) => t.tipoCodigo !== "BASE");
  assert.throws(() => calcular("2026-11-09", "10:00", 0, sinBase), ErrorSinTarifaBase);
  assert.throws(() => calcular("2026-11-09", "10:00", 0, []), /tarifa base/);
});

test("dos descuentos cumplidos: se aplica solo el mayor", () => {
  const tarifas = [
    ...TARIFAS,
    { tipoCodigo: "CLIENTE_FRECUENTE", nombre: "Cliente VIP", valor: 0.2, minReservas: 6 },
  ];
  // Con 3 reservas solo cumple la de 10 %.
  assert.equal(calcular("2026-11-09", "10:00", 3, tarifas).precio, 36);
  // Con 6 reservas cumple las dos: gana la de 20 %, no se suman.
  const r = calcular("2026-11-09", "10:00", 6, tarifas);
  assert.equal(r.precio, 32);
  assert.equal(r.descuento, 0.2);
  assert.equal(r.comparaciones.clienteFrecuente.regla.nombre, "Cliente VIP");
});

test("el mayor descuento gana aunque aparezca primero en la lista", () => {
  const tarifas = [
    { tipoCodigo: "CLIENTE_FRECUENTE", nombre: "VIP", valor: 0.2, minReservas: 1 },
    ...TARIFAS,
  ];
  assert.equal(calcular("2026-11-09", "10:00", 5, tarifas).precio, 32);
});

test("sábado que además es feriado acumula ambos recargos de calendario", () => {
  const tarifas = [
    ...TARIFAS,
    { tipoCodigo: "FECHA_ESPECIAL", nombre: "Fiesta local", valor: 0.2, fecha: "2026-11-07" },
  ];
  const r = calcular("2026-11-07", "10:00", 0, tarifas);
  // 40 × (1 + 0 + 0.10 + 0.20) = 52
  assert.equal(r.precio, 52);
  assert.equal(r.comparaciones.calendario.reglas.length, 2);
});

test("la hora acepta HH:MM:SS y compara solo HH:MM", () => {
  assert.equal(calcular("2026-11-09", "19:00:00").precio, 50);
  // 21:59 es el último minuto de la hora pico (extremo incluido); 22:00 ya es noche.
  assert.equal(calcular("2026-11-09", "21:59").precio, 50);
  assert.equal(calcular("2026-11-09", "17:59").precio, 40);
  assert.equal(calcular("2026-11-09", "18:00").precio, 50);
});

test("el día de la semana no depende de la zona horaria de la máquina", () => {
  // 2026-11-07 es sábado y 2026-11-08 es domingo en cualquier zona.
  assert.equal(calcular("2026-11-07", "10:00").precio, 44);
  assert.equal(calcular("2026-11-08", "10:00").precio, 40);
  assert.equal(calcular("2026-11-01", "10:00").comparaciones.calendario.aplicada, false);
});

test("redondeo a 2 decimales con la mitad hacia arriba, una sola vez al final", () => {
  const tarifas = [
    { tipoCodigo: "BASE", nombre: "Base", valor: 33.33 },
    { tipoCodigo: "FRANJA_HORARIA", nombre: "Todo el día", valor: 0.125, horaInicio: "00:00", horaFin: "23:59" },
    { tipoCodigo: "CLIENTE_FRECUENTE", nombre: "Frecuente", valor: 0.1, minReservas: 1 },
  ];
  // 33.33 × 1.125 = 37.49625 (subtotal 37.50); × 0.90 = 33.746625 -> 33.75
  const r = calcular("2026-11-09", "10:00", 1, tarifas);
  assert.equal(r.subtotal, 37.5);
  assert.equal(r.precio, 33.75);

  // Caso clásico de coma flotante: 1.005 debe redondear a 1.01 (mitad hacia arriba).
  const limite = [
    { tipoCodigo: "BASE", nombre: "Base", valor: 1 },
    { tipoCodigo: "FRANJA_HORARIA", nombre: "Todo", valor: 0.005, horaInicio: "00:00", horaFin: "23:59" },
  ];
  assert.equal(calcular("2026-11-09", "10:00", 0, limite).precio, 1.01);
});

test("el precio nunca tiene más de 2 decimales", () => {
  for (const hora of ["08:00", "12:00", "18:00", "22:00", "23:00"]) {
    for (const fecha of ["2026-11-02", "2026-11-07", "2026-11-09"]) {
      for (const reservas of [0, 3]) {
        const { precio } = calcular(fecha, hora, reservas);
        assert.equal(Math.round(precio * 100) / 100, precio);
      }
    }
  }
});

test("devuelve el desglose paso a paso", () => {
  const r = calcular("2026-11-07", "19:00", 3);
  assert.deepEqual(
    r.desglose.map((d) => [d.tipo, d.concepto]),
    [
      ["BASE", "Tarifa base por hora"],
      ["FRANJA_HORARIA", "Hora pico"],
      ["DIA_SEMANA", "Sábado"],
      ["CLIENTE_FRECUENTE", "Cliente frecuente"],
    ]
  );
  assert.equal(r.desglose[0].monto, 40);
  assert.equal(r.desglose[1].porcentaje, 25);
  assert.equal(r.desglose[2].porcentaje, 10);
  assert.equal(r.desglose[3].porcentaje, -10);
});

test("12.5 % de recargo se calcula bien (0.125)", () => {
  const r = calcular("2026-11-09", "23:00");
  assert.equal(r.precio, 45);
  assert.equal(r.desglose[1].porcentaje, 12.5);
});

test("entradas inválidas lanzan error", () => {
  assert.throws(() => calcular("2026-02-31", "10:00"), /Fecha inválida/);
  assert.throws(() => calcular("09/11/2026", "10:00"), /Fecha inválida/);
  assert.throws(() => calcular("2026-11-09", "25:00"), /Hora inválida/);
  assert.throws(() => calcular("2026-11-09", undefined), /Hora inválida/);
  assert.throws(() => calcular("2026-11-09", "10:00", -1), /reservas/);
});

test("un tipo de tarifa desconocido se ignora sin romper el cálculo", () => {
  const tarifas = [...TARIFAS, { tipoCodigo: "OTRO", nombre: "Raro", valor: 0.9 }];
  assert.equal(calcular("2026-11-09", "10:00", 0, tarifas).precio, 40);
});
