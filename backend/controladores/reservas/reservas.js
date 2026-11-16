import { NextResponse } from "next/server";
import { requerirPersonal } from "@/backend/auth";
import { crearClienteAdmin } from "@/backend/supabase/admin";
import { CAMPOS_RESERVA, crearReserva } from "@/backend/modelo/reservas";
import { fechaValida, hoyEnNegocio } from "@/backend/fechas";
import { validarNuevaReserva } from "@/backend/validaciones/reserva";
import { verificarOrigen } from "@/backend/seguridad";
import { errorInterno, leerCuerpoJson, respuestaDenegada, solicitudInvalida } from "@/backend/http";

// Lista de reservas, con los datos básicos del cliente (administrador o recepcionista).
// ?fecha=AAAA-MM-DD filtra por día. Sin filtro devuelve las 200 más recientes.
export async function GET(request) {
  const permiso = await requerirPersonal();
  if (permiso.error) return respuestaDenegada(permiso);

  const fecha = new URL(request.url).searchParams.get("fecha");
  if (fecha !== null && !fechaValida(fecha)) {
    return NextResponse.json({ error: "La fecha debe tener formato AAAA-MM-DD" }, { status: 400 });
  }

  const admin = crearClienteAdmin();
  let consulta = admin.from("reservas").select(CAMPOS_RESERVA);
  consulta = fecha
    ? consulta.eq("fecha", fecha).order("horaInicio")
    : consulta.order("fecha", { ascending: false }).order("horaInicio").limit(200);

  const { data: reservas, error } = await consulta;
  if (error) return errorInterno(error, "No se pudieron cargar las reservas");

  // Datos del cliente de cada reserva (nombre, apellido, correo).
  const ids = [...new Set(reservas.map((r) => r.clienteId))];
  let clientes = [];
  if (ids.length > 0) {
    const respuesta = await admin
      .from("usuarios")
      .select("id, nombre, apellido, correo")
      .in("id", ids);
    if (respuesta.error) return errorInterno(respuesta.error, "No se pudieron cargar las reservas");
    clientes = respuesta.data;
  }

  const lista = reservas.map((r) => ({
    ...r,
    cliente: clientes.find((c) => c.id === r.clienteId) ?? null,
  }));
  return NextResponse.json({ reservas: lista });
}

// Crear reserva (administrador o recepcionista).
// El precio SIEMPRE lo calcula el servidor con el Core: se ignora cualquier "precio" o "estado" recibido.
export async function POST(request) {
  const bloqueo = verificarOrigen(request);
  if (bloqueo) return bloqueo;

  const permiso = await requerirPersonal();
  if (permiso.error) return respuestaDenegada(permiso);

  const cuerpo = await leerCuerpoJson(request);
  if (!cuerpo) return solicitudInvalida();

  const { errores, datos } = validarNuevaReserva(cuerpo, hoyEnNegocio());
  if (errores.length > 0) return NextResponse.json({ errores }, { status: 422 });

  const resultado = await crearReserva(crearClienteAdmin(), datos);
  return NextResponse.json(resultado.cuerpo, { status: resultado.estado });
}
