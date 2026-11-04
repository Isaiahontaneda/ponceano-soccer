import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function POST(request) {
  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const correo = typeof cuerpo.correo === "string" ? cuerpo.correo.trim() : "";
  const contrasenia =
    typeof cuerpo.contrasenia === "string" ? cuerpo.contrasenia : "";

  if (!correo || !contrasenia) {
    return NextResponse.json(
      { error: "Correo y contraseña son obligatorios" },
      { status: 400 }
    );
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: correo,
    password: contrasenia,
  });

  if (error) {
    // Mensaje genérico a propósito: no revela si el correo existe o no.
    return NextResponse.json(
      { error: "Correo o contraseña incorrectos" },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true });
}