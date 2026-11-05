import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validarTarifa,
  comparacionesActivas,
  motivoNoEliminable,
  porcentajeADecimal,
} from "../lib/validaciones/tarifa.js";

// Tarifas de ejemplo (con los datos reales del negocio).
const EXISTENTES = [
  { id: 1, codigo: "BASE", nombre: "Tarifa base", valor: 40 },
  { id: 2, codigo: "FRANJA_HORARIA", nombre: "Día", valor: 0, horaInicio: "08:00:00", horaFin: "17:59:00" },
  { id: 3, codigo: "FRANJA_HORARIA", nombre: "Hora pico", valor: 0.25, horaInicio: "18:00:00", horaFin: "21:59:00" },
  { id: 4, codigo: "FRANJA_HORARIA", nombre: "Noche", valor: 0.125, horaInicio: "22:00:00", horaFin: "23:59:00" },
  { id: 5, codigo: "DIA_SEMANA", nombre: "Sábado", valor: 0.1, diaSemana: 6 },
  { id: 6, codigo: "FECHA_ESPECIAL", nombre: "Feriado", valor: 0.2, fecha: "2026-11-02" },
  { id: 7, codigo: "CLIENTE_FRECUENTE", nombre: "Frecuente", valor: 0.1, minReservas: 3 },
];

const sinBase = EXISTENTES.filter((t) => t.codigo !== "BASE");

test("porcentajeADecimal convierte 12.5 en 0.125", () => {
  assert.equal(porcentajeADecimal(12.5), 0.125);
  assert.equal(porcentajeADecimal(25), 0.25);
  assert.equal(porcentajeADecimal(0.1), 0.001);
  assert.equal(porcentajeADecimal(100), 1);
});

// ---------- Tarifa base

test("BASE válida: dólares con 2 decimales", () => {
  const { errores, datos } = validarTarifa({ nombre: "Tarifa base", valor: "40.50" }, "BASE", sinBase);
  assert.deepEqual(errores, []);
  assert.equal(datos.valor, 40.5);
  assert.equal(datos.horaInicio, null);
  assert.equal(datos.diaSemana, null);
});

test("BASE: 0, negativos, más de 1000 y más de 2 decimales se rechazan", () => {
  for (const valor of [0, -5, 1000.01, 1001, 40.123, "abc", "", null, undefined, NaN]) {
    const { errores } = validarTarifa({ nombre: "Base", valor }, "BASE", sinBase);
    assert.equal(errores.length, 1, `debería rechazar ${valor}`);
  }
});

test("BASE: el límite 1000 es válido", () => {
  const { errores } = validarTarifa({ nombre: "Base", valor: 1000 }, "BASE", sinBase);
  assert.deepEqual(errores, []);
});

test("BASE: no se permite una segunda base, pero sí editar la existente", () => {
  const nueva = validarTarifa({ nombre: "Otra", valor: 30 }, "BASE", EXISTENTES);
  assert.match(nueva.errores.join(" "), /Ya existe una tarifa base/);

  const edicion = validarTarifa({ nombre: "Base", valor: 45 }, "BASE", EXISTENTES, 1);
  assert.deepEqual(edicion.errores, []);
});

// ---------- Nombre

test("nombre: obligatorio y máximo 60 caracteres", () => {
  assert.equal(validarTarifa({ nombre: "", valor: 40 }, "BASE", sinBase).errores.length, 1);
  assert.equal(validarTarifa({ nombre: "   ", valor: 40 }, "BASE", sinBase).errores.length, 1);
  assert.equal(validarTarifa({ nombre: 123, valor: 40 }, "BASE", sinBase).errores.length, 1);
  assert.equal(validarTarifa({ nombre: "a".repeat(61), valor: 40 }, "BASE", sinBase).errores.length, 1);
  assert.deepEqual(validarTarifa({ nombre: "a".repeat(60), valor: 40 }, "BASE", sinBase).errores, []);
});

test("nombre: se recortan los espacios", () => {
  const { datos } = validarTarifa({ nombre: "  Base  ", valor: 40 }, "BASE", sinBase);
  assert.equal(datos.nombre, "Base");
});

// ---------- Porcentajes

test("porcentaje: 12.5 se guarda como 0.125 (máximo 1 decimal)", () => {
  const { errores, datos } = validarTarifa(
    { nombre: "Nueva", valor: "12.5", horaInicio: "01:00", horaFin: "02:00" },
    "FRANJA_HORARIA",
    EXISTENTES
  );
  assert.deepEqual(errores, []);
  assert.equal(datos.valor, 0.125);
});

