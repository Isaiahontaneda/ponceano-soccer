import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ESTADOS,
  TRANSICIONES,
  transicionPermitida,
  validarCambioEstado,
  validarNuevaReserva,
  calcularDisponibilidad,
  construirCodigo,
  ALFABETO_CODIGO,
} from "../lib/validaciones/reserva.js";
import { bloquesHorarios, esBloqueValido } from "../lib/configuracion.js";
import { diaSemanaDe, fechaValida, hoyEnNegocio, horaValida, sumarDias } from "../lib/fechas.js";

const CLIENTE = "5b1c7e2a-1f3d-4c8e-9a7b-0d2e4f6a8b1c";
// "Ahora" simulado: 2026-11-05, 14:30 en Guayaquil.
const AHORA = { fecha: "2026-11-05", hora: "14:30" };

const nueva = (cambios = {}) => ({
  clienteId: CLIENTE,
  fecha: "2026-11-10",
  horaInicio: "19:00",
  ...cambios,
});

// ---------- Máquina de estados

test("transiciones válidas: PENDIENTE -> CONFIRMADA | CANCELADA y CONFIRMADA -> CANCELADA", () => {
  assert.equal(transicionPermitida("PENDIENTE", "CONFIRMADA"), true);
  assert.equal(transicionPermitida("PENDIENTE", "CANCELADA"), true);
  assert.equal(transicionPermitida("CONFIRMADA", "CANCELADA"), true);
});

test("transiciones inválidas: cualquier otra, incluida salir de CANCELADA", () => {
  assert.equal(transicionPermitida("CONFIRMADA", "PENDIENTE"), false);
  assert.equal(transicionPermitida("CANCELADA", "PENDIENTE"), false);
  assert.equal(transicionPermitida("CANCELADA", "CONFIRMADA"), false);
  assert.equal(transicionPermitida("CANCELADA", "CANCELADA"), false);
  assert.equal(transicionPermitida("PENDIENTE", "PENDIENTE"), false);
  assert.equal(transicionPermitida("CONFIRMADA", "CONFIRMADA"), false);
  assert.equal(transicionPermitida("OTRO", "CONFIRMADA"), false);
  assert.equal(transicionPermitida(undefined, undefined), false);
});

test("la tabla de transiciones cubre todos los estados y CANCELADA es final", () => {
  assert.deepEqual(Object.keys(TRANSICIONES).sort(), [...ESTADOS].sort());
  assert.deepEqual(TRANSICIONES.CANCELADA, []);
});

test("validarCambioEstado: estado inexistente -> 422; transición no permitida -> 409", () => {
  assert.equal(validarCambioEstado({ estado: "BORRADA" }, "PENDIENTE").estadoHttp, 422);
  assert.equal(validarCambioEstado({}, "PENDIENTE").estadoHttp, 422);
  assert.equal(validarCambioEstado(null, "PENDIENTE").estadoHttp, 422);
  assert.equal(validarCambioEstado({ estado: 5 }, "PENDIENTE").estadoHttp, 422);

  const cancelada = validarCambioEstado({ estado: "CONFIRMADA" }, "CANCELADA");
  assert.equal(cancelada.estadoHttp, 409);
  assert.match(cancelada.error, /cancelada no se puede modificar/);

  assert.equal(validarCambioEstado({ estado: "PENDIENTE" }, "CONFIRMADA").estadoHttp, 409);
});

test("validarCambioEstado: transición válida devuelve el nuevo estado", () => {
  assert.deepEqual(validarCambioEstado({ estado: "CONFIRMADA" }, "PENDIENTE"), { error: null, estado: "CONFIRMADA" });
  assert.equal(validarCambioEstado({ estado: "CANCELADA" }, "CONFIRMADA").estado, "CANCELADA");
});

// ---------- Nueva reserva

test("reserva válida", () => {
  const { errores, datos } = validarNuevaReserva(nueva(), AHORA);
  assert.deepEqual(errores, []);
  assert.deepEqual(datos, { clienteId: CLIENTE, fecha: "2026-11-10", horaInicio: "19:00" });
});

test("solo se devuelven los campos aprobados: se ignoran precio y estado enviados", () => {
  const { datos } = validarNuevaReserva({ ...nueva(), precio: 0.01, estado: "CONFIRMADA", codigo: "X" }, AHORA);
  assert.deepEqual(Object.keys(datos).sort(), ["clienteId", "fecha", "horaInicio"]);
});

test("cliente: debe ser un uuid", () => {
  for (const clienteId of ["", "123", "no-es-uuid", null, undefined, 5, `${CLIENTE}x`]) {
    assert.equal(validarNuevaReserva(nueva({ clienteId }), AHORA).errores.length, 1, `debería rechazar ${clienteId}`);
  }
});

test("fecha: inválida, pasada o demasiado lejana se rechaza", () => {
  assert.equal(validarNuevaReserva(nueva({ fecha: "2026-02-31" }), AHORA).errores.length, 1);
  assert.equal(validarNuevaReserva(nueva({ fecha: "mañana" }), AHORA).errores.length, 1);
  assert.equal(validarNuevaReserva(nueva({ fecha: undefined }), AHORA).errores.length, 1);
  assert.match(validarNuevaReserva(nueva({ fecha: "2026-11-04" }), AHORA).errores[0], /fecha pasada/);
  assert.match(validarNuevaReserva(nueva({ fecha: "2027-12-31" }), AHORA).errores[0], /anticipación/);
});

