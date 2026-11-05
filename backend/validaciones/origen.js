// Regla pura para decidir si una petición que modifica datos viene de nuestro propio sitio.
// (Defensa en profundidad contra CSRF; la cookie de sesión ya es SameSite=Lax.)

// origin: valor de la cabecera Origin (o null si no vino).
// host: cabecera Host de la petición (ej. "mi-sitio.vercel.app" o "localhost:3000").
// secFetchSite: cabecera Sec-Fetch-Site (o null).
export function origenPermitido({ origin, host, secFetchSite }) {
  if (!host) return false;

  if (origin) {
    try {
      // "Origin: null" (iframes aislados, etc.) no es parseable y se rechaza.
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  // Sin Origin (herramientas como curl, o navegadores muy antiguos):
  // se rechaza solo si el navegador declara que la petición es de otro sitio.
  if (secFetchSite === "cross-site" || secFetchSite === "same-site") return false;
  return true;
}