test("porcentaje: 0 y 100 son válidos; fuera de rango o con 2 decimales no", () => {
  const dia = { nombre: "Domingo", diaSemana: 0 };
  assert.deepEqual(validarTarifa({ ...dia, valor: 0 }, "DIA_SEMANA", EXISTENTES).errores, []);
  assert.deepEqual(validarTarifa({ ...dia, valor: 100 }, "DIA_SEMANA", EXISTENTES).errores, []);
  for (const valor of [-1, 100.1, 101, 12.55, "x", "", null]) {
    assert.equal(
      validarTarifa({ ...dia, valor }, "DIA_SEMANA", EXISTENTES).errores.length,
      1,
      `debería rechazar ${valor}`
    );
  }
});

// ---------- Franja horaria

test("franja: horas obligatorias, formato válido e inicio < fin", () => {
  const base = { nombre: "Madrugada", valor: 5 };
  assert.equal(validarTarifa({ ...base }, "FRANJA_HORARIA", sinBase).errores.length, 1);
  assert.equal(
    validarTarifa({ ...base, horaInicio: "25:00", horaFin: "26:00" }, "FRANJA_HORARIA", sinBase).errores.length,
    1
  );
  assert.match(
    validarTarifa({ ...base, horaInicio: "05:00", horaFin: "04:00" }, "FRANJA_HORARIA", sinBase).errores[0],
    /menor que la hora de fin/
  );
  assert.match(
    validarTarifa({ ...base, horaInicio: "05:00", horaFin: "05:00" }, "FRANJA_HORARIA", sinBase).errores[0],
    /menor que la hora de fin/
  );
});

test("franja: no puede cruzarse con otra, ni tocarla en un extremo", () => {
  const base = { nombre: "Nueva", valor: 5 };
  const cruce = validarTarifa({ ...base, horaInicio: "17:00", horaFin: "19:00" }, "FRANJA_HORARIA", EXISTENTES);
  assert.match(cruce.errores[0], /se cruza con/);

  // Tocar el extremo (18:00 está incluido en "Hora pico") también cuenta como cruce.
  const roce = validarTarifa({ ...base, horaInicio: "21:59", horaFin: "22:00" }, "FRANJA_HORARIA", EXISTENTES);
  assert.match(roce.errores[0], /se cruza con/);
});

test("franja: una franja libre es válida y no se cruza consigo misma al editar", () => {
  const libre = validarTarifa(
    { nombre: "Madrugada", valor: 5, horaInicio: "00:00", horaFin: "07:59" },
    "FRANJA_HORARIA",
    EXISTENTES
  );
  assert.deepEqual(libre.errores, []);
  assert.equal(libre.datos.horaInicio, "00:00");

  const editandoPico = validarTarifa(
    { nombre: "Hora pico", valor: 30, horaInicio: "18:00", horaFin: "21:59" },
    "FRANJA_HORARIA",
    EXISTENTES,
    3
  );
  assert.deepEqual(editandoPico.errores, []);
  assert.equal(editandoPico.datos.valor, 0.3);
});

test("franja: acepta HH:MM:SS y guarda HH:MM", () => {
  const { errores, datos } = validarTarifa(
    { nombre: "Madrugada", valor: 5, horaInicio: "00:00:00", horaFin: "07:59:00" },
    "FRANJA_HORARIA",
    EXISTENTES
  );
  assert.deepEqual(errores, []);
  assert.equal(datos.horaFin, "07:59");
});

// ---------- Día de la semana y fecha especial

test("día de la semana: entero de 0 a 6 y sin repetir", () => {
  const dato = (diaSemana) => ({ nombre: "Día", valor: 5, diaSemana });
  assert.deepEqual(validarTarifa(dato(0), "DIA_SEMANA", EXISTENTES).errores, []);
  assert.deepEqual(validarTarifa(dato("3"), "DIA_SEMANA", EXISTENTES).errores, []);
  for (const d of [-1, 7, 1.5, "x", "", null, undefined]) {
    assert.equal(validarTarifa(dato(d), "DIA_SEMANA", EXISTENTES).errores.length, 1, `debería rechazar ${d}`);
  }
  assert.match(validarTarifa(dato(6), "DIA_SEMANA", EXISTENTES).errores[0], /Ya existe una regla para ese día/);
  assert.deepEqual(validarTarifa(dato(6), "DIA_SEMANA", EXISTENTES, 5).errores, []);
});

test("fecha especial: fecha real y sin repetir", () => {
  const dato = (fecha) => ({ nombre: "Feriado", valor: 20, fecha });
  assert.deepEqual(validarTarifa(dato("2026-12-25"), "FECHA_ESPECIAL", EXISTENTES).errores, []);
  for (const f of ["2026-02-31", "2026-13-01", "25/12/2026", "", null, undefined, 20261225]) {
    assert.equal(validarTarifa(dato(f), "FECHA_ESPECIAL", EXISTENTES).errores.length, 1, `debería rechazar ${f}`);
  }
  assert.match(validarTarifa(dato("2026-11-02"), "FECHA_ESPECIAL", EXISTENTES).errores[0], /Ya existe una regla para esa fecha/);
});

