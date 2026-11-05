import "server-only";
import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";

// Devuelve el perfil del usuario logueado (con su rol real) o null.
// El rol SIEMPRE se lee de la tabla "usuarios" con el id de la sesión, nunca del navegador.
// Si el usuario existe en Auth pero no en "usuarios", se trata como no autenticado.
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
    .maybeSingle();

  if (errorPerfil) {
    console.error("No se pudo leer el perfil del usuario:", errorPerfil.message);
    return null;
  }
  return perfil ?? null;
}

// Úsalo al inicio de cualquier ruta que exija uno de ciertos roles.
// Devuelve { usuario } si pasa, o { error, estado } (401 sin sesión, 403 sin rol).
export async function requerirRol(roles) {
  const usuario = await obtenerUsuarioActual();

  if (!usuario) {
    return { error: "No autenticado", estado: 401 };
  }
  if (!roles.includes(usuario.rol)) {
    return { error: "No tienes permiso para esta acción", estado: 403 };
  }
  return { usuario };
}

// Rutas que solo puede tocar un administrador.
export function requerirAdmin() {
  return requerirRol(["ADMINISTRADOR"]);
}

// Rutas de operación diaria: administrador o recepcionista.
export function requerirPersonal() {
  return requerirRol(["ADMINISTRADOR", "RECEPCIONISTA"]);
}
