import { NextResponse } from "next/server";
import { requerirRol } from "@/backend/auth";
import { crearClienteAdmin } from "@/backend/supabase/admin";
import { cargarReglasCliente, cargarReservasCliente } from "@/backend/core/servicioPrecio";
import { contarReservasCliente, resumirBeneficios } from "@/backend/core/beneficiosCliente";
import { hoyEnNegocio } from "@/backend/fechas";
import { errorInterno, respuestaDenegada } from "@/backend/http";

// Beneficios del cliente de la sesión (nunca de un id enviado por el navegador):
// { sellos: { acumulados, necesarios, faltan, descuento } | null, reglas: [{ nombre, descuento, descripcion }] }.
// Solo reglas activas y vigentes hoy; nunca ocupaciones ni datos del historial.
export async function GET() {
  const permiso = await requerirRol(["CLIENTE"]);
  if (permiso.error) return respuestaDenegada(permiso);

  const admin = crearClienteAdmin();
  try {
    const [reglas, reservas] = await Promise.all([
      cargarReglasCliente(admin),
      cargarReservasCliente(admin, permiso.usuario.id),
    ]);
    const idsSello = reglas.filter((r) => r.tipoCodigo === "TARJETA_SELLOS").map((r) => r.id);
    const datos = contarReservasCliente(reservas, idsSello);
    return NextResponse.json(resumirBeneficios(reglas, hoyEnNegocio().fecha, datos));
  } catch (error) {
    return errorInterno(error, "No se pudieron cargar tus beneficios");
  }
}
