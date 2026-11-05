import { NextResponse } from "next/server";
import { requerirPersonal } from "@/lib/auth";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { ROLES } from "@/lib/validaciones/usuario";
import { errorInterno, respuestaDenegada } from "@/lib/http";

// Lista de usuarios.
// - Con ?rol=CLIENTE: administrador o recepcionista; devuelve solo datos básicos
//   (para los desplegables de cliente de la calculadora y de las reservas).
// - Cualquier otra lista: solo administrador, con rol y fecha de creación.
export async function GET(request) {
  const permiso = await requerirPersonal();
  if (permiso.error) return respuestaDenegada(permiso);

  const rol = new URL(request.url).searchParams.get("rol");
  if (rol !== null && !ROLES.includes(rol)) {
    return NextResponse.json({ error: "El rol indicado no es válido" }, { status: 400 });
  }

  const soloClientes = rol === "CLIENTE";
  if (!soloClientes && permiso.usuario.rol !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "No tienes permiso para esta acción" }, { status: 403 });
  }

  const campos = soloClientes
    ? "id, nombre, apellido, correo"
    : "id, correo, nombre, apellido, rol, fechaCreacion";

  let consulta = crearClienteAdmin().from("usuarios").select(campos);
  if (rol) consulta = consulta.eq("rol", rol);
  const { data, error } = await consulta.order("apellido").order("nombre");

  if (error) return errorInterno(error, "No se pudieron cargar los usuarios");
  return NextResponse.json({ usuarios: data });
}