test("fecha: hoy y el último día permitido son válidos", () => {
  assert.deepEqual(validarNuevaReserva(nueva({ fecha: "2026-11-05", horaInicio: "20:00" }), AHORA).errores, []);
  assert.deepEqual(validarNuevaReserva(nueva({ fecha: sumarDias("2026-11-05", 365) }), AHORA).errores, []);
  assert.equal(validarNuevaReserva(nueva({ fecha: sumarDias("2026-11-05", 366) }), AHORA).errores.length, 1);
});

test("hora: debe ser un bloque válido (08:00 a 23:00 en punto)", () => {
  for (const horaInicio of ["07:00", "00:00", "23:30", "19:30", "24:00", "8:00", "19:00:00", "", null, undefined, 19]) {
    assert.equal(validarNuevaReserva(nueva({ horaInicio }), AHORA).errores.length, 1, `debería rechazar ${horaInicio}`);
  }
  assert.deepEqual(validarNuevaReserva(nueva({ horaInicio: "08:00" }), AHORA).errores, []);
  assert.deepEqual(validarNuevaReserva(nueva({ horaInicio: "23:00" }), AHORA).errores, []);
});

test("si la reserva es hoy, el bloque no puede haber empezado ya", () => {
  const hoy = (horaInicio) => validarNuevaReserva(nueva({ fecha: AHORA.fecha, horaInicio }), AHORA).errores;
  assert.match(hoy("10:00")[0], /ya pasó/);
  assert.match(hoy("14:00")[0], /ya pasó/);
  assert.deepEqual(hoy("15:00"), []);
  assert.deepEqual(hoy("23:00"), []);
  // En una fecha futura la hora actual no importa.
  assert.deepEqual(validarNuevaReserva(nueva({ fecha: "2026-11-06", horaInicio: "08:00" }), AHORA).errores, []);
});

test("entrada que no es un objeto no rompe la validación", () => {
  for (const entrada of [null, undefined, "x", 4]) {
    assert.ok(validarNuevaReserva(entrada, AHORA).errores.length >= 3);
  }
});

// ---------- Disponibilidad

test("disponibilidad: separa libres y ocupados (acepta HH:MM:SS)", () => {
  const { libres, ocupados, pasados } = calcularDisponibilidad("2026-11-10", ["19:00:00", "20:00"], AHORA);
  assert.deepEqual(ocupados, ["19:00", "20:00"]);
  assert.deepEqual(pasados, []);
  assert.equal(libres.length, bloquesHorarios().length - 2);
  assert.equal(libres.includes("19:00"), false);
  assert.equal(libres[0], "08:00");
});

test("disponibilidad: hoy, los bloques que ya empezaron son 'pasados'", () => {
  const { libres, pasados } = calcularDisponibilidad("2026-11-05", [], AHORA);
  assert.deepEqual(pasados, ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00"]);
  assert.equal(libres[0], "15:00");
});

test("disponibilidad: una fecha pasada no tiene bloques libres", () => {
  const { libres, pasados } = calcularDisponibilidad("2026-11-01", [], AHORA);
  assert.deepEqual(libres, []);
  assert.equal(pasados.length, bloquesHorarios().length);
});

// ---------- Código y utilidades

test("código de reserva: R-AAAAMMDD-HHMM-XXXX", () => {
  assert.equal(construirCodigo("2026-11-09", "19:00", "AB3K"), "R-20261109-1900-AB3K");
  assert.equal(construirCodigo("2026-11-09", "08:00:00", "ZZZZ"), "R-20261109-0800-ZZZZ");
  assert.equal(ALFABETO_CODIGO.includes("O"), false);
  assert.equal(ALFABETO_CODIGO.includes("0"), false);
});

test("bloques horarios: de 08:00 a 23:00, 16 bloques", () => {
  const bloques = bloquesHorarios();
  assert.equal(bloques.length, 16);
  assert.equal(bloques[0], "08:00");
  assert.equal(bloques.at(-1), "23:00");
  assert.equal(esBloqueValido("12:00"), true);
  assert.equal(esBloqueValido("12:30"), false);
});

test("utilidades de fecha: día de la semana sin depender de la zona horaria", () => {
  assert.equal(diaSemanaDe("2026-11-07"), 6); // sábado
  assert.equal(diaSemanaDe("2026-11-08"), 0); // domingo
  assert.equal(diaSemanaDe("2026-11-09"), 1); // lunes
  assert.equal(sumarDias("2026-03-01", -1), "2026-02-28");
  assert.equal(sumarDias("2026-12-31", 1), "2027-01-01");
  assert.equal(sumarDias("2026-11-09", -30), "2026-10-10");
  assert.equal(fechaValida("2024-02-29"), true);
  assert.equal(fechaValida("2026-02-29"), false);
  assert.equal(horaValida("23:59"), true);
  assert.equal(horaValida("24:00"), false);
});

test("hoyEnNegocio usa America/Guayaquil (UTC-5), no la zona del servidor", () => {
  // 2026-11-06 03:30 UTC es 2026-11-05 22:30 en Guayaquil.
  assert.deepEqual(hoyEnNegocio(new Date("2026-11-06T03:30:00Z")), { fecha: "2026-11-05", hora: "22:30" });
  // 2026-11-05 05:00 UTC es medianoche del 5 en Guayaquil.
  assert.deepEqual(hoyEnNegocio(new Date("2026-11-05T05:00:00Z")), { fecha: "2026-11-05", hora: "00:00" });
  assert.deepEqual(hoyEnNegocio(new Date("2026-11-05T04:59:00Z")), { fecha: "2026-11-04", hora: "23:59" });
});
