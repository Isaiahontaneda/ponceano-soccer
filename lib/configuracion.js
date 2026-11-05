// Configuración del negocio. Cambia estos valores para ajustar el horario de la cancha.

// Zona horaria del negocio (Ecuador continental, UTC-5, sin horario de verano).
export const ZONA_HORARIA = "America/Guayaquil";

// Los bloques son de 1 hora. El primero empieza a las 08:00 y el último
// a las 23:00 (termina 23:59 / 24:00).
export const HORA_APERTURA = 8;
export const HORA_ULTIMO_BLOQUE = 23;

// Ventana (en días) que usa el Core para contar reservas del cliente frecuente.
export const DIAS_HISTORIAL_CLIENTE = 30;

// Devuelve los bloques operativos como texto "HH:00": ["08:00", ..., "23:00"].
export function bloquesHorarios() {
  const bloques = [];
  for (let h = HORA_APERTURA; h <= HORA_ULTIMO_BLOQUE; h++) {
    bloques.push(`${String(h).padStart(2, "0")}:00`);
  }
  return bloques;
}

// Indica si un texto es exactamente el inicio de un bloque operativo ("HH:00").
export function esBloqueValido(hora) {
  return typeof hora === "string" && bloquesHorarios().includes(hora);
}
