import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { verificarOrigen } from "@/lib/seguridad";

export async function POST(request) {
  const bloqueo = verificarOrigen(request);
  if (bloqueo) return bloqueo;

  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
