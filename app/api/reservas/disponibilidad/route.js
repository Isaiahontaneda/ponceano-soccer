import { NextResponse } from "next/server";
import { requerirPersonal } from "@/lib/auth";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { fechaValida, hoyEnNegocio } from "@/lib/fechas";
import { calcularDisponibilidad } from "@/lib/validaciones/reserva";
import { errorInterno, respuestaDenegada } from "@/lib/http";

// Bloques libres, ocupados y pasados de una fecha: GET /api/reservas/disponibilidad?fecha=AAAA-MM-DD
export async function GET(request) {
  const permiso = await requerirPersonal();
  if (permiso.error) return respuestaDenegada(permiso);

  const fecha = new URL(request.url).searchParams.get("fecha");
  if (!fechaValida(fecha)) {
    return NextResponse.json({ error: "La fecha es obligatoria (AAAA-MM-DD)" }, { status: 400 });
  }

  // Las reservas canceladas liberan el horario.
  const { data, error } = await crearClienteAdmin()
    .from("reservas")
    .select("horaInicio")
    .eq("fecha", fecha)
    .neq("estado", "CANCELADA");
  if (error) return errorInterno(error, "No se pudo consultar la disponibilidad");

  const { libres, ocupados, pasados } = calcularDisponibilidad(
    fecha,
    data.map((r) => r.horaInicio),
    hoyEnNegocio()
  );
  return NextResponse.json({ fecha, libres, ocupados, pasados });
}
