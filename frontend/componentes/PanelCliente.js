"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { llamarApi } from "@/frontend/utilidades/api";

// Marco de la página del cliente: logo, nombre del usuario y botón de cerrar sesión.
// Es una versión reducida de PanelAdmin, sin menú.
export default function PanelCliente({ children }) {
  const router = useRouter();
  const [usuario, setUsuario] = useState(null);
  const [cerrando, setCerrando] = useState(false);

  useEffect(() => {
    // Carga inicial del usuario desde la API: uso legítimo de un efecto.
    llamarApi("/api/auth/yo").then((resultado) => {
      if (resultado.estado === 401) {
        router.push("/login");
      } else if (resultado.ok && resultado.datos.usuario.rol !== "CLIENTE") {
        router.push("/admin"); // el personal usa el panel de administración
      } else if (resultado.ok) {
        setUsuario(resultado.datos.usuario);
      }
    });
  }, [router]);

  async function cerrarSesion() {
    setCerrando(true);
    await llamarApi("/api/auth/logout", { metodo: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <a href="#contenido" className="saltar">
        Saltar al contenido
      </a>
      <header className="encabezado">
        <div className="encabezado__interior">
          <span className="encabezado__marca">
            <Image src="/logo.png" alt="Ponceano Soccer" width={453} height={441} priority />
          </span>

          {usuario && (
            <div className="encabezado__usuario">
              <strong>
                {usuario.nombre} {usuario.apellido}
              </strong>
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
        {usuario ? children : <p className="cargando">Cargando…</p>}
      </main>
    </>
  );
}
