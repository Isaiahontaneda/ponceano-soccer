// Validación del CRUD de reglas del cliente.
import test from "node:test";
import assert from "node:assert/strict";
import { errorCambioTipo, validarReglaCliente } from "../backend/validaciones/reglaCliente.js";

const BASICA = { nombre: "Mi regla", descuento: "15", vigenteDesde: "2026-11-01" };
const validar = (entrada, tipo, existentes = [], idEditando = null) =>
  validarReglaCliente({ ...BASICA, ...entrada }, tipo, existentes, idEditando);

// ----- Campos por tipo

test("tarjeta de sellos: cadaReservas obligatorio, entero de 1 a 50", () => {
  assert.equal(validar({}, "TARJETA_SELLOS").errores.length, 1);
  assert.equal(validar({ cadaReservas: "0" }, "TARJETA_SELLOS").errores.length, 1);
  assert.equal(validar({ cadaReservas: "51" }, "TARJETA_SELLOS").errores.length, 1);
  assert.equal(validar({ cadaReservas: "2.5" }, "TARJETA_SELLOS").errores.length, 1);
  const ok = validar({ cadaReservas: "3" }, "TARJETA_SELLOS");
  assert.deepEqual(ok.errores, []);
  assert.equal(ok.datos.cadaReservas, 3);
  assert.equal(ok.datos.diasAnticipacion, null);
});

test("reserva anticipada: diasAnticipacion obligatorio, entero de 1 a 365", () => {
  assert.equal(validar({}, "RESERVA_ANTICIPADA").errores.length, 1);
  assert.equal(validar({ diasAnticipacion: 366 }, "RESERVA_ANTICIPADA").errores.length, 1);
  assert.deepEqual(validar({ diasAnticipacion: 365 }, "RESERVA_ANTICIPADA").errores, []);
  assert.equal(validar({ diasAnticipacion: 7 }, "RESERVA_ANTICIPADA").datos.diasAnticipacion, 7);
});

test("bienvenida y horario valle: los parámetros deben quedar vacíos", () => {
  assert.deepEqual(validar({ cadaReservas: null, diasAnticipacion: "" }, "BIENVENIDA").errores, []);
  assert.equal(validar({ cadaReservas: 3 }, "BIENVENIDA").errores.length, 1);
  assert.equal(validar({ diasAnticipacion: 7 }, "HORARIO_VALLE").errores.length, 1);
  const { datos } = validar({}, "HORARIO_VALLE");
  assert.equal(datos.cadaReservas, null);
  assert.equal(datos.diasAnticipacion, null);
});

test("tipo desconocido: error", () => {
  assert.ok(validar({}, "CLIENTE_FRECUENTE").errores.includes("Tipo de regla no reconocido."));
});

test("nombre de 3 a 60 caracteres", () => {
  assert.equal(validar({ nombre: "ab" }, "BIENVENIDA").errores.length, 1);
  assert.equal(validar({ nombre: "x".repeat(61) }, "BIENVENIDA").errores.length, 1);
  assert.equal(validar({ nombre: "  abc  " }, "BIENVENIDA").datos.nombre, "abc");
});

// ----- Descuento en porcentaje

test("descuento: de 0.1 a 50, con un decimal como máximo; se guarda en decimal", () => {
  assert.equal(validar({ descuento: "0.1" }, "BIENVENIDA").datos.descuento, 0.001);
  assert.equal(validar({ descuento: "50" }, "BIENVENIDA").datos.descuento, 0.5);
  assert.equal(validar({ descuento: "12.5" }, "BIENVENIDA").datos.descuento, 0.125);
  assert.equal(validar({ descuento: "0" }, "BIENVENIDA").errores.length, 1);
  assert.equal(validar({ descuento: "50.1" }, "BIENVENIDA").errores.length, 1);
  assert.equal(validar({ descuento: "12.55" }, "BIENVENIDA").errores.length, 1);
  assert.equal(validar({ descuento: "abc" }, "BIENVENIDA").errores.length, 1);
  assert.equal(validar({ descuento: "" }, "BIENVENIDA").errores.length, 1);
});

// ----- Vigencia

test("vigencia: desde obligatoria, hasta opcional y >= desde", () => {
  assert.equal(validar({ vigenteDesde: "" }, "BIENVENIDA").errores.length, 1);
  assert.equal(validar({ vigenteDesde: "2026-02-31" }, "BIENVENIDA").errores.length, 1);
  assert.equal(validar({ vigenteHasta: "" }, "BIENVENIDA").datos.vigenteHasta, null);
  assert.deepEqual(validar({ vigenteHasta: "2026-11-01" }, "BIENVENIDA").errores, []); // mismo día
  assert.equal(validar({ vigenteHasta: "2026-10-31" }, "BIENVENIDA").errores.length, 1);
});

// ----- Una regla activa por tipo

const EXISTENTE = { id: 2, tipoCodigo: "BIENVENIDA", nombre: "Bienvenida", activa: true };

test("una segunda regla activa del mismo tipo es un conflicto (409)", () => {
  const { errores, conflicto } = validar({}, "BIENVENIDA", [EXISTENTE]);
  assert.deepEqual(errores, []);
  assert.match(conflicto, /Ya hay una regla activa de este tipo/);
});

test("sin conflicto: si la nueva queda inactiva, si la otra está inactiva o si se edita la misma", () => {
  assert.equal(validar({ activa: false }, "BIENVENIDA", [EXISTENTE]).conflicto, null);
  assert.equal(validar({}, "BIENVENIDA", [{ ...EXISTENTE, activa: false }]).conflicto, null);
  assert.equal(validar({}, "BIENVENIDA", [EXISTENTE], 2).conflicto, null);
  assert.equal(validar({}, "HORARIO_VALLE", [EXISTENTE]).conflicto, null);
});

test("activa: si no viene queda activa; si no es booleana, error", () => {
  assert.equal(validar({}, "BIENVENIDA").datos.activa, true);
  assert.equal(validar({ activa: "si" }, "BIENVENIDA").errores.length, 1);
});

// ----- Tipo inmutable al editar

test("el tipo no cambia al editar", () => {
  const actual = { id: 1, tipoId: 1 };
  assert.equal(errorCambioTipo(actual, 1), null);
  assert.match(errorCambioTipo(actual, 2), /no se puede cambiar/);
  assert.match(errorCambioTipo(actual, NaN), /no se puede cambiar/);
});

test("solo salen los campos aprobados", () => {
  const { datos } = validar({ cadaReservas: 3, precio: 1, tipoId: 9, reglaClienteId: 5 }, "TARJETA_SELLOS");
  assert.deepEqual(Object.keys(datos).sort(), [
    "activa",
    "cadaReservas",
    "descuento",
    "diasAnticipacion",
    "nombre",
    "vigenteDesde",
    "vigenteHasta",
  ]);
});
