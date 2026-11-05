"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { llamarApi, mensajesDeError } from "@/frontend/utilidades/api";
import Alertas from "@/frontend/componentes/Alertas";

// Módulos del panel y qué roles pueden verlos.
const MODULOS = [
  {
    href: "/admin/tarifas",
    titulo: "Tarifas",
    texto: "Reglas que alimentan el cálculo del precio.",
    roles: ["ADMINISTRADOR"],
  },
  {
    href: "/admin/calculadora",
    titulo: "Calculadora",
    texto: "Simula un precio y revisa su desglose.",
    roles: ["ADMINISTRADOR", "RECEPCIONISTA"],
  },
  {
    href: "/admin/usuarios",
    titulo: "Usuarios",
    texto: "Cuentas de personal y clientes, y sus roles.",
    roles: ["ADMINISTRADOR"],
  },
  {
    href: "/admin/reservas",
    titulo: "Reservas",
    texto: "Agenda del día, nuevas reservas y estados.",
    roles: ["ADMINISTRADOR", "RECEPCIONISTA"],
  },
];

export default function PortadaAdmin() {
  const router = useRouter();
  const [resumen, setResumen] = useState(null);
  const [errores, setErrores] = useState([]);

  useEffect(() => {
    // Carga inicial del resumen desde la API al abrir la portada: uso legítimo de un efecto.
    // (setResumen se llama después de la respuesta, no de forma síncrona en el efecto.)
    llamarApi("/api/resumen").then((res) => {
      if (res.estado === 401) {
        router.push("/login");
        return;
      }
      if (res.ok) setResumen(res.datos);
      else if (res.estado !== 403) setErrores(mensajesDeError(res.datos, "No se pudo cargar el resumen."));
    });
  }, [router]);

  const modulos = resumen ? MODULOS.filter((m) => m.roles.includes(resumen.rol)) : [];

  return (
    <div className="pagina">
      <h1>Panel de administración</h1>
      <p className="pagina__intro">Ponceano Soccer</p>

      <Alertas errores={errores} />

      {resumen && resumen.hayBase === false && (
        <p role="alert" className="alerta alerta--aviso">
          Falta la tarifa base: sin ella no se pueden calcular precios ni crear reservas.
        </p>
      )}

      {resumen && (
        <section className="resumen" aria-label="Resumen">
          <p>
            Reservas para hoy: <strong>{resumen.reservasHoy}</strong>
          </p>
          {resumen.totalTarifas !== undefined && (
            <p>
              Tarifas registradas: <strong>{resumen.totalTarifas}</strong>
            </p>
          )}
        </section>
      )}

      <nav aria-label="Módulos" className="modulos">
        {modulos.map((m) => (
          <Link key={m.href} href={m.href} className="modulo">
            <h2>{m.titulo}</h2>
            <p>{m.texto}</p>
          </Link>
        ))}
      </nav>
    </div>
  );
}
