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

// Hasta cuántos días en el futuro se puede reservar (evita fechas absurdas como el año 9999).
export const MAX_DIAS_ANTICIPACION = 365;

// Evita que un solo cliente bloquee todos los horarios con reservas sin confirmar.
export const MAX_PENDIENTES_POR_CLIENTE = 3;

// ----- Core v2: contraste con el historial y rangos publicados -----

// Primer día con reservas reales en el sistema (antes solo hay historial simulado).
export const INICIO_SISTEMA = "2026-11-01";

// Meses de la temporada de invierno (época lluviosa en Ecuador). El resto del año es verano.
export const MESES_INVIERNO = [12, 1, 2, 3, 4, 5];

// Cuántas semanas hacia atrás mira el historial actual (mismo día de la semana y hora).
export const SEMANAS_HISTORIAL_ACTUAL = 8;

// Mínimo de semanas reales para usar el historial actual (el sistema es nuevo: hay pocas).
export const MIN_SEMANAS_HISTORIAL_ACTUAL = 2;

// Ocupación desde la que la demanda de un bloque es ALTA, y hasta la que es BAJA.
export const UMBRAL_DEMANDA_ALTA = 0.7;
export const UMBRAL_DEMANDA_BAJA = 0.25;

// Promedio de ambos historiales para el ajuste fuerte: +10 % en vez de +5 %, y −12.5 % en vez de −5 %.
export const OCUPACION_MUY_ALTA = 0.85;
export const OCUPACION_MUY_BAJA = 0.15;

// Ajustes por demanda (decimales).
export const AJUSTE_ALZA_FUERTE = 0.1;
export const AJUSTE_ALZA_SUAVE = 0.05;
export const AJUSTE_BAJA_FUERTE = -0.125; // 40 × 0.875 = 35: una mañana muy vacía queda en el mínimo publicado
export const AJUSTE_BAJA_SUAVE = -0.05;

// Rangos publicados por franja (en dólares, antes del descuento de cliente frecuente).
// No son las franjas de las tarifas (Día, Hora pico, Noche): estas solo ponen los límites del precio.
export const RANGOS_PRECIO = [
  { franja: "MANANA", nombre: "Mañana", desde: "08:00", hasta: "11:59", minimo: 35, maximo: 40, maximoDemandaMuyAlta: 40 },
  { franja: "TARDE", nombre: "Tarde", desde: "12:00", hasta: "17:59", minimo: 38, maximo: 45, maximoDemandaMuyAlta: 45 },
  { franja: "NOCHE", nombre: "Noche", desde: "18:00", hasta: "23:59", minimo: 45, maximo: 50, maximoDemandaMuyAlta: 55 },
];
