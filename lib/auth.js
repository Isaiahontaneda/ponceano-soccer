import "server-only";
import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";

// Devuelve el perfil del usuario logueado (con su rol real) o null.
export async function obtenerUsuarioActual() {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;

  if (error || !id) return null;

  const admin = crearClienteAdmin();
  const { data: perfil, error: errorPerfil } = await admin
    .from("usuarios")
    .select("id, correo, nombre, apellido, rol")
    .eq("id", id)
    .single();

  if (errorPerfil || !perfil) return null;
  return perfil;
}

// Úsalo al inicio de cualquier ruta que solo pueda tocar un administrador.
export async function requerirAdmin() {
  const usuario = await obtenerUsuarioActual();

  if (!usuario) {
    return { error: "No autenticado", estado: 401 };
  }
  if (usuario.rol !== "ADMINISTRADOR") {
    return { error: "No tienes permiso para esta acción", estado: 403 };
  }
  return { usuario };
}