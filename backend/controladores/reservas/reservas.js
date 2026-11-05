import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { requerirPersonal } from "@/backend/auth";
import { crearClienteAdmin } from "@/backend/supabase/admin";
import { calcularPrecioReserva } from "@/backend/core/servicioPrecio";
import { ErrorSinTarifaBase } from "@/backend/core/calcularPrecio";
import { fechaValida, hoyEnNegocio } from "@/backend/fechas";
import {
  ALFABETO_CODIGO,
  construirCodigo,
  validarNuevaReserva,
} from "@/backend/validaciones/reserva";
import { verificarOrigen } from "@/backend/seguridad";
import { errorInterno, leerCuerpoJson, respuestaDenegada, solicitudInvalida } from "@/backend/http";

const CAMPOS = "id, codigo, fecha, horaInicio, estado, precio, clienteId";
const INTENTOS_CODIGO = 5;

function sufijoAleatorio() {
  let texto = "";
  for (let i = 0; i < 4; i++) texto += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)];
  return texto;
}

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
  let consulta = admin.from("reservas").select(CAMPOS);
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

  const admin = crearClienteAdmin();

  // El cliente debe existir y tener rol CLIENTE.
  const { data: cliente, error: errorCliente } = await admin
    .from("usuarios")
    .select("id")
    .eq("id", datos.clienteId)
    .eq("rol", "CLIENTE")
    .maybeSingle();
  if (errorCliente) return errorInterno(errorCliente, "No se pudo crear la reserva");
  if (!cliente) {
    return NextResponse.json({ errores: ["El cliente elegido no existe."] }, { status: 422 });
  }

  // Comprobación amable de horario libre (la garantía real es el índice único de la base).
  const { data: ocupada, error: errorHorario } = await admin
    .from("reservas")
    .select("id")
    .eq("fecha", datos.fecha)
    .eq("horaInicio", datos.horaInicio)
    .neq("estado", "CANCELADA")
    .maybeSingle();
  if (errorHorario) return errorInterno(errorHorario, "No se pudo crear la reserva");
  if (ocupada) {
    return NextResponse.json({ error: "Ese horario ya está reservado" }, { status: 409 });
  }

  // Precio calculado por el Core en el servidor.
  let precio;
  try {
    ({ precio } = await calcularPrecioReserva(datos));
  } catch (error) {
    if (error instanceof ErrorSinTarifaBase) {
      return NextResponse.json(
        { error: "No hay una tarifa base configurada. Créala antes de registrar reservas." },
        { status: 409 }
      );
    }
    return errorInterno(error, "No se pudo calcular el precio de la reserva");
  }

  // Se reintenta con otro código si el generado ya existe (columna "codigo" única).
  for (let intento = 0; intento < INTENTOS_CODIGO; intento++) {
    const { data: creada, error } = await admin
      .from("reservas")
      .insert({
        codigo: construirCodigo(datos.fecha, datos.horaInicio, sufijoAleatorio()),
        fecha: datos.fecha,
        horaInicio: datos.horaInicio,
        estado: "PENDIENTE",
        precio,
        clienteId: datos.clienteId,
      })
      .select(CAMPOS)
      .single();

    if (!error) return NextResponse.json({ reserva: creada }, { status: 201 });

    if (error.code === "23505") {
      // Índice único del horario: alguien reservó justo ahora.
      if (String(error.message).includes("reservas_horario_unico")) {
        return NextResponse.json({ error: "Ese horario ya está reservado" }, { status: 409 });
      }
      continue; // choque de código: se prueba con otro
    }
    return errorInterno(error, "No se pudo crear la reserva");
  }

  return errorInterno(new Error("No se pudo generar un código único"), "No se pudo crear la reserva");
}
