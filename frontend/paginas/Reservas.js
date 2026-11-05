"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { dolares, fechaLegible, hora, NOMBRE_ESTADO } from "@/frontend/utilidades/formato";
import { hoyEnNegocio } from "@/backend/fechas";
import { TRANSICIONES } from "@/backend/validaciones/reserva";
import { llamarApi, mensajesDeError } from "@/frontend/utilidades/api";
import Alertas from "@/frontend/componentes/Alertas";
import Confirmacion from "@/frontend/componentes/Confirmacion";

const NUEVA_VACIA = { clienteId: "", fecha: "", horaInicio: "" };

export default function PaginaReservas() {
  const router = useRouter();
  const [confirmacion, setConfirmacion] = useState(null);
  const [fechaFiltro, setFechaFiltro] = useState("");
  const [reservas, setReservas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [nueva, setNueva] = useState(NUEVA_VACIA);
  const [disponibilidad, setDisponibilidad] = useState(null); // { libres, ocupados, pasados }
  const [estimado, setEstimado] = useState(null); // resultado de /api/precio/calcular
  const [errores, setErrores] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Contadores para ignorar respuestas atrasadas cuando el usuario cambia los datos rápido.
  const idDisponibilidad = useRef(0);
  const idEstimacion = useRef(0);

  const irALogin = useCallback(() => router.push("/login"), [router]);

  const cargarReservas = useCallback(
    async (fecha) => {
      const res = await llamarApi(`/api/reservas?fecha=${encodeURIComponent(fecha)}`);
      if (res.estado === 401) return irALogin();
      if (!res.ok) {
        setErrores(mensajesDeError(res.datos, "No se pudieron cargar las reservas."));
        return;
      }
      setReservas(res.datos.reservas);
    },
    [irALogin]
  );

  const cargarDisponibilidad = useCallback(
    async (fecha) => {
      const id = ++idDisponibilidad.current;
      if (!fecha) {
        setDisponibilidad(null);
        return;
      }
      const res = await llamarApi(`/api/reservas/disponibilidad?fecha=${encodeURIComponent(fecha)}`);
      if (id !== idDisponibilidad.current) return; // llegó tarde: ya hay otra consulta más reciente
      if (res.estado === 401) return irALogin();
      setDisponibilidad(res.ok ? res.datos : null);
      if (!res.ok) setErrores(mensajesDeError(res.datos, "No se pudo consultar la disponibilidad."));
    },
    [irALogin]
  );

  // Calcula el precio estimado con el Core cuando ya están los tres datos.
  const estimarPrecio = useCallback(
    async (datos) => {
      const id = ++idEstimacion.current;
      if (!datos.clienteId || !datos.fecha || !datos.horaInicio) {
        setEstimado(null);
        return;
      }
      const res = await llamarApi("/api/precio/calcular", { metodo: "POST", cuerpo: datos });
      if (id !== idEstimacion.current) return;
      if (res.estado === 401) return irALogin();
      if (res.ok) {
        setEstimado(res.datos);
      } else {
        setEstimado(null);
        setErrores(mensajesDeError(res.datos, "No se pudo calcular el precio."));
      }
    },
    [irALogin]
  );

  useEffect(() => {
    // Carga inicial desde la API al abrir la página: uso legítimo de un efecto.
    // (Los setState ocurren después de esperar las respuestas, no de forma síncrona.)
    async function iniciar() {
      const hoy = hoyEnNegocio().fecha;
      setFechaFiltro(hoy);
      setNueva((n) => ({ ...n, fecha: hoy }));

      const resClientes = await llamarApi("/api/usuarios?rol=CLIENTE");
      if (resClientes.estado === 401) return irALogin();
      if (resClientes.ok) setClientes(resClientes.datos.usuarios);
      else setErrores(mensajesDeError(resClientes.datos, "No se pudo cargar la lista de clientes."));

      await Promise.all([cargarReservas(hoy), cargarDisponibilidad(hoy)]);
      setCargando(false);
    }
    iniciar();
  }, [irALogin, cargarReservas, cargarDisponibilidad]);

  function cambiarFiltro(fecha) {
    setFechaFiltro(fecha);
    setErrores([]);
    setMensaje("");
    if (fecha) cargarReservas(fecha);
    else setReservas([]);
  }

  function cambiarCliente(clienteId) {
    const datos = { ...nueva, clienteId };
    setNueva(datos);
    estimarPrecio(datos);
  }

  function cambiarFechaNueva(fecha) {
    // Al cambiar la fecha, la hora elegida deja de ser válida.
    const datos = { ...nueva, fecha, horaInicio: "" };
    setNueva(datos);
    setEstimado(null);
    cargarDisponibilidad(fecha);
  }

  function cambiarHora(horaInicio) {
    const datos = { ...nueva, horaInicio };
    setNueva(datos);
    estimarPrecio(datos);
  }

  async function crear(evento) {
    evento.preventDefault();
    setErrores([]);
    setMensaje("");
    setGuardando(true);

    // No se envía ningún precio: lo calcula el servidor.
    const res = await llamarApi("/api/reservas", { metodo: "POST", cuerpo: nueva });
    setGuardando(false);

    if (res.estado === 401) return irALogin();
    if (!res.ok) {
      setErrores(mensajesDeError(res.datos));
      cargarDisponibilidad(nueva.fecha); // por si el horario se ocupó mientras tanto
      return;
    }

    const r = res.datos.reserva;
    setMensaje(`Reserva ${r.codigo} creada para el ${fechaLegible(r.fecha)} a las ${hora(r.horaInicio)}. Precio: ${dolares(r.precio)}.`);
    const siguiente = { clienteId: "", fecha: nueva.fecha, horaInicio: "" };
    setNueva(siguiente);
    setEstimado(null);
    await Promise.all([
      cargarDisponibilidad(nueva.fecha),
      fechaFiltro ? cargarReservas(fechaFiltro) : Promise.resolve(),
    ]);
  }

  function pedirCambioEstado(reserva, estado) {
    const accion = estado === "CONFIRMADA" ? "confirmar" : "cancelar";
    setConfirmacion({
      mensaje: `¿Quieres ${accion} la reserva ${reserva.codigo}?`,
      accion: () => cambiarEstado(reserva, estado),
    });
  }

  async function cambiarEstado(reserva, estado) {
    setErrores([]);
    setMensaje("");

    const res = await llamarApi(`/api/reservas/${reserva.id}`, {
      metodo: "PATCH",
      cuerpo: { estado },
    });
    if (res.estado === 401) return irALogin();
    if (!res.ok) {
      setErrores(mensajesDeError(res.datos, "No se pudo cambiar el estado."));
      if (fechaFiltro) cargarReservas(fechaFiltro);
      return;
    }
    setMensaje(`Reserva ${reserva.codigo}: ${NOMBRE_ESTADO[estado].toLowerCase()}.`);
    await Promise.all([
      fechaFiltro ? cargarReservas(fechaFiltro) : Promise.resolve(),
      cargarDisponibilidad(nueva.fecha),
    ]);
  }

  if (cargando) return <p className="cargando">Cargando…</p>;

  const libres = disponibilidad?.libres ?? [];
  const sinHorarios = nueva.fecha && disponibilidad && libres.length === 0;

  return (
    <div className="pagina">
      <div className="pagina__cabecera">
        <div>
          <h1>Reservas</h1>
          <p className="pagina__intro">El precio lo calcula el sistema con las tarifas vigentes.</p>
        </div>
      </div>

      <Alertas errores={errores} mensaje={mensaje} />

      <section className="tarjeta">
        <h2>Nueva reserva</h2>
        <form onSubmit={crear} className="formulario formulario--ancho">
          <label className="campo">
            Cliente
            <select value={nueva.clienteId} onChange={(e) => cambiarCliente(e.target.value)} required>
              <option value="">Selecciona un cliente…</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.apellido} ({c.correo})
                </option>
              ))}
            </select>
            {clientes.length === 0 && (
              <span className="campo__ayuda">
                No hay clientes registrados. Créalos en la sección Usuarios.
              </span>
            )}
          </label>

          <label className="campo">
            Fecha
            <input
              type="date"
              value={nueva.fecha}
              onChange={(e) => cambiarFechaNueva(e.target.value)}
              required
            />
          </label>

          <label className="campo">
            Hora
            <select
              value={nueva.horaInicio}
              onChange={(e) => cambiarHora(e.target.value)}
              disabled={!nueva.fecha || libres.length === 0}
              required
            >
              <option value="">
                {sinHorarios ? "Sin horarios libres" : "Selecciona una hora…"}
              </option>
              {libres.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            {disponibilidad && disponibilidad.ocupados.length > 0 && (
              <span className="campo__ayuda">Ocupados: {disponibilidad.ocupados.join(", ")}</span>
            )}
          </label>

          <div>
            <p aria-live="polite" className="campo__ayuda">
              Precio estimado:{" "}
              <strong className="dato__valor">{estimado ? dolares(estimado.precio) : "—"}</strong>
            </p>
            <button type="submit" className="boton" disabled={guardando || !estimado}>
              {guardando ? "Guardando…" : "Crear reserva"}
            </button>
          </div>
        </form>
      </section>

      <section className="tarjeta">
        <h2>Reservas del día</h2>
        <div className="formulario formulario--filtro">
          <label className="campo">
            Fecha
            <input type="date" value={fechaFiltro} onChange={(e) => cambiarFiltro(e.target.value)} />
          </label>
        </div>

        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Hora</th>
                <th scope="col">Cliente</th>
                <th scope="col">Precio</th>
                <th scope="col">Estado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reservas.map((r) => (
                <tr key={r.id}>
                  <td>{r.codigo}</td>
                  <td>{hora(r.horaInicio)}</td>
                  <td>{r.cliente ? `${r.cliente.nombre} ${r.cliente.apellido}` : "—"}</td>
                  <td>{dolares(r.precio)}</td>
                  <td>
                    <span className={`etiqueta etiqueta--${r.estado}`}>{NOMBRE_ESTADO[r.estado]}</span>
                  </td>
                  <td>
                    <div className="acciones">
                      {TRANSICIONES[r.estado].includes("CONFIRMADA") && (
                        <button
                          type="button"
                          className="boton boton--pequeno"
                          onClick={() => pedirCambioEstado(r, "CONFIRMADA")}
                        >
                          Confirmar
                        </button>
                      )}
                      {TRANSICIONES[r.estado].includes("CANCELADA") && (
                        <button
                          type="button"
                          className="boton boton--peligro boton--pequeno"
                          onClick={() => pedirCambioEstado(r, "CANCELADA")}
                        >
                          Cancelar
                        </button>
                      )}
                      {TRANSICIONES[r.estado].length === 0 && "—"}
                    </div>
                  </td>
                </tr>
              ))}
              {reservas.length === 0 && (
                <tr>
                  <td className="tabla--vacia" colSpan={6}>
                    No hay reservas para esta fecha.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Confirmacion confirmacion={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </div>
  );
}
