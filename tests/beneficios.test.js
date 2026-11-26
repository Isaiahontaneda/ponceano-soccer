// Etapa 4: reglas de fidelidad del cliente, en sus bordes.
import test from "node:test";
import assert from "node:assert/strict";
import { calcularPrecio } from "../backend/core/calcularPrecio.js";
import { contarReservasCliente, describirRegla, resumirBeneficios } from "../backend/core/beneficiosCliente.js";
import { REGLAS_CLIENTE, cliente, historiales } from "./datos.js";

const LUNES = "2026-11-30";
const BASE_40 = [{ tipoCodigo: "BASE", nombre: "Base", valor: 40 }];
const regla = (tipo) => REGLAS_CLIENTE.find((r) => r.tipoCodigo === tipo);

// Beneficios con una sola regla y una base de $40 (09:00, rango de la mañana).
function beneficiosCon(reglas, datosCliente, { fecha = LUNES, demanda = [] } = {}) {
  return calcularPrecio({ fecha, horaInicio: "09:00", historiales: demanda, cliente: datosCliente }, BASE_40, reglas)
    .beneficios;
}
const aplica = (reglas, datosCliente, opciones) => beneficiosCon(reglas, datosCliente, opciones).aplicada !== null;

// ----- Cada tipo en su borde

test("tarjeta de sellos: 2 no alcanzan, 3 sí", () => {
  const sellos = [regla("TARJETA_SELLOS")];
  assert.equal(aplica(sellos, cliente({ sellos: 2 })), false);
  assert.equal(aplica(sellos, cliente({ sellos: 3 })), true);
  assert.equal(
    beneficiosCon(sellos, cliente({ sellos: 2 })).evaluadas[0].motivo,
    "2 reservas confirmadas desde el último sello (se necesitan 3)"
  );
});

test("reserva anticipada: 6 días no alcanzan, 7 sí", () => {
  const anticipada = [regla("RESERVA_ANTICIPADA")];
  assert.equal(aplica(anticipada, cliente({ dias: 6 })), false);
  assert.equal(aplica(anticipada, cliente({ dias: 7 })), true);
});

test("bienvenida: 0 reservas previas sí, 1 no", () => {
  const bienvenida = [regla("BIENVENIDA")];
  assert.equal(aplica(bienvenida, cliente({ reservasPrevias: 0 })), true);
  assert.equal(aplica(bienvenida, cliente({ reservasPrevias: 1 })), false);
});

test("horario valle: con ajuste −5 % y −12.5 % sí; con 0 % no", () => {
  const valle = [regla("HORARIO_VALLE")];
  assert.equal(aplica(valle, cliente(), { demanda: historiales(0.2, 0.24) }), true); // −5 %
  assert.equal(aplica(valle, cliente(), { demanda: historiales(0.06, 0.1) }), true); // −12.5 %
  assert.equal(aplica(valle, cliente(), { demanda: historiales(0.5, 0.5) }), false); // 0 %
  assert.equal(aplica(valle, cliente(), { demanda: historiales(0.95, 0.9) }), false); // +10 %
});

// ----- Activa y vigencia

test("una regla inactiva no aplica", () => {
  const inactiva = [{ ...regla("BIENVENIDA"), activa: false }];
  const b = beneficiosCon(inactiva, cliente({ reservasPrevias: 0 }));
  assert.equal(b.aplicada, null);
  assert.equal(b.evaluadas[0].motivo, "Regla inactiva");
});

test("vigenteDesde: el día anterior no aplica; el mismo día sí", () => {
  const bienvenida = [{ ...regla("BIENVENIDA"), vigenteDesde: LUNES }];
  const nuevo = cliente({ reservasPrevias: 0 });
  assert.equal(aplica(bienvenida, nuevo, { fecha: "2026-11-29" }), false);
  assert.equal(aplica(bienvenida, nuevo, { fecha: LUNES }), true);
});

test("vigenteHasta: el mismo día aplica; el día siguiente no", () => {
  const bienvenida = [{ ...regla("BIENVENIDA"), vigenteHasta: LUNES }];
  const nuevo = cliente({ reservasPrevias: 0 });
  assert.equal(aplica(bienvenida, nuevo, { fecha: LUNES }), true);
  assert.equal(aplica(bienvenida, nuevo, { fecha: "2026-12-01" }), false);
});

// ----- Combinación

test("los descuentos no se acumulan: se usa solo el mayor", () => {
  // Sellos (15 %), bienvenida (10 %), anticipada (5 %) y valle (10 %) a la vez.
  const todo = { reservasPrevias: 0, confirmadasDesdeUltimoSello: 3, diasAnticipacion: 30 };
  const r = calcularPrecio(
    { fecha: LUNES, horaInicio: "09:00", historiales: historiales(0.06, 0.1), cliente: todo },
    BASE_40,
    REGLAS_CLIENTE
  );
  assert.equal(r.beneficios.evaluadas.filter((e) => e.aplica).length, 4);
  assert.equal(r.beneficios.aplicada.nombre, "Tarjeta de sellos");
  assert.equal(r.precio, 29.75); // 35 × 0.85, no 35 × (1 − 0.40)
});

