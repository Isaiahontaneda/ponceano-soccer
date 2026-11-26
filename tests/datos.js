// Datos compartidos por las pruebas (este archivo no es una prueba: node --test no lo ejecuta).

// Tarifas reales del negocio (sin cliente frecuente: ahora es una regla del cliente).
export const TARIFAS = [
  { tipoCodigo: "BASE", nombre: "Base", valor: 40 },
  { tipoCodigo: "FRANJA_HORARIA", nombre: "Día", valor: 0, horaInicio: "08:00", horaFin: "17:59" },
  { tipoCodigo: "FRANJA_HORARIA", nombre: "Hora pico", valor: 0.25, horaInicio: "18:00", horaFin: "21:59" },
  { tipoCodigo: "FRANJA_HORARIA", nombre: "Noche", valor: 0.125, horaInicio: "22:00", horaFin: "23:59" },
  { tipoCodigo: "DIA_SEMANA", nombre: "Sábado", valor: 0.1, diaSemana: 6 },
  { tipoCodigo: "FECHA_ESPECIAL", nombre: "Feriado", valor: 0.2, fecha: "2026-11-02" },
];

// Las 4 reglas iniciales del cliente (migración 003), activas y vigentes desde el 2026-11-01.
// El descuento llega de la base como texto (numeric), igual que aquí.
const VIGENCIA = { activa: true, vigenteDesde: "2026-11-01", vigenteHasta: null };
export const REGLAS_CLIENTE = [
  { id: 1, tipoCodigo: "TARJETA_SELLOS", nombre: "Tarjeta de sellos", descuento: "0.150", cadaReservas: 3, diasAnticipacion: null, ...VIGENCIA },
  { id: 2, tipoCodigo: "BIENVENIDA", nombre: "Bienvenida", descuento: "0.100", cadaReservas: null, diasAnticipacion: null, ...VIGENCIA },
  { id: 3, tipoCodigo: "RESERVA_ANTICIPADA", nombre: "Reserva anticipada", descuento: "0.050", cadaReservas: null, diasAnticipacion: 7, ...VIGENCIA },
  { id: 4, tipoCodigo: "HORARIO_VALLE", nombre: "Horario valle", descuento: "0.100", cadaReservas: null, diasAnticipacion: null, ...VIGENCIA },
];

// Datos de un cliente que ya tiene reservas, sin sellos ni anticipación (ningún beneficio por sí solo).
export function cliente({ reservasPrevias = 5, sellos = 0, dias = 0 } = {}) {
  return { reservasPrevias, confirmadasDesdeUltimoSello: sellos, diasAnticipacion: dias };
}

// Los dos historiales que prepara el servicio, con las ocupaciones indicadas.
export function historiales(antiguo, actual) {
  return [
    { clave: "ANTIGUO", nombre: "Historial 3 años (misma temporada)", ocupacion: antiguo, muestras: 78 },
    { clave: "ACTUAL", nombre: "Últimas semanas", ocupacion: actual, muestras: 3 },
  ];
}
