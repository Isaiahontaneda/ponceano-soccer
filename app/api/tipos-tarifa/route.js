import { NextResponse } from "next/server";
import { requerirAdmin } from "@/lib/auth";
import { crearClienteAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const permiso = await requerirAdmin();
  if (permiso.error) {
    return NextResponse.json({ error: permiso.error }, { status: permiso.estado });
  }

  const admin = crearClienteAdmin();
  const { data, error } = await admin
    .from("tiposTarifa")
    .select("id, codigo, nombre")
    .order("id");

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudieron cargar los tipos" }, { status: 500 });
  }
  return NextResponse.json({ tipos: data });
}