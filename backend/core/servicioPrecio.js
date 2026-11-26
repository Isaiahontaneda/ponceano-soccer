import "server-only";
import { crearClienteAdmin } from "@/backend/supabase/admin";
import { cargarTarifasConTipo } from "@/backend/modelo/tarifas";
import { cargarReglasConTipo } from "@/backend/modelo/reglasCliente";
import {
  INICIO_SISTEMA,
  MIN_SEMANAS_HISTORIAL_ACTUAL,
  SEMANAS_HISTORIAL_ACTUAL,
} from "@/backend/configuracion";
import { diaSemanaDe, diasEntre, hoyEnNegocio, sumarDias, temporadaDe } from "@/backend/fechas";
import { calcularPrecio } from "./calcularPrecio.js";
import { contarReservasCliente } from "./beneficiosCliente.js";

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

// Reglas del cliente con su "tipoCodigo". Sin filtrar por activa ni vigencia: eso lo decide el Core,
// para que la Calculadora pueda explicar por qué una regla no aplicó.
export async function cargarReglasCliente(admin) {
  const { reglas } = await cargarReglasConTipo(admin);
  return reglas;
}

// Reservas NO canceladas del cliente (en cualquier estado), con lo necesario para contar sellos.
export async function cargarReservasCliente(admin, clienteId) {
  const { data, error } = await admin
    .from("reservas")
    .select("estado, reglaClienteId, fechaCreacion")
    .eq("clienteId", clienteId)
    .neq("estado", "CANCELADA");
  if (error) throw error;
  return data;
}

// Datos del cliente para la etapa 4, o null si se calcula "Sin cliente".
// { reservasPrevias, confirmadasDesdeUltimoSello, diasAnticipacion }
export async function cargarDatosCliente(admin, clienteId, fecha, hoy) {
  if (!clienteId) return null;

  const [reservas, reglas] = await Promise.all([cargarReservasCliente(admin, clienteId), cargarReglasCliente(admin)]);
  const idsSello = reglas.filter((r) => r.tipoCodigo === "TARJETA_SELLOS").map((r) => r.id);
  return { ...contarReservasCliente(reservas, idsSello), diasAnticipacion: diasEntre(hoy, fecha) };
}

// Servicio de precio (servidor): carga tarifas, historiales de demanda, reglas del cliente y datos
// del cliente con la secret key, y llama al Core. Se reutiliza al calcular y al crear reservas.
// Lanza ErrorSinTarifaBase si no hay tarifa base, o el error de la base de datos.
export async function calcularPrecioReserva({ fecha, horaInicio, clienteId = null }) {
  const admin = crearClienteAdmin();
  const hoy = hoyEnNegocio().fecha; // "hoy" se decide aquí: el Core nunca lee la hora del servidor

  const [{ tarifas }, antiguo, actual, reglasCliente, cliente] = await Promise.all([
    cargarTarifasConTipo(admin),
    cargarHistorialAntiguo(admin, fecha, horaInicio),
    cargarHistorialActual(admin, fecha, horaInicio, hoy),
    cargarReglasCliente(admin),
    cargarDatosCliente(admin, clienteId, fecha, hoy),
  ]);

  const resultado = calcularPrecio({ fecha, horaInicio, historiales: [antiguo, actual], cliente }, tarifas, reglasCliente);
  // "cliente" (lo que se contó) se devuelve para que el personal lo vea en la Calculadora.
  return { ...resultado, cliente };
}
