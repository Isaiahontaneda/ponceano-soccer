"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { bloquesHorarios } from "@/backend/configuracion";
import { hoyEnNegocio } from "@/backend/fechas";
import { dolares, fechaLegible, hora, NOMBRE_ESTADO } from "@/frontend/utilidades/formato";
import { llamarApi, mensajesDeError } from "@/frontend/utilidades/api";
import Alertas from "@/frontend/componentes/Alertas";
import Confirmacion from "@/frontend/componentes/Confirmacion";
import TarifasEstandar from "@/frontend/componentes/TarifasEstandar";

const BLOQUES = bloquesHorarios();

// ¿La reserva sigue pendiente y todavía no empieza? (El servidor lo vuelve a comprobar.)
function sePuedeCancelar(reserva, ahora) {
  if (reserva.estado !== "PENDIENTE") return false;
  return (
    reserva.fecha > ahora.fecha ||
    (reserva.fecha === ahora.fecha && hora(reserva.horaInicio) > ahora.hora)
  );
}

function TablaMisReservas({ reservas, ahora, onCancelar }) {
  if (reservas.length === 0) return <p>Todavía no tienes reservas.</p>;

  return (
    <div className="tabla-contenedor">
      <table className="tabla">
        <thead>
          <tr>
            <th scope="col">Código</th>
            <th scope="col">Fecha</th>
            <th scope="col">Hora</th>
            <th scope="col">Estado</th>
            <th scope="col">Precio</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {reservas.map((r) => (
            <tr key={r.id}>
              <td>{r.codigo}</td>
              <td>{fechaLegible(r.fecha)}</td>
              <td>{hora(r.horaInicio)}</td>
              <td>
                <span className={`etiqueta etiqueta--${r.estado}`}>{NOMBRE_ESTADO[r.estado]}</span>
              </td>
              <td>{dolares(r.precio)}</td>
              <td>
                {sePuedeCancelar(r, ahora) ? (
                  <button
                    type="button"
                    className="boton boton--peligro boton--pequeno"
                    onClick={() => onCancelar(r)}
                  >
                    Cancelar
                  </button>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PaginaReservar() {
  const router = useRouter();
  const [ahora, setAhora] = useState(null); // { fecha, hora } en la zona del negocio
  const [fecha, setFecha] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [disponibilidad, setDisponibilidad] = useState(null); // { libres, ocupados, pasados }
  const [precio, setPrecio] = useState(null); // { precio }: el servidor no le envía el desglose al cliente
  const [reservas, setReservas] = useState([]);
  const [errores, setErrores] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [confirmacion, setConfirmacion] = useState(null);

  // Contadores para ignorar respuestas atrasadas cuando el usuario cambia los datos rápido.
  const idDisponibilidad = useRef(0);
  const idPrecio = useRef(0);

  const irALogin = useCallback(() => router.push("/login"), [router]);

  const cargarReservas = useCallback(async () => {
    const res = await llamarApi("/api/mis-reservas");
    if (res.estado === 401) return irALogin();
    if (!res.ok) {
      setErrores(mensajesDeError(res.datos, "No se pudieron cargar tus reservas."));
      return;
    }
    setAhora(hoyEnNegocio());
    setReservas(res.datos.reservas);
  }, [irALogin]);

  const cargarDisponibilidad = useCallback(
    async (fechaElegida) => {
      const id = ++idDisponibilidad.current;
      if (!fechaElegida) {
        setDisponibilidad(null);
        return;
      }
      const res = await llamarApi(
        `/api/reservas/disponibilidad?fecha=${encodeURIComponent(fechaElegida)}`
      );
      if (id !== idDisponibilidad.current) return; // llegó tarde: ya hay otra consulta más reciente
      if (res.estado === 401) return irALogin();
      setDisponibilidad(res.ok ? res.datos : null);
      if (!res.ok) setErrores(mensajesDeError(res.datos, "No se pudo consultar la disponibilidad."));
    },
    [irALogin]
  );

  useEffect(() => {
    // Carga inicial desde la API al abrir la página: uso legítimo de un efecto.
    // (Los setState ocurren después de esperar las respuestas, no de forma síncrona.)
    async function iniciar() {
      const hoy = hoyEnNegocio();
      await Promise.all([cargarReservas(), cargarDisponibilidad(hoy.fecha)]);
      setAhora(hoy);
      setFecha(hoy.fecha);
      setCargando(false);
    }
    iniciar();
  }, [cargarReservas, cargarDisponibilidad]);

  function elegirFecha(nuevaFecha) {
    // Al cambiar la fecha, la hora elegida deja de ser válida.
    idPrecio.current++;
    setFecha(nuevaFecha);
    setHoraInicio("");
    setPrecio(null);
    setErrores([]);
    setMensaje("");
    cargarDisponibilidad(nuevaFecha);
  }

  async function elegirBloque(bloque) {
    const id = ++idPrecio.current;
    setHoraInicio(bloque);
    setPrecio(null);
    setErrores([]);
    setMensaje("");

    const res = await llamarApi("/api/precio/calcular", {
      metodo: "POST",
      cuerpo: { fecha, horaInicio: bloque },
    });
    if (id !== idPrecio.current) return;
    if (res.estado === 401) return irALogin();
    if (res.ok) setPrecio(res.datos);
    else setErrores(mensajesDeError(res.datos, "No se pudo calcular el precio."));
  }

  async function reservar() {
    setErrores([]);
    setMensaje("");
    setGuardando(true);

    // No se envía precio ni cliente: los pone el servidor.
    const res = await llamarApi("/api/mis-reservas", {
      metodo: "POST",
      cuerpo: { fecha, horaInicio },
    });
    setGuardando(false);

    if (res.estado === 401) return irALogin();
    setHoraInicio("");
    setPrecio(null);
    if (!res.ok) {
      setErrores(mensajesDeError(res.datos, "No se pudo crear la reserva."));
      cargarDisponibilidad(fecha); // por si el horario se ocupó mientras tanto
      return;
    }
    setMensaje(`Reserva ${res.datos.reserva.codigo}: Pendiente de confirmación.`);
    await Promise.all([cargarDisponibilidad(fecha), cargarReservas()]);
  }

  function pedirCancelacion(reserva) {
    setConfirmacion({
      mensaje: `¿Quieres cancelar la reserva ${reserva.codigo}?`,
      accion: () => cancelar(reserva),
    });
  }

  async function cancelar(reserva) {
    setErrores([]);
    setMensaje("");

    const res = await llamarApi(`/api/mis-reservas/${reserva.id}`, {
      metodo: "PATCH",
      cuerpo: { estado: "CANCELADA" },
    });
    if (res.estado === 401) return irALogin();
    if (res.ok) setMensaje(`Reserva ${reserva.codigo}: cancelada.`);
    else setErrores(mensajesDeError(res.datos, "No se pudo cancelar la reserva."));
    await Promise.all([cargarReservas(), cargarDisponibilidad(fecha)]);
  }

  if (cargando) return <p className="cargando">Cargando…</p>;

  // Texto del estado de un bloque: no depende solo del color.
  function estadoBloque(bloque) {
    if (disponibilidad.ocupados.includes(bloque)) return "Ocupado";
    if (disponibilidad.pasados.includes(bloque)) return "Pasado";
    return "";
  }

  return (
    <div className="pagina">
      <div className="pagina__cabecera">
        <h1>Reservar la cancha</h1>
        <p className="pagina__intro">Tu reserva queda pendiente hasta que el local la confirme.</p>
      </div>

      <Alertas errores={errores} mensaje={mensaje} />

      <TarifasEstandar />

      <section className="tarjeta">
        <h2>Nueva reserva</h2>
        <div className="formulario formulario--filtro">
          <label className="campo">
            Fecha
            <input
              type="date"
              value={fecha}
              min={ahora.fecha}
              onChange={(e) => elegirFecha(e.target.value)}
            />
          </label>
        </div>

        {disponibilidad && (
          <div className="formulario--filtro">
            <p id="titulo-horas" className="campo">
              Hora
            </p>
            <div role="group" aria-labelledby="titulo-horas" className="acciones">
              {BLOQUES.map((bloque) => {
                const estado = estadoBloque(bloque);
                const elegido = bloque === horaInicio;
                return (
                  <button
                    key={bloque}
                    type="button"
                    className={`boton boton--pequeno ${elegido ? "" : "boton--secundario"}`}
                    aria-pressed={elegido}
                    disabled={estado !== ""}
                    onClick={() => elegirBloque(bloque)}
                  >
                    {bloque}
                    {estado && ` · ${estado}`}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {precio && (
          <>
            <p aria-live="polite">
              Precio por hora: <strong className="precio-grande">{dolares(precio.precio)}</strong>
            </p>
            <button type="button" className="boton" onClick={reservar} disabled={guardando}>
              {guardando ? "Reservando…" : "Reservar"}
            </button>
          </>
        )}
      </section>

      <section className="tarjeta">
        <h2>Mis reservas</h2>
        <TablaMisReservas reservas={reservas} ahora={ahora} onCancelar={pedirCancelacion} />
      </section>

      <Confirmacion confirmacion={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </div>
  );
}
