import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/backend/supabase/server";
import { verificarOrigen } from "@/backend/seguridad";

export async function POST(request) {
  const bloqueo = verificarOrigen(request);
  if (bloqueo) return bloqueo;

  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
