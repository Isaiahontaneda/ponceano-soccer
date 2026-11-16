import test from "node:test";
import assert from "node:assert/strict";
import { validarCancelacionCliente } from "../backend/validaciones/reserva.js";

const YO = "11111111-1111-4111-8111-111111111111";
const OTRO = "22222222-2222-4222-8222-222222222222";
const AHORA = { fecha: "2026-11-09", hora: "15:30" };

// Reserva pendiente, propia y futura; cada prueba cambia solo lo que le interesa.
const reserva = (cambios = {}) => ({
  clienteId: YO,
  fecha: "2026-11-10",
  horaInicio: "19:00:00",
  estado: "PENDIENTE",
  ...cambios,
});

test("reserva de otro cliente: 404 (no se revela que existe)", () => {
  const resultado = validarCancelacionCliente(reserva({ clienteId: OTRO }), YO, AHORA);
  assert.equal(resultado.estadoHttp, 404);
  assert.equal(resultado.error, "La reserva no existe");
});

test("reserva inexistente: 404", () => {
  assert.equal(validarCancelacionCliente(null, YO, AHORA).estadoHttp, 404);
});

test("reserva confirmada: 409", () => {
  const resultado = validarCancelacionCliente(reserva({ estado: "CONFIRMADA" }), YO, AHORA);
  assert.equal(resultado.estadoHttp, 409);
});

test("reserva de una fecha pasada: 409", () => {
  const resultado = validarCancelacionCliente(reserva({ fecha: "2026-11-08" }), YO, AHORA);
  assert.equal(resultado.estadoHttp, 409);
  assert.equal(resultado.error, "Esa reserva ya pasó.");
});

test("reserva de hoy que ya empezó: 409", () => {
  const deHoy = reserva({ fecha: "2026-11-09", horaInicio: "15:00:00" });
  assert.equal(validarCancelacionCliente(deHoy, YO, AHORA).estadoHttp, 409);
});

test("reserva de hoy que todavía no empieza: sin error", () => {
  const deHoy = reserva({ fecha: "2026-11-09", horaInicio: "16:00:00" });
  assert.deepEqual(validarCancelacionCliente(deHoy, YO, AHORA), { error: null });
});

test("pendiente propia y futura: sin error", () => {
  assert.deepEqual(validarCancelacionCliente(reserva(), YO, AHORA), { error: null });
});
