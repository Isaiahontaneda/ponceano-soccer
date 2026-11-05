import "server-only";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { cargarTarifasConTipo } from "@/lib/modelo/tarifas";
import { DIAS_HISTORIAL_CLIENTE } from "@/lib/configuracion";
import { sumarDias } from "@/lib/fechas";
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

// Servicio de precio (servidor): carga tarifas con la secret key, cuenta el historial
// del cliente y llama al Core. Se reutiliza al calcular y al crear reservas.
// Lanza ErrorSinTarifaBase si no hay tarifa base, o el error de la base de datos.
export async function calcularPrecioReserva({ fecha, horaInicio, clienteId = null }) {
  const admin = crearClienteAdmin();

  const [{ tarifas }, reservasConfirmadas30Dias] = await Promise.all([
    cargarTarifasConTipo(admin),
    contarReservasConfirmadas(admin, clienteId, fecha),
  ]);

  const resultado = calcularPrecio({ fecha, horaInicio, reservasConfirmadas30Dias }, tarifas);
  return { ...resultado, reservasConfirmadas30Dias };
}
