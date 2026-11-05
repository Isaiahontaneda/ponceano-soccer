import { NextResponse } from "next/server";
import { requerirRol } from "@/lib/auth";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { calcularPrecioReserva } from "@/lib/core/servicioPrecio";
import { ErrorSinTarifaBase } from "@/lib/core/calcularPrecio";
import { fechaValida, horaValida, recortarHora } from "@/lib/fechas";
import { verificarOrigen } from "@/lib/seguridad";
import {
  errorInterno,
  leerCuerpoJson,
  leerUuid,
  respuestaDenegada,
  solicitudInvalida,
} from "@/lib/http";

// Calcula el precio de una reserva con el Core (cualquier rol con sesión válida).
// Entrada: { fecha, horaInicio, clienteId? }. El navegador nunca envía el precio.
export async function POST(request) {
  const bloqueo = verificarOrigen(request);
  if (bloqueo) return bloqueo;

  const permiso = await requerirRol(["ADMINISTRADOR", "RECEPCIONISTA", "CLIENTE"]);
  if (permiso.error) return respuestaDenegada(permiso);
  const { usuario } = permiso;

  const cuerpo = await leerCuerpoJson(request);
  if (!cuerpo) return solicitudInvalida();

  const errores = [];
  if (!fechaValida(cuerpo.fecha)) errores.push("La fecha es obligatoria y debe ser válida (AAAA-MM-DD).");
  if (!horaValida(cuerpo.horaInicio)) errores.push("La hora es obligatoria y debe tener formato HH:MM.");

  // Un CLIENTE solo puede calcular para sí mismo: se ignora cualquier clienteId que mande.
  // El personal puede indicar un cliente (o ninguno).
  let clienteId = null;
  if (usuario.rol === "CLIENTE") {
    clienteId = usuario.id;
  } else if (cuerpo.clienteId !== undefined && cuerpo.clienteId !== null && cuerpo.clienteId !== "") {
    clienteId = leerUuid(cuerpo.clienteId);
    if (!clienteId) errores.push("El cliente indicado no es válido.");
  }

  if (errores.length > 0) return NextResponse.json({ errores }, { status: 422 });

  const admin = crearClienteAdmin();
  if (clienteId && usuario.rol !== "CLIENTE") {
    const { data: cliente, error } = await admin
      .from("usuarios")
      .select("id")
      .eq("id", clienteId)
      .eq("rol", "CLIENTE")
      .maybeSingle();
    if (error) return errorInterno(error, "No se pudo calcular el precio");
    if (!cliente) {
      return NextResponse.json({ errores: ["El cliente indicado no existe."] }, { status: 422 });
    }
  }

  try {
    const resultado = await calcularPrecioReserva({
      fecha: cuerpo.fecha,
      horaInicio: recortarHora(cuerpo.horaInicio),
      clienteId,
    });
    return NextResponse.json(resultado);
  } catch (error) {
    if (error instanceof ErrorSinTarifaBase) {
      return NextResponse.json(
        { error: "No hay una tarifa base configurada. Pide al administrador que la cree." },
        { status: 409 }
      );
    }
    return errorInterno(error, "No se pudo calcular el precio");
  }
}
