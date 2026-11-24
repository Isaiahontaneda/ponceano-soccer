import "server-only";
import { crearClienteAdmin } from "@/backend/supabase/admin";
import { cargarTarifasConTipo } from "@/backend/modelo/tarifas";
import {
  DIAS_HISTORIAL_CLIENTE,
  INICIO_SISTEMA,
  MIN_SEMANAS_HISTORIAL_ACTUAL,
  SEMANAS_HISTORIAL_ACTUAL,
} from "@/backend/configuracion";
import { diaSemanaDe, hoyEnNegocio, sumarDias, temporadaDe } from "@/backend/fechas";
import { calcularPrecio } from "./calcularPrecio.js";

// Cuenta las reservas CONFIRMADAS del cliente en los 30 días anteriores a la fecha:
// fecha >= (fecha - 30 días)  y  fecha < fecha.
export async function contarReservasConfirmadas(admin, clienteId, fecha) {
  if (!clienteId) return 0;

  const { count, error } = await admin
    .from("reservas")
    .select("id", { count: "exact", head: true })
    .eq("clienteId", clienteId)
    .eq("estado", "CONFIRMADA")
    .gte("fecha", sumarDias(fecha, -DIAS_HISTORIAL_CLIENTE))
    .lt("fecha", fecha);

  if (error) throw error;
  return count ?? 0;
}

// Historial ANTIGUO: ocupación del mismo día de la semana, hora y temporada en los 3 años
// anteriores al sistema (vista "ocupacionHistorica").
export async function cargarHistorialAntiguo(admin, fecha, horaInicio) {
  const { data, error } = await admin
    .from("ocupacionHistorica")
    .select("ocupacion, diasPosibles")
    .eq("diaSemana", diaSemanaDe(fecha))
    .eq("horaInicio", horaInicio)
    .eq("temporada", temporadaDe(fecha))
    .maybeSingle();

  if (error) throw error;
  // Sin fila = nunca hubo una reserva en ese bloque y temporada: es ocupación 0, no falta de datos.
  return {
    clave: "ANTIGUO",
    nombre: "Historial 3 años (misma temporada)",
    ocupacion: data ? Number(data.ocupacion) : 0,
    muestras: data ? data.diasPosibles : null,
  };
}

// Historial ACTUAL: de las últimas 8 semanas (mismo día y hora), qué parte tuvo reserva CONFIRMADA.
// Solo cuentan las semanas que ya pasaron y en las que el sistema ya existía.
export async function cargarHistorialActual(admin, fecha, horaInicio, hoy) {
  const fechas = [];
  for (let n = 1; n <= SEMANAS_HISTORIAL_ACTUAL; n++) fechas.push(sumarDias(fecha, -7 * n));
  const fechasValidas = fechas.filter((f) => f >= INICIO_SISTEMA && f < hoy);

  const historial = { clave: "ACTUAL", nombre: "Últimas semanas", muestras: fechasValidas.length };
  if (fechasValidas.length < MIN_SEMANAS_HISTORIAL_ACTUAL) return { ...historial, ocupacion: null };

  const { count, error } = await admin
    .from("reservas")
    .select("id", { count: "exact", head: true })
    .in("fecha", fechasValidas)
    .eq("horaInicio", horaInicio)
    .eq("estado", "CONFIRMADA");

  if (error) throw error;
  return { ...historial, ocupacion: (count ?? 0) / fechasValidas.length };
}

// Servicio de precio (servidor): carga tarifas, historial del cliente y los dos historiales
// de demanda con la secret key, y llama al Core. Se reutiliza al calcular y al crear reservas.
// Lanza ErrorSinTarifaBase si no hay tarifa base, o el error de la base de datos.
export async function calcularPrecioReserva({ fecha, horaInicio, clienteId = null }) {
  const admin = crearClienteAdmin();
  const hoy = hoyEnNegocio().fecha; // "hoy" se decide aquí: el Core nunca lee la hora del servidor

  const [{ tarifas }, reservasConfirmadas30Dias, antiguo, actual] = await Promise.all([
    cargarTarifasConTipo(admin),
    contarReservasConfirmadas(admin, clienteId, fecha),
    cargarHistorialAntiguo(admin, fecha, horaInicio),
    cargarHistorialActual(admin, fecha, horaInicio, hoy),
  ]);

  const resultado = calcularPrecio(
    { fecha, horaInicio, reservasConfirmadas30Dias, historiales: [antiguo, actual] },
    tarifas
  );
  return { ...resultado, reservasConfirmadas30Dias };
}
