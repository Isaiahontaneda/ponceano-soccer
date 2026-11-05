"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NOMBRE_ROL } from "@/frontend/utilidades/formato";
import { llamarApi } from "@/frontend/utilidades/api";

// Secciones del panel y qué roles las ven (null = todos los que tienen acceso).
const ENLACES = [
  { href: "/admin", texto: "Inicio", roles: null },
  { href: "/admin/tarifas", texto: "Tarifas", roles: ["ADMINISTRADOR"] },
  { href: "/admin/calculadora", texto: "Calculadora", roles: ["ADMINISTRADOR", "RECEPCIONISTA"] },
  { href: "/admin/usuarios", texto: "Usuarios", roles: ["ADMINISTRADOR"] },
  { href: "/admin/reservas", texto: "Reservas", roles: ["ADMINISTRADOR", "RECEPCIONISTA"] },
];

const ROLES_CON_ACCESO = ["ADMINISTRADOR", "RECEPCIONISTA"];

// Marco de todas las páginas de /admin: encabezado con logo, navegación,
// datos del usuario y botón de cerrar sesión. Es un componente cliente porque
// el usuario se consulta en el navegador (la página es estática por Cache Components).
export default function PanelAdmin({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [usuario, setUsuario] = useState(null);
  const [cerrando, setCerrando] = useState(false);

  useEffect(() => {
    // Carga inicial del usuario desde la API al abrir el panel: uso legítimo de un efecto.
    // (setUsuario se llama después de la respuesta, no de forma síncrona en el efecto.)
    llamarApi("/api/auth/yo").then((resultado) => {
      if (resultado.ok) {
        setUsuario(resultado.datos.usuario);
      } else if (resultado.estado === 401) {
        router.push("/login");
      }
    });
  }, [router]);

  const cerrarSesion = useCallback(async () => {
    setCerrando(true);
    await llamarApi("/api/auth/logout", { metodo: "POST" });
    router.push("/login");
    router.refresh();
  }, [router]);

  const tieneAcceso = usuario && ROLES_CON_ACCESO.includes(usuario.rol);
  const enlaces = usuario
    ? ENLACES.filter((e) => e.roles === null || e.roles.includes(usuario.rol))
    : [];

  function activo(href) {
    return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  }

  return (
    <>
      <a href="#contenido" className="saltar">
        Saltar al contenido
      </a>
      <header className="encabezado">
        <div className="encabezado__interior">
          <Link href="/admin" className="encabezado__marca">
            <Image src="/logo.png" alt="Ponceano Soccer" width={453} height={441} priority />
          </Link>

          {tieneAcceso && (
            <nav aria-label="Secciones del panel" className="nav">
              <ul className="nav__lista">
                {enlaces.map((e) => (
                  <li key={e.href}>
                    <Link href={e.href} aria-current={activo(e.href) ? "page" : undefined}>
                      {e.texto}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {usuario && (
            <div className="encabezado__usuario">
              <span>
                <strong>
                  {usuario.nombre} {usuario.apellido}
                </strong>
                <br />
                <span className="encabezado__rol">{NOMBRE_ROL[usuario.rol] ?? usuario.rol}</span>
              </span>
              <button
                type="button"
                className="boton boton--secundario boton--pequeno"
                onClick={cerrarSesion}
                disabled={cerrando}
              >
                {cerrando ? "Saliendo…" : "Cerrar sesión"}
              </button>
            </div>
          )}
        </div>
      </header>

      <main id="contenido" tabIndex={-1}>
        {!usuario && <p className="cargando">Cargando…</p>}
        {usuario && tieneAcceso && children}
        {usuario && !tieneAcceso && (
          <div className="pagina">
            <p role="alert" className="alerta alerta--error">
              Tu cuenta no tiene acceso al panel de administración. Si crees que es un error,
              contacta al administrador.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
