import { NextResponse } from "next/server";
import { requerirAdmin } from "@/lib/auth";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { errorInterno, respuestaDenegada } from "@/lib/http";

export async function GET() {
  const permiso = await requerirAdmin();
  if (permiso.error) return respuestaDenegada(permiso);

  const admin = crearClienteAdmin();
  const { data, error } = await admin
    .from("tiposTarifa")
    .select("id, codigo, nombre")
    .order("id");

  if (error) return errorInterno(error, "No se pudieron cargar los tipos");
  return NextResponse.json({ tipos: data });
}
