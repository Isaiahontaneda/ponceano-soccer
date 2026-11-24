import { NextResponse } from "next/server";
import { requerirRol } from "@/backend/auth";
import { RANGOS_PRECIO } from "@/backend/configuracion";
import { respuestaDenegada } from "@/backend/http";

// Rangos publicados por franja ("tarifas estándar"), para cualquier usuario con sesión.
// Salen de la misma configuración que usa el Core: un solo origen de verdad.
export async function GET() {
  const permiso = await requerirRol(["ADMINISTRADOR", "RECEPCIONISTA", "CLIENTE"]);
  if (permiso.error) return respuestaDenegada(permiso);

  return NextResponse.json({ rangos: RANGOS_PRECIO });
}
