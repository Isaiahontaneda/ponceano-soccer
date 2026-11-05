"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function PaginaLogin() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [contrasenia, setContrasenia] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setError("");
    setCargando(true);

    let respuesta;
    try {
      respuesta = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo, contrasenia }),
      });
    } catch {
      setCargando(false);
      setError("No se pudo conectar con el servidor. Revisa tu conexión.");
      return;
    }
    const datos = await respuesta.json().catch(() => ({}));
    setCargando(false);

    if (!respuesta.ok) {
      setError(datos.error || "No se pudo iniciar sesión");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="login">
      <div className="login__tarjeta">
        <Image
          className="login__logo"
          src="/logo.png"
          alt="Ponceano Soccer"
          width={453}
          height={441}
          priority
        />
        <h1>Ponceano Soccer</h1>
        <h2>Iniciar sesión</h2>
        <form onSubmit={enviar} className="formulario">
          <label className="campo">
            Correo electrónico
            <input
              type="email"
              name="correo"
              autoComplete="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
            />
          </label>
          <label className="campo">
            Contraseña
            <input
              type="password"
              name="contrasenia"
              autoComplete="current-password"
              value={contrasenia}
              onChange={(e) => setContrasenia(e.target.value)}
              required
            />
          </label>
          {error && (
            <p role="alert" className="alerta alerta--error">
              {error}
            </p>
          )}
          <button type="submit" className="boton" disabled={cargando}>
            {cargando ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </main>
  );
}
