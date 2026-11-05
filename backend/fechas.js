// Utilidades de fecha y hora. Funciones puras: no dependen de la zona horaria
// del servidor, salvo hoyEnNegocio(), que usa explícitamente la del negocio.
import { ZONA_HORARIA } from "./configuracion.js";

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

// Hora "HH:MM:SS" -> "HH:MM".
export function recortarHora(hora) {
  return typeof hora === "string" ? hora.slice(0, 5) : "";
}

// Fecha real en formato AAAA-MM-DD (rechaza, por ejemplo, 2026-02-31).
export function fechaValida(texto) {
  if (typeof texto !== "string" || !REGEX_FECHA.test(texto)) return false;
  const fecha = new Date(texto + "T00:00:00Z");
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
}

// Hora en formato HH:MM o HH:MM:SS.
export function horaValida(texto) {
  return typeof texto === "string" && REGEX_HORA.test(texto);
}

// Día de la semana de una fecha AAAA-MM-DD: 0 = domingo ... 6 = sábado.
// Usa Date.UTC para no depender de la zona horaria de la máquina.
export function diaSemanaDe(fecha) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
}

// Suma (o resta, con negativos) días a una fecha AAAA-MM-DD.
export function sumarDias(fecha, dias) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const resultado = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return resultado.toISOString().slice(0, 10);
}

// "Hoy" y la hora actual según la zona horaria del negocio.
// Devuelve { fecha: "AAAA-MM-DD", hora: "HH:MM" }.
export function hoyEnNegocio(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(ahora);

  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}
