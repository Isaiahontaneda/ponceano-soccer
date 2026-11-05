import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente con la secret key: se salta el RLS. Solo se usa en el servidor,
// y siempre después de comprobar que el usuario es ADMINISTRADOR.
export function crearClienteAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}