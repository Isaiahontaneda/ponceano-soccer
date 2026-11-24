// Datos compartidos por las pruebas (este archivo no es una prueba: node --test no lo ejecuta).

// Tarifas reales del negocio.
export const TARIFAS = [
  { tipoCodigo: "BASE", nombre: "Base", valor: 40 },
  { tipoCodigo: "FRANJA_HORARIA", nombre: "Día", valor: 0, horaInicio: "08:00", horaFin: "17:59" },
  { tipoCodigo: "FRANJA_HORARIA", nombre: "Hora pico", valor: 0.25, horaInicio: "18:00", horaFin: "21:59" },
  { tipoCodigo: "FRANJA_HORARIA", nombre: "Noche", valor: 0.125, horaInicio: "22:00", horaFin: "23:59" },
  { tipoCodigo: "DIA_SEMANA", nombre: "Sábado", valor: 0.1, diaSemana: 6 },
  { tipoCodigo: "FECHA_ESPECIAL", nombre: "Feriado", valor: 0.2, fecha: "2026-11-02" },
  { tipoCodigo: "CLIENTE_FRECUENTE", nombre: "Cliente frecuente", valor: 0.1, minReservas: 3 },
];

// Los dos historiales que prepara el servicio, con las ocupaciones indicadas.
export function historiales(antiguo, actual) {
  return [
    { clave: "ANTIGUO", nombre: "Historial 3 años (misma temporada)", ocupacion: antiguo, muestras: 78 },
    { clave: "ACTUAL", nombre: "Últimas semanas", ocupacion: actual, muestras: 3 },
  ];
}
