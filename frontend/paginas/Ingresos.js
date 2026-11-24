"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hoyEnNegocio } from "@/backend/fechas";
import { dolares, fechaLegible } from "@/frontend/utilidades/formato";
import { llamarApi, mensajesDeError } from "@/frontend/utilidades/api";
import Alertas from "@/frontend/componentes/Alertas";

// "2026-11-09" -> "09/11/2026"; "2026-11" -> "11/2026"
function periodoLegible(periodo) {
  if (periodo.length === 10) return fechaLegible(periodo);
  const [anio, mes] = periodo.split("-");
  return `${mes}/${anio}`;
}

function Tarjeta({ titulo, monto }) {
  return (
    <p>
      {titulo}
      <br />
      <strong className="dato__valor">{dolares(monto)}</strong>
    </p>
  );
}

function TablaIngresos({ filas, totales }) {
  return (
    <div className="tabla-contenedor">
      <table className="tabla">
        <thead>
          <tr>
            <th scope="col">Período</th>
            <th scope="col">Confirmadas</th>
            <th scope="col">Monto confirmado</th>
            <th scope="col">Pendientes</th>
            <th scope="col">Monto pendiente</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.periodo}>
              <td>{periodoLegible(f.periodo)}</td>
              <td>{f.confirmadas.cantidad}</td>
              <td>{dolares(f.confirmadas.monto)}</td>
              <td>{f.pendientes.cantidad}</td>
              <td>{dolares(f.pendientes.monto)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td>{totales.confirmadas.cantidad}</td>
            <td>{dolares(totales.confirmadas.monto)}</td>
            <td>{totales.pendientes.cantidad}</td>
            <td>{dolares(totales.pendientes.monto)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function PaginaIngresos() {
  const router = useRouter();
  const [filtro, setFiltro] = useState({ desde: "", hasta: "", agrupar: "dia" });
  const [reporte, setReporte] = useState(null); // { filas, totales }
  const [errores, setErrores] = useState([]);
  const [consultando, setConsultando] = useState(true);

  const consultar = useCallback(
    async ({ desde, hasta, agrupar }) => {
      setErrores([]);
      setConsultando(true);
      const res = await llamarApi(
        `/api/reportes/ingresos?desde=${desde}&hasta=${hasta}&agrupar=${agrupar}`
      );
      setConsultando(false);

      if (res.estado === 401) return router.push("/login");
      if (res.ok) {
        setReporte(res.datos);
      } else {
        setReporte(null);
        setErrores(mensajesDeError(res.datos, "No se pudo cargar el reporte."));
      }
    },
    [router]
  );

  useEffect(() => {
    // Carga inicial: del día 1 del mes actual hasta hoy (en la zona del negocio).
    async function iniciar() {
      const hoy = hoyEnNegocio().fecha;
      const inicial = { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy, agrupar: "dia" };
      await consultar(inicial);
      setFiltro(inicial);
    }
    iniciar();
  }, [consultar]);

  function enviar(evento) {
    evento.preventDefault();
    consultar(filtro);
  }

  const totales = reporte?.totales;

  return (
    <div className="pagina">
      <div className="pagina__cabecera">
        <h1>Ingresos</h1>
        <p className="pagina__intro">
          Lo confirmado es ingreso; lo pendiente es lo que se espera si el local lo confirma.
        </p>
      </div>

      <section className="tarjeta">
        <form onSubmit={enviar} className="formulario formulario--ancho">
          <label className="campo">
            Desde
            <input
              type="date"
              value={filtro.desde}
              onChange={(e) => setFiltro({ ...filtro, desde: e.target.value })}
              required
            />
          </label>
          <label className="campo">
            Hasta
            <input
              type="date"
              value={filtro.hasta}
              onChange={(e) => setFiltro({ ...filtro, hasta: e.target.value })}
              required
            />
          </label>
          <label className="campo">
            Agrupar por
            <select
              value={filtro.agrupar}
              onChange={(e) => setFiltro({ ...filtro, agrupar: e.target.value })}
            >
              <option value="dia">Día</option>
              <option value="mes">Mes</option>
            </select>
          </label>
          <div>
            <button type="submit" className="boton" disabled={consultando}>
              {consultando ? "Consultando…" : "Consultar"}
            </button>
          </div>
        </form>
      </section>

      <Alertas errores={errores} />

      {reporte && (
        <>
          <section className="tarjeta resumen" aria-label="Totales">
            <Tarjeta titulo="Ingresos confirmados" monto={totales.confirmadas.monto} />
            <Tarjeta titulo="Pendientes por confirmar" monto={totales.pendientes.monto} />
            <Tarjeta titulo="Total esperado" monto={totales.confirmadas.monto + totales.pendientes.monto} />
          </section>

          <section className="tarjeta">
            <h2>Detalle por {reporte.agrupar === "mes" ? "mes" : "día"}</h2>
            {reporte.filas.length === 0 ? (
              <p>No hay reservas en este rango.</p>
            ) : (
              <TablaIngresos filas={reporte.filas} totales={totales} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
