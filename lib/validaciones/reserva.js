// Validación de reservas y máquina de estados. Funciones puras (sin base de datos ni alias "@/").
import { MAX_DIAS_ANTICIPACION, bloquesHorarios, esBloqueValido } from "../configuracion.js";
import { fechaValida, recortarHora, sumarDias } from "../fechas.js";
import { esUuid } from "./comun.js";

export const ESTADOS = ["PENDIENTE", "CONFIRMADA", "CANCELADA"];

// Máquina de estados: a qué estados se puede pasar desde cada uno.
// CANCELADA es final.
export const TRANSICIONES = {
  PENDIENTE: ["CONFIRMADA", "CANCELADA"],
  CONFIRMADA: ["CANCELADA"],
  CANCELADA: [],
};

export function transicionPermitida(desde, hacia) {
  return Array.isArray(TRANSICIONES[desde]) && TRANSICIONES[desde].includes(hacia);
}

// Valida el cambio de estado pedido. Devuelve { error, estado }.
//   - error con status 422: el estado pedido no existe.
//   - error con status 409: la transición no está permitida.
export function validarCambioEstado(entrada, estadoActual) {
  const nuevo = entrada && typeof entrada === "object" ? entrada.estado : undefined;

  if (typeof nuevo !== "string" || !ESTADOS.includes(nuevo)) {
    return { error: "El estado debe ser PENDIENTE, CONFIRMADA o CANCELADA.", estadoHttp: 422 };
  }
  if (!transicionPermitida(estadoActual, nuevo)) {
    const finales = TRANSICIONES[estadoActual]?.length === 0;
    return {
      error: finales
        ? "Una reserva cancelada no se puede modificar."
        : `No se puede pasar de ${estadoActual} a ${nuevo}.`,
      estadoHttp: 409,
    };
  }
  return { error: null, estado: nuevo };
}

// Valida los datos para crear una reserva.
//   entrada: lo que manda el navegador (se ignora cualquier "precio" o "estado").
//   ahora: { fecha, hora } actuales en la zona del negocio (ver hoyEnNegocio).
// Devuelve { errores, datos } con solo los campos aprobados.
export function validarNuevaReserva(entrada, ahora) {
  const dato = entrada && typeof entrada === "object" ? entrada : {};
  const errores = [];

  const clienteId = typeof dato.clienteId === "string" ? dato.clienteId.toLowerCase() : "";
  if (!esUuid(clienteId)) errores.push("Debes elegir un cliente.");

  let fechaOk = false;
  if (!fechaValida(dato.fecha)) {
    errores.push("La fecha es obligatoria y debe ser válida (AAAA-MM-DD).");
  } else if (dato.fecha < ahora.fecha) {
    errores.push("No se puede reservar en una fecha pasada.");
  } else if (dato.fecha > sumarDias(ahora.fecha, MAX_DIAS_ANTICIPACION)) {
    errores.push(`No se puede reservar con más de ${MAX_DIAS_ANTICIPACION} días de anticipación.`);
  } else {
    fechaOk = true;
  }

  let horaOk = false;
  if (!esBloqueValido(dato.horaInicio)) {
    const bloques = bloquesHorarios();
    errores.push(`La hora debe ser un bloque válido, de ${bloques[0]} a ${bloques[bloques.length - 1]} en punto.`);
  } else {
    horaOk = true;
  }

  // Si la reserva es para hoy, el bloque no puede haber empezado ya.
  if (fechaOk && horaOk && dato.fecha === ahora.fecha && dato.horaInicio <= ahora.hora) {
    errores.push("Ese horario ya pasó. Elige un bloque posterior a la hora actual.");
  }

  return {
    errores,
    datos: { clienteId, fecha: dato.fecha, horaInicio: dato.horaInicio },
  };
}

// Clasifica los bloques de una fecha en libres, ocupados y pasados.
//   horasOcupadas: horas ("HH:MM" o "HH:MM:SS") de las reservas no canceladas de esa fecha.
//   ahora: { fecha, hora } actuales en la zona del negocio.
export function calcularDisponibilidad(fecha, horasOcupadas, ahora) {
  const ocupadasSet = new Set(horasOcupadas.map(recortarHora));
  const libres = [];
  const ocupados = [];
  const pasados = [];

  for (const bloque of bloquesHorarios()) {
    const yaPaso = fecha < ahora.fecha || (fecha === ahora.fecha && bloque <= ahora.hora);
    if (ocupadasSet.has(bloque)) ocupados.push(bloque);
    else if (yaPaso) pasados.push(bloque);
    else libres.push(bloque);
  }
  return { libres, ocupados, pasados };
}

// Alfabeto del sufijo aleatorio del código: sin 0/O ni 1/I para evitar confusiones al dictarlo.
export const ALFABETO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Arma el código de reserva: R-AAAAMMDD-HHMM-XXXX.
//   sufijo: 4 caracteres aleatorios (los genera el servidor).
export function construirCodigo(fecha, horaInicio, sufijo) {
  const fechaCompacta = fecha.replaceAll("-", "");
  const horaCompacta = recortarHora(horaInicio).replace(":", "");
  return `R-${fechaCompacta}-${horaCompacta}-${sufijo}`;
}