test("empate de descuentos: gana el menor id, sin importar el orden de la lista", () => {
  const bienvenida = regla("BIENVENIDA"); // id 2, 10 %
  const valle = regla("HORARIO_VALLE"); // id 4, 10 %
  const datos = cliente({ reservasPrevias: 0 });
  const demanda = historiales(0.06, 0.1);
  assert.equal(beneficiosCon([valle, bienvenida], datos, { demanda }).aplicada.id, 2);
  assert.equal(beneficiosCon([bienvenida, valle], datos, { demanda }).aplicada.id, 2);
});

test("cliente null: no se evalúa ningún beneficio", () => {
  assert.deepEqual(beneficiosCon(REGLAS_CLIENTE, null), { evaluadas: [], aplicada: null });
});

test("datos del cliente que no son enteros: error", () => {
  assert.throws(() => beneficiosCon(REGLAS_CLIENTE, { reservasPrevias: "2", confirmadasDesdeUltimoSello: 0, diasAnticipacion: 0 }));
});

// ----- Conteo de sellos (lo que prepara el servicio)

const SELLO = [1]; // ids de las reglas TARJETA_SELLOS
const reserva = (estado, fechaCreacion, reglaClienteId = null) => ({ estado, fechaCreacion, reglaClienteId });

test("sin sellos usados cuentan todas las confirmadas; las canceladas no cuentan", () => {
  const reservas = [
    reserva("CONFIRMADA", "2026-11-01T10:00:00+00:00"),
    reserva("CONFIRMADA", "2026-11-02T10:00:00+00:00"),
    reserva("PENDIENTE", "2026-11-03T10:00:00+00:00"),
    reserva("CANCELADA", "2026-11-04T10:00:00+00:00"),
  ];
  assert.deepEqual(contarReservasCliente(reservas, SELLO), { reservasPrevias: 3, confirmadasDesdeUltimoSello: 2 });
});

test("la tarjeta se reinicia al usar un sello (aunque esa reserva siga pendiente)", () => {
  const reservas = [
    reserva("CONFIRMADA", "2026-11-01T10:00:00+00:00"),
    reserva("CONFIRMADA", "2026-11-02T10:00:00+00:00"),
    reserva("CONFIRMADA", "2026-11-03T10:00:00+00:00"),
    reserva("PENDIENTE", "2026-11-04T10:00:00+00:00", 1), // usó el sello
    reserva("CONFIRMADA", "2026-11-05T10:00:00+00:00"),
  ];
  assert.equal(contarReservasCliente(reservas, SELLO).confirmadasDesdeUltimoSello, 1);
});

test("si la reserva que usó el sello se cancela, el sello vuelve", () => {
  const reservas = [
    reserva("CONFIRMADA", "2026-11-01T10:00:00+00:00"),
    reserva("CONFIRMADA", "2026-11-02T10:00:00+00:00"),
    reserva("CONFIRMADA", "2026-11-03T10:00:00+00:00"),
    reserva("CANCELADA", "2026-11-04T10:00:00+00:00", 1),
  ];
  assert.equal(contarReservasCliente(reservas, SELLO).confirmadasDesdeUltimoSello, 3);
});

test("una reserva con otra regla (bienvenida) no reinicia la tarjeta", () => {
  const reservas = [reserva("CONFIRMADA", "2026-11-01T10:00:00+00:00", 2), reserva("CONFIRMADA", "2026-11-02T10:00:00+00:00")];
  assert.equal(contarReservasCliente(reservas, SELLO).confirmadasDesdeUltimoSello, 2);
});

// ----- Lo que ve el cliente

test("describirRegla: un texto fijo por tipo", () => {
  assert.equal(describirRegla(regla("TARJETA_SELLOS")), "15 % de descuento cada 3 reservas confirmadas");
  assert.equal(describirRegla(regla("BIENVENIDA")), "10 % en tu primera reserva");
  assert.equal(describirRegla(regla("RESERVA_ANTICIPADA")), "5 % si reservas con 7 días o más de anticipación");
  assert.equal(describirRegla(regla("HORARIO_VALLE")), "10 % en horarios de baja demanda");
});

test("resumirBeneficios: sellos acumulados y solo reglas activas y vigentes", () => {
  const reglas = REGLAS_CLIENTE.map((r) => (r.tipoCodigo === "HORARIO_VALLE" ? { ...r, activa: false } : r));
  const resumen = resumirBeneficios(reglas, LUNES, { reservasPrevias: 4, confirmadasDesdeUltimoSello: 2 });
  assert.deepEqual(resumen.sellos, { acumulados: 2, necesarios: 3, faltan: 1, descuento: 0.15 });
  assert.deepEqual(
    resumen.reglas.map((r) => r.nombre),
    ["Tarjeta de sellos", "Bienvenida", "Reserva anticipada"]
  );
  assert.deepEqual(Object.keys(resumen.reglas[0]), ["nombre", "descuento", "descripcion"]);
});

test("resumirBeneficios: sin regla de sellos activa, sellos es null", () => {
  const sinSellos = REGLAS_CLIENTE.filter((r) => r.tipoCodigo !== "TARJETA_SELLOS");
  assert.equal(resumirBeneficios(sinSellos, LUNES, { reservasPrevias: 0, confirmadasDesdeUltimoSello: 5 }).sellos, null);
});
