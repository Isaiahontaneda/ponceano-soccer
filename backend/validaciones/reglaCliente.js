// Validación de las reglas de fidelidad del cliente. Funciones puras (sin base de datos ni alias "@/").
import {
  DESCUENTO_REGLA_MAXIMO,
  DESCUENTO_REGLA_MINIMO,
  MAX_CADA_RESERVAS,
  MAX_DIAS_ANTICIPACION_REGLA,
} from "../configuracion.js";
import { fechaValida } from "../fechas.js";
import { porcentajeADecimal } from "./tarifa.js";

export const TIPOS_REGLA_CLIENTE = ["TARJETA_SELLOS", "BIENVENIDA", "RESERVA_ANTICIPADA", "HORARIO_VALLE"];

// Convierte "12" o 12 en número; cualquier otra cosa da NaN.
function aNumero(crudo) {
  if (typeof crudo === "number") return crudo;
  if (typeof crudo === "string" && crudo.trim() !== "") return Number(crudo);
  return NaN;
}

// ¿El navegador dejó el campo vacío? (undefined, null o texto en blanco)
const estaVacio = (valor) => valor === undefined || valor === null || (typeof valor === "string" && valor.trim() === "");

// Al editar, el tipo no cambia (igual que en tarifas). Devuelve el mensaje de error o null.
export function errorCambioTipo(actual, tipoId) {
  return tipoId === actual.tipoId ? null : "El tipo de una regla no se puede cambiar. Crea una regla nueva.";
}

// Descuento en porcentaje (de 0.1 a 50, máximo 1 decimal) -> decimal, o null si no es válido.
function leerDescuento(crudo) {
  const valor = aNumero(crudo);
  const unDecimal = Number.isFinite(valor) && Math.round(valor * 10) / 10 === valor;
  if (!unDecimal || valor < DESCUENTO_REGLA_MINIMO || valor > DESCUENTO_REGLA_MAXIMO) return null;
  return porcentajeADecimal(valor);
}

// Parámetro entero que solo corresponde a un tipo de regla (cadaReservas o diasAnticipacion).
// Si el tipo lo usa, es obligatorio y entero en [1, maximo]; si no, debe quedar vacío.
function leerParametro(crudo, { corresponde, maximo, etiqueta }, errores) {
  if (!corresponde) {
    if (!estaVacio(crudo)) errores.push(`El campo "${etiqueta}" no corresponde a este tipo de regla.`);
    return null;
  }
  const valor = aNumero(crudo);
  if (!Number.isInteger(valor) || valor < 1 || valor > maximo) {
    errores.push(`"${etiqueta}" es obligatorio y debe ser un número entero de 1 a ${maximo}.`);
    return null;
  }
  return valor;
}

// Vigencia: desde obligatoria; hasta opcional y >= desde.
function leerVigencia(dato, errores) {
  const vigenteDesde = fechaValida(dato.vigenteDesde) ? dato.vigenteDesde : null;
  if (!vigenteDesde) errores.push("La fecha de inicio de vigencia es obligatoria (AAAA-MM-DD).");

  if (estaVacio(dato.vigenteHasta)) return { vigenteDesde, vigenteHasta: null };
  if (!fechaValida(dato.vigenteHasta)) {
    errores.push("La fecha de fin de vigencia debe ser válida (AAAA-MM-DD) o quedar vacía.");
    return { vigenteDesde, vigenteHasta: null };
  }
  if (vigenteDesde && dato.vigenteHasta < vigenteDesde) {
    errores.push("La fecha de fin de vigencia debe ser igual o posterior a la de inicio.");
  }
  return { vigenteDesde, vigenteHasta: dato.vigenteHasta };
}

// entrada: lo que manda el navegador (no es de fiar). tipoCodigo: código del tipo de la regla.
// existentes: reglas ya guardadas, con "id", "tipoCodigo" y "activa". idEditando: para no compararla consigo misma.
// Devuelve { errores, conflicto, datos }: "errores" → 422; "conflicto" (texto o null) → 409;
// "datos" solo trae los campos aprobados. El descuento entra en porcentaje y sale en decimal.
export function validarReglaCliente(entrada, tipoCodigo, existentes, idEditando = null) {
  const errores = [];
  const dato = entrada && typeof entrada === "object" ? entrada : {};
  if (!TIPOS_REGLA_CLIENTE.includes(tipoCodigo)) errores.push("Tipo de regla no reconocido.");

  const nombre = typeof dato.nombre === "string" ? dato.nombre.trim() : "";
  if (nombre.length < 3 || nombre.length > 60) errores.push("El nombre es obligatorio y debe tener de 3 a 60 caracteres.");

  const descuento = leerDescuento(dato.descuento);
  if (descuento === null) {
    errores.push(`El descuento debe ser un porcentaje de ${DESCUENTO_REGLA_MINIMO} a ${DESCUENTO_REGLA_MAXIMO}, con máximo 1 decimal.`);
  }

  const cadaReservas = leerParametro(
    dato.cadaReservas,
    { corresponde: tipoCodigo === "TARJETA_SELLOS", maximo: MAX_CADA_RESERVAS, etiqueta: "Cada cuántas reservas" },
    errores
  );
  const diasAnticipacion = leerParametro(
    dato.diasAnticipacion,
    { corresponde: tipoCodigo === "RESERVA_ANTICIPADA", maximo: MAX_DIAS_ANTICIPACION_REGLA, etiqueta: "Días de anticipación" },
    errores
  );
  const { vigenteDesde, vigenteHasta } = leerVigencia(dato, errores);

  // Si no se indica, la regla queda activa.
  const activa = dato.activa === undefined ? true : dato.activa === true;
  if (dato.activa !== undefined && typeof dato.activa !== "boolean") errores.push("El estado debe ser activa o inactiva.");

  // Como máximo una regla activa por tipo: evita reglas ambiguas.
  const otraActiva = existentes.find((r) => r.id !== idEditando && r.tipoCodigo === tipoCodigo && r.activa);
  const conflicto =
    activa && otraActiva ? `Ya hay una regla activa de este tipo ("${otraActiva.nombre}"). Desactívala primero.` : null;

  const datos = { nombre, descuento, cadaReservas, diasAnticipacion, activa, vigenteDesde, vigenteHasta };
  return { errores, conflicto, datos };
}
