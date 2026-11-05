// Funciones de formato para mostrar datos en la interfaz.

export const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export const NOMBRE_ESTADO = {
  PENDIENTE: "Pendiente",
  CONFIRMADA: "Confirmada",
  CANCELADA: "Cancelada",
};

export const NOMBRE_ROL = {
  ADMINISTRADOR: "Administrador",
  RECEPCIONISTA: "Recepcionista",
  CLIENTE: "Cliente",
};

// "18:00:00" -> "18:00"
export const hora = (texto) => (texto ? texto.slice(0, 5) : "");

// Decimal -> porcentaje con máximo 1 decimal (0.125 -> 12.5).
export const porcentaje = (decimal) => Math.round(Number(decimal) * 1000) / 10;

// Número -> "$40.00"
export const dolares = (valor) => `$${Number(valor).toFixed(2)}`;

// "2026-11-09" -> "09/11/2026"
export function fechaLegible(fecha) {
  if (typeof fecha !== "string") return "";
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}
