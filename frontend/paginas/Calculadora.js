"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { bloquesHorarios } from "@/backend/configuracion";
import { hoyEnNegocio } from "@/backend/fechas";
import { dolares } from "@/frontend/utilidades/formato";
import { llamarApi, mensajesDeError } from "@/frontend/utilidades/api";
import Alertas from "@/frontend/componentes/Alertas";

const BLOQUES = bloquesHorarios();

// Texto del efecto de una línea del desglose: "$40.00", "+25 %" o "−10 %".
function efectoLinea(linea) {
  if (linea.tipo === "BASE") return dolares(linea.monto);
  const signo = linea.porcentaje < 0 ? "−" : "+";
  return `${signo}${Math.abs(linea.porcentaje)} %`;
}

export default function PaginaCalculadora() {
  const router = useRouter();
  const [fecha, setFecha] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [clientes, setClientes] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [errores, setErrores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [calculando, setCalculando] = useState(false);

  useEffect(() => {
    // Carga inicial: fecha de hoy (en la zona del negocio) y lista de clientes desde la API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFecha(hoyEnNegocio().fecha);
    llamarApi("/api/usuarios?rol=CLIENTE").then((res) => {
      if (res.estado === 401) {
        router.push("/login");
        return;
      }
      if (res.ok) {
        setClientes(res.datos.usuarios);
      } else {
        setErrores(mensajesDeError(res.datos, "No se pudo cargar la lista de clientes."));
      }
      setCargando(false);
    });
  }, [router]);

  async function calcular(evento) {
    evento.preventDefault();
    setErrores([]);
    setResultado(null);
    setCalculando(true);

    const res = await llamarApi("/api/precio/calcular", {
      metodo: "POST",
      cuerpo: { fecha, horaInicio, clienteId: clienteId || null },
    });
    setCalculando(false);

    if (res.estado === 401) {
      router.push("/login");
      return;
    }
    if (!res.ok) {
      setErrores(mensajesDeError(res.datos, "No se pudo calcular el precio."));
      return;
    }
    setResultado(res.datos);
  }

  if (cargando) return <p className="cargando">Cargando…</p>;

  const comparaciones = resultado?.comparaciones;

  return (
    <div className="pagina">
      <div className="pagina__cabecera">
        <div>
          <h1>Calculadora de precio</h1>
          <p className="pagina__intro">
            Simula una reserva y mira cómo se llega al precio, paso a paso.
          </p>
        </div>
      </div>

      <section className="tarjeta">
        <h2>Datos de la reserva</h2>
        <form onSubmit={calcular} className="formulario formulario--ancho">
          <label className="campo">
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </label>

          <label className="campo">
            Hora de inicio
            <select value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} required>
              <option value="">Selecciona una hora…</option>
              {BLOQUES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>

          <label className="campo">
            Cliente
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Sin cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.apellido} ({c.correo})
                </option>
              ))}
            </select>
          </label>

          <div>
            <button type="submit" className="boton" disabled={calculando}>
              {calculando ? "Calculando…" : "Calcular precio"}
            </button>
          </div>
        </form>
      </section>

      <Alertas errores={errores} />

      {resultado && (
        <>
          <section className="tarjeta" aria-live="polite">
            <h2>Resultado</h2>
            <p className="precio-grande">{dolares(resultado.precio)}</p>

            <div className="tabla-contenedor">
              <table className="desglose">
                <caption className="solo-lectores">Desglose del precio</caption>
                <thead>
                  <tr>
                    <th scope="col">Concepto</th>
                    <th scope="col">Efecto</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.desglose.map((linea, i) => (
                    <tr key={i}>
                      <td>{linea.concepto}</td>
                      <td>{efectoLinea(linea)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>Subtotal: base × (1 + recargos)</td>
                    <td>{dolares(resultado.subtotal)}</td>
                  </tr>
                  {resultado.descuento > 0 && (
                    <tr>
                      <td>Descuento aplicado al subtotal</td>
                      <td>−{Math.round(resultado.descuento * 1000) / 10} %</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Precio final</td>
                    <td>{dolares(resultado.precio)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="tarjeta">
            <h2>Reglas aplicadas</h2>
            <ul className="reglas">
              <li className={comparaciones.franja.aplicada ? "reglas__si" : ""}>
                <span aria-hidden="true">{comparaciones.franja.aplicada ? "✔" : "—"}</span>{" "}
                <strong>1. Franja horaria:</strong>{" "}
                {comparaciones.franja.aplicada
                  ? `la hora cae en «${comparaciones.franja.regla.nombre}»`
                  : "ninguna franja cubre esa hora (sin recargo de franja)"}
              </li>
              <li className={comparaciones.calendario.aplicada ? "reglas__si" : ""}>
                <span aria-hidden="true">{comparaciones.calendario.aplicada ? "✔" : "—"}</span>{" "}
                <strong>2. Calendario:</strong>{" "}
                {comparaciones.calendario.aplicada
                  ? comparaciones.calendario.reglas.map((r) => `«${r.nombre}»`).join(" + ")
                  : "ese día no tiene recargo de día de la semana ni fecha especial"}
              </li>
              <li className={comparaciones.clienteFrecuente.aplicada ? "reglas__si" : ""}>
                <span aria-hidden="true">{comparaciones.clienteFrecuente.aplicada ? "✔" : "—"}</span>{" "}
                <strong>3. Cliente frecuente:</strong>{" "}
                {comparaciones.clienteFrecuente.aplicada
                  ? `«${comparaciones.clienteFrecuente.regla.nombre}»`
                  : "no cumple el mínimo de reservas"}{" "}
                ({resultado.reservasConfirmadas30Dias} reservas confirmadas en los 30 días previos)
              </li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
