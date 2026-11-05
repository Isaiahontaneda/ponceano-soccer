import { NextResponse } from "next/server";
import { requerirPersonal } from "@/lib/auth";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { validarCambioEstado } from "@/lib/validaciones/reserva";
import { verificarOrigen } from "@/lib/seguridad";
import {
  errorInterno,
  leerCuerpoJson,
  leerIdNumerico,
  respuestaDenegada,
  solicitudInvalida,
} from "@/lib/http";

// Cambiar el estado de una reserva (administrador o recepcionista).
// Solo transiciones válidas: PENDIENTE -> CONFIRMADA | CANCELADA y CONFIRMADA -> CANCELADA.
export async function PATCH(request, { params }) {
  const bloqueo = verificarOrigen(request);
  if (bloqueo) return bloqueo;

  const permiso = await requerirPersonal();
  if (permiso.error) return respuestaDenegada(permiso);

  const id = leerIdNumerico((await params).id);
  if (!id) return NextResponse.json({ error: "Id inválido" }, { status: 400 });

  const cuerpo = await leerCuerpoJson(request);
  if (!cuerpo) return solicitudInvalida();

  const admin = crearClienteAdmin();
  const { data: actual, error } = await admin
    .from("reservas")
    .select("id, estado")
    .eq("id", id)
    .maybeSingle();
  if (error) return errorInterno(error, "No se pudo cambiar el estado de la reserva");
  if (!actual) return NextResponse.json({ error: "La reserva no existe" }, { status: 404 });

  const cambio = validarCambioEstado(cuerpo, actual.estado);
  if (cambio.error) {
    const cuerpoError =
      cambio.estadoHttp === 422 ? { errores: [cambio.error] } : { error: cambio.error };
    return NextResponse.json(cuerpoError, { status: cambio.estadoHttp });
  }

  // La condición sobre el estado anterior evita pisar un cambio simultáneo de otra persona.
  const { data: editada, error: errorUpdate } = await admin
    .from("reservas")
    .update({ estado: cambio.estado, fechaActualizacion: new Date().toISOString() })
    .eq("id", id)
    .eq("estado", actual.estado)
    .select("id, codigo, fecha, horaInicio, estado, precio, clienteId")
    .maybeSingle();
  if (errorUpdate) return errorInterno(errorUpdate, "No se pudo cambiar el estado de la reserva");
  if (!editada) {
    return NextResponse.json(
      { error: "La reserva cambió mientras la editabas. Recarga la lista e inténtalo de nuevo." },
      { status: 409 }
    );
  }
  return NextResponse.json({ reserva: editada });
}
