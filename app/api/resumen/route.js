import { NextResponse } from "next/server";
import { requerirPersonal } from "@/lib/auth";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { cargarTarifasConTipo } from "@/lib/modelo/tarifas";
import { comparacionesActivas } from "@/lib/validaciones/tarifa";
import { hoyEnNegocio } from "@/lib/fechas";
import { errorInterno, respuestaDenegada } from "@/lib/http";

// Resumen para la portada del panel (administrador o recepcionista).
// Todo sale de la base de datos. Los datos de tarifas solo se envían al administrador.
export async function GET() {
  const permiso = await requerirPersonal();
  if (permiso.error) return respuestaDenegada(permiso);

  const admin = crearClienteAdmin();
  const hoy = hoyEnNegocio().fecha;

  try {
    // Reservas de hoy (las canceladas no cuentan: liberan el horario).
    const { count, error } = await admin
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .eq("fecha", hoy)
      .neq("estado", "CANCELADA");
    if (error) throw error;

    const resumen = { rol: permiso.usuario.rol, fecha: hoy, reservasHoy: count ?? 0 };

    if (permiso.usuario.rol === "ADMINISTRADOR") {
      const { tarifas } = await cargarTarifasConTipo(admin);
      const estado = comparacionesActivas(tarifas);
      resumen.totalTarifas = tarifas.length;
      resumen.comparacionesActivas = estado.total;
      resumen.hayBase = estado.hayBase;
    }

    return NextResponse.json(resumen);
  } catch (error) {
    return errorInterno(error, "No se pudo cargar el resumen");
  }
}
