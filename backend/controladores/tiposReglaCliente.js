import { NextResponse } from "next/server";
import { requerirAdmin } from "@/backend/auth";
import { crearClienteAdmin } from "@/backend/supabase/admin";
import { errorInterno, respuestaDenegada } from "@/backend/http";

// Catálogo fijo de tipos de regla del cliente (solo administrador).
export async function GET() {
  const permiso = await requerirAdmin();
  if (permiso.error) return respuestaDenegada(permiso);

  const admin = crearClienteAdmin();
  const { data, error } = await admin
    .from("tiposReglaCliente")
    .select("id, codigo, nombre")
    .order("id");

  if (error) return errorInterno(error, "No se pudieron cargar los tipos");
  return NextResponse.json({ tipos: data });
}
