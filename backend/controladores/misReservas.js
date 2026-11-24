import { NextResponse } from "next/server";
import { requerirRol } from "@/backend/auth";
import { crearClienteAdmin } from "@/backend/supabase/admin";
import { crearReserva } from "@/backend/modelo/reservas";
import { MAX_PENDIENTES_POR_CLIENTE } from "@/backend/configuracion";
import { hoyEnNegocio } from "@/backend/fechas";
import { validarCancelacionCliente, validarNuevaReserva } from "@/backend/validaciones/reserva";
import { verificarOrigen } from "@/backend/seguridad";
import {
  errorInterno,
  leerCuerpoJson,
  leerIdNumerico,
  respuestaDenegada,
  solicitudInvalida,
} from "@/backend/http";

// Rutas del cliente. El dueño de las reservas es SIEMPRE el usuario de la sesión:
// se ignora cualquier clienteId, precio, estado o rol que mande el navegador.
const CAMPOS = "id, codigo, fecha, horaInicio, estado, precio";

// Las reservas del cliente de la sesión, de la más reciente a la más antigua.
export async function GET() {
  const permiso = await requerirRol(["CLIENTE"]);
  if (permiso.error) return respuestaDenegada(permiso);

  const { data, error } = await crearClienteAdmin()
    .from("reservas")
    .select(CAMPOS)
    .eq("clienteId", permiso.usuario.id)
    .order("fecha", { ascending: false })
    .order("horaInicio", { ascending: false })
    .limit(100);
  if (error) return errorInterno(error, "No se pudieron cargar tus reservas");

  return NextResponse.json({ reservas: data });
}

// El cliente crea una reserva para sí mismo. Entrada: { fecha, horaInicio }.
export async function POST(request) {
  const bloqueo = verificarOrigen(request);
  if (bloqueo) return bloqueo;

  const permiso = await requerirRol(["CLIENTE"]);
  if (permiso.error) return respuestaDenegada(permiso);
  const { usuario } = permiso;

  const cuerpo = await leerCuerpoJson(request);
  if (!cuerpo) return solicitudInvalida();

  const hoy = hoyEnNegocio();
  const { errores, datos } = validarNuevaReserva(
    { fecha: cuerpo.fecha, horaInicio: cuerpo.horaInicio, clienteId: usuario.id },
    hoy
  );
  if (errores.length > 0) return NextResponse.json({ errores }, { status: 422 });

  const admin = crearClienteAdmin();

  // Tope de reservas pendientes vigentes (de hoy en adelante).
  const { count, error } = await admin
    .from("reservas")
    .select("id", { count: "exact", head: true })
    .eq("clienteId", usuario.id)
    .eq("estado", "PENDIENTE")
    .gte("fecha", hoy.fecha);
  if (error) return errorInterno(error, "No se pudo crear la reserva");
  if ((count ?? 0) >= MAX_PENDIENTES_POR_CLIENTE) {
    return NextResponse.json(
      {
        error: `Ya tienes ${MAX_PENDIENTES_POR_CLIENTE} reservas pendientes. Espera a que el local las confirme o cancela una.`,
      },
      { status: 409 }
    );
  }

  const resultado = await crearReserva(admin, datos);
  return NextResponse.json(resultado.cuerpo, { status: resultado.estado });
}

// El cliente cancela una reserva suya que sigue pendiente. Entrada: { estado: "CANCELADA" }.
export async function PATCH(request, { params }) {
  const bloqueo = verificarOrigen(request);
  if (bloqueo) return bloqueo;

  const permiso = await requerirRol(["CLIENTE"]);
  if (permiso.error) return respuestaDenegada(permiso);
  const { usuario } = permiso;

  const id = leerIdNumerico((await params).id);
  if (!id) return NextResponse.json({ error: "Id inválido" }, { status: 400 });

  const cuerpo = await leerCuerpoJson(request);
  if (!cuerpo) return solicitudInvalida();
  if (cuerpo.estado !== "CANCELADA") {
    return NextResponse.json({ errores: ["Solo puedes cancelar la reserva."] }, { status: 422 });
  }

  const admin = crearClienteAdmin();
  const { data: reserva, error } = await admin
    .from("reservas")
    .select("id, clienteId, fecha, horaInicio, estado")
    .eq("id", id)
    .maybeSingle();
  if (error) return errorInterno(error, "No se pudo cancelar la reserva");

  const permitido = validarCancelacionCliente(reserva, usuario.id, hoyEnNegocio());
  if (permitido.error) {
    return NextResponse.json({ error: permitido.error }, { status: permitido.estadoHttp });
  }

  // La condición sobre el estado evita pisar un cambio simultáneo del personal.
  const { data: cancelada, error: errorUpdate } = await admin
    .from("reservas")
    .update({ estado: "CANCELADA", fechaActualizacion: new Date().toISOString() })
    .eq("id", id)
    .eq("clienteId", usuario.id)
    .eq("estado", "PENDIENTE")
    .select(CAMPOS)
    .maybeSingle();
  if (errorUpdate) return errorInterno(errorUpdate, "No se pudo cancelar la reserva");
  if (!cancelada) {
    return NextResponse.json({ error: "La reserva cambió. Recarga la página." }, { status: 409 });
  }
  return NextResponse.json({ reserva: cancelada });
}