// ---------- Cliente frecuente

test("cliente frecuente: minReservas entero ≥ 1", () => {
  const dato = (minReservas) => ({ nombre: "VIP", valor: 15, minReservas });
  assert.deepEqual(validarTarifa(dato(1), "CLIENTE_FRECUENTE", EXISTENTES).errores, []);
  assert.deepEqual(validarTarifa(dato("5"), "CLIENTE_FRECUENTE", EXISTENTES).datos.minReservas, 5);
  for (const m of [0, -2, 2.5, "x", "", null, undefined]) {
    assert.equal(validarTarifa(dato(m), "CLIENTE_FRECUENTE", EXISTENTES).errores.length, 1, `debería rechazar ${m}`);
  }
});

// ---------- Tipo desconocido y campos de más

test("tipo desconocido da error", () => {
  const { errores } = validarTarifa({ nombre: "X", valor: 1 }, "OTRO", EXISTENTES);
  assert.match(errores.join(" "), /Tipo de tarifa no reconocido/);
  assert.equal(validarTarifa({ nombre: "X", valor: 1 }, undefined, EXISTENTES).errores.length, 1);
});

test("los campos que no corresponden al tipo se guardan en null", () => {
  const { datos } = validarTarifa(
    { nombre: "Sábado 2", valor: 5, diaSemana: 0, horaInicio: "10:00", horaFin: "11:00", fecha: "2026-01-01", minReservas: 3, precio: 999 },
    "DIA_SEMANA",
    EXISTENTES
  );
  assert.equal(datos.diaSemana, 0);
  assert.equal(datos.horaInicio, null);
  assert.equal(datos.horaFin, null);
  assert.equal(datos.fecha, null);
  assert.equal(datos.minReservas, null);
  assert.equal("precio" in datos, false);
});

test("entrada que no es un objeto no rompe la validación", () => {
  for (const entrada of [null, undefined, "texto", 5]) {
    const { errores } = validarTarifa(entrada, "BASE", sinBase);
    assert.ok(errores.length > 0);
  }
});

// ---------- Comparaciones del Core y eliminación

const conCodigo = EXISTENTES.map((t) => ({ ...t, tipoCodigo: t.codigo }));

test("comparacionesActivas cuenta las 3 comparaciones", () => {
  const completo = comparacionesActivas(conCodigo);
  assert.equal(completo.total, 3);
  assert.equal(completo.hayBase, true);

  const sinFrecuente = comparacionesActivas(conCodigo.filter((t) => t.codigo !== "CLIENTE_FRECUENTE"));
  assert.equal(sinFrecuente.total, 2);
  assert.equal(sinFrecuente.clienteFrecuente, false);

  const vacio = comparacionesActivas([]);
  assert.equal(vacio.total, 0);
  assert.equal(vacio.hayBase, false);
});

test("calendario cuenta como un solo grupo (día de la semana o fecha especial)", () => {
  const soloFecha = conCodigo.filter((t) => t.codigo !== "DIA_SEMANA");
  assert.equal(comparacionesActivas(soloFecha).calendario, true);
  const ninguno = conCodigo.filter((t) => t.codigo !== "DIA_SEMANA" && t.codigo !== "FECHA_ESPECIAL");
  assert.equal(comparacionesActivas(ninguno).calendario, false);
});

test("no se puede eliminar la tarifa base", () => {
  assert.match(motivoNoEliminable(conCodigo[0], conCodigo), /tarifa base/);
});

test("no se puede eliminar la última regla de un grupo", () => {
  const frecuente = conCodigo.find((t) => t.codigo === "CLIENTE_FRECUENTE");
  assert.match(motivoNoEliminable(frecuente, conCodigo), /última regla de cliente frecuente/);

  // Calendario: hay dos reglas (día y fecha); se puede borrar una, pero no la última.
  const sabado = conCodigo.find((t) => t.codigo === "DIA_SEMANA");
  const feriado = conCodigo.find((t) => t.codigo === "FECHA_ESPECIAL");
  assert.equal(motivoNoEliminable(sabado, conCodigo), null);
  const sinSabado = conCodigo.filter((t) => t.id !== sabado.id);
  assert.match(motivoNoEliminable(feriado, sinSabado), /última regla de calendario/);
});

test("sí se puede eliminar una regla si queda otra del mismo grupo", () => {
  const noche = conCodigo.find((t) => t.nombre === "Noche");
  assert.equal(motivoNoEliminable(noche, conCodigo), null);
});
