const esProduccion = process.env.NODE_ENV === "production";

// Política de seguridad de contenido (CSP), conservadora:
// - Todo (scripts, estilos, imágenes, fuentes, conexiones) solo desde nuestro propio sitio.
//   El navegador nunca habla directo con Supabase: todo pasa por nuestras rutas /api.
// - 'unsafe-inline' en scripts y estilos es necesario porque Next.js inserta scripts en línea
//   para hidratar las páginas y React usa estilos en línea. Una CSP más estricta (con "nonce")
//   exigiría renderizado dinámico de todas las páginas y desactivar el prerenderizado de
//   Cache Components, así que se omite a propósito.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const cabecerasSeguridad = [
  // La CSP solo se envía en producción: en desarrollo Next usa recursos (HMR, overlay de errores)
  // que no se han probado con una política restrictiva.
  ...(esProduccion ? [{ key: "Content-Security-Policy", value: csp }] : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Solo tiene efecto sobre HTTPS (en http://localhost el navegador lo ignora).
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Oculta el indicador de Next.js que aparece abajo a la izquierda en desarrollo.
  devIndicators: false,
  // Desactiva la validación automática de "navegación instantánea" que muestra el aviso
  // "1 Insight" en desarrollo (solo valida las páginas que lo pidan de forma explícita).
  experimental: {
    instantInsights: { validationLevel: "manual-warning" },
  },

  async headers() {
    return [
      { source: "/:path*", headers: cabecerasSeguridad },
      // Las respuestas de la API llevan datos de sesión o de negocio: que nadie las guarde en caché.
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
