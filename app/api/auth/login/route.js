import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/auth";
import { verificarOrigen } from "@/lib/seguridad";
import { leerCuerpoJson, solicitudInvalida } from "@/lib/http";

export async function POST(request) {
  const bloqueo = verificarOrigen(request);
  if (bloqueo) return bloqueo;

  const cuerpo = await leerCuerpoJson(request);
  if (!cuerpo) return solicitudInvalida();

  const correo = typeof cuerpo.correo === "string" ? cuerpo.correo.trim().toLowerCase() : "";
  const contrasenia = typeof cuerpo.contrasenia === "string" ? cuerpo.contrasenia : "";

  if (!correo || !contrasenia || correo.length > 254 || contrasenia.length > 200) {
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

  // La cuenta debe existir también en la tabla "usuarios" (de ahí sale el rol).
  // Si no, se cierra la sesión recién creada para no dejarla a medias.
  const perfil = await obtenerUsuarioActual();
  if (!perfil) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "Tu cuenta no está registrada en el sistema. Contacta al administrador." },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true });
}
