"use client";

import { useState } from "react";
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

    const respuesta = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo, contrasenia }),
    });
    const datos = await respuesta.json().catch(() => ({}));
    setCargando(false);

    if (!respuesta.ok) {
      setError(datos.error || "No se pudo iniciar sesión");
      return;
    }

    router.push("/admin/tarifas");
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 360, margin: "80px auto", padding: 16 }}>
      <h1>Ponceano Soccer</h1>
      <h2>Iniciar sesión</h2>
      <form onSubmit={enviar}>
        <label>
          Correo
          <input
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            required
            style={{ display: "block", width: "100%", marginBottom: 12 }}
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={contrasenia}
            onChange={(e) => setContrasenia(e.target.value)}
            required
            style={{ display: "block", width: "100%", marginBottom: 12 }}
          />
        </label>
        {error && <p role="alert" style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={cargando}>
          {cargando ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </main>
  );
}