import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function proxy(request) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          respuesta = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Esta llamada es la que renueva la sesión. No la quites.
  const { data } = await supabase.auth.getClaims();

  const ruta = request.nextUrl.pathname;
  const hayYSesion = Boolean(data?.claims);

  // Comodidad: sin sesión, las páginas de /admin mandan al login, y "/" manda
  // al panel (con sesión) o al login (sin sesión).
  // La protección real está en cada ruta de la API (requerirRol / requerirAdmin).
  if ((!hayYSesion && ruta.startsWith("/admin")) || ruta === "/") {
    const destino = request.nextUrl.clone();
    destino.pathname = hayYSesion ? "/admin" : "/login";
    destino.search = "";
    const redireccion = NextResponse.redirect(destino);
    // Conserva las cookies de sesión renovadas, si las hubo.
    respuesta.cookies.getAll().forEach((c) => redireccion.cookies.set(c));
    return redireccion;
  }

  return respuesta;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};