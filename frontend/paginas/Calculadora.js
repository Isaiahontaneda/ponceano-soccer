"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { bloquesHorarios } from "@/backend/configuracion";
import { hoyEnNegocio } from "@/backend/fechas";
import { dolares, porcentaje } from "@/frontend/utilidades/formato";
import { llamarApi, mensajesDeError } from "@/frontend/utilidades/api";
import Alertas from "@/frontend/componentes/Alertas";

const BLOQUES = bloquesHorarios();

const NOMBRE_NIVEL = { ALTA: "Alta", NORMAL: "Normal", BAJA: "Baja", SIN_DATOS: "Sin datos" };

// Porcentaje con signo: "+25 %", "−12.5 %" o "0 %".
function conSigno(valor) {
  if (valor === 0) return "0 %";
  return `${valor < 0 ? "−" : "+"}${Math.abs(valor)} %`;
}

// Texto del efecto de una línea del desglose: un monto ("$40.00") o un porcentaje ("+25 %").
function efectoLinea(linea) {
  return linea.monto !== undefined ? dolares(linea.monto) : conSigno(linea.porcentaje);
}

// Muestras de un historial: días (antiguo) o semanas (actual).
function textoMuestras(historial) {
  if (historial.muestras === null) return "—";
  return `${historial.muestras} ${historial.clave === "ANTIGUO" ? "días" : "semanas"}`;
}

// Tabla de las líneas del desglose de una etapa.
function TablaDesglose({ lineas, titulo }) {
  return (
    <div className="tabla-contenedor">
      <table className="desglose">
        <caption className="solo-lectores">{titulo}</caption>
        <tbody>
          {lineas.map((linea, i) => (
            <tr key={i}>
              <td>{linea.concepto}</td>
              <td>{efectoLinea(linea)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Una comparación del Core: ✔ si se cumplió, — si no (con texto, no solo el símbolo).
function Regla({ aplicada, titulo, children }) {
  return (
    <li className={aplicada ? "reglas__si" : ""}>
      <span aria-hidden="true">{aplicada ? "✔" : "—"}</span> <strong>{titulo}</strong> {children}
    </li>
  );
}

function EtapaReglas({ resultado }) {
  const { comparaciones } = resultado;
  return (
    <section className="tarjeta">
      <h2>1. Reglas de tarifas</h2>
      <TablaDesglose titulo="Reglas de tarifas" lineas={resultado.desglose.filter((l) => l.etapa === 1)} />
      <ul className="reglas">
        <Regla aplicada={comparaciones.franja.aplicada} titulo="Comparación 1, franja horaria:">
          {comparaciones.franja.aplicada
            ? `la hora cae en «${comparaciones.franja.regla.nombre}»`
            : "ninguna franja cubre esa hora (sin recargo de franja)"}
        </Regla>
        <Regla aplicada={comparaciones.calendario.aplicada} titulo="Comparación 2, calendario:">
          {comparaciones.calendario.aplicada
            ? comparaciones.calendario.reglas.map((r) => `«${r.nombre}»`).join(" + ")
            : "ese día no tiene recargo de día de la semana ni fecha especial"}
        </Regla>
        <Regla aplicada={comparaciones.clienteFrecuente.aplicada} titulo="Comparación 3, cliente frecuente:">
          {comparaciones.clienteFrecuente.aplicada
            ? `«${comparaciones.clienteFrecuente.regla.nombre}» (se aplica en la etapa 4)`
            : "no cumple el mínimo de reservas"}{" "}
          ({resultado.reservasConfirmadas30Dias} reservas confirmadas en los 30 días previos)
        </Regla>
      </ul>
    </section>
  );
}

function EtapaHistorial({ historial }) {
  return (
    <section className="tarjeta">
      <h2>2. Historial de demanda</h2>
      <div className="tabla-contenedor">
        <table className="tabla">
          <caption className="solo-lectores">Comparaciones 4 y 5 con el historial</caption>
          <thead>
            <tr>
              <th scope="col">Comparación</th>
              <th scope="col">Ocupación</th>
              <th scope="col">Muestras</th>
              <th scope="col">Nivel</th>
            </tr>
          </thead>
          <tbody>
            {historial.comparaciones.map((c, i) => (
              <tr key={c.clave}>
                <td>
                  {i + 4}. {c.nombre}
                </td>
                <td>{c.ocupacion === null ? "—" : `${porcentaje(c.ocupacion)} %`}</td>
                <td>{textoMuestras(c)}</td>
                <td>{NOMBRE_NIVEL[c.nivel]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <strong>Decisión:</strong> {historial.motivo}. Ajuste por demanda:{" "}
        <strong>{conSigno(porcentaje(historial.ajuste))}</strong>
      </p>
    </section>
  );
}

function EtapaRango({ rango, precioAntesDeDescuento }) {
  return (
    <section className="tarjeta">
      <h2>3. Rango publicado</h2>
      {rango ? (
        <p>
          Franja <strong>{rango.nombre}</strong>: de {dolares(rango.minimo)} a {dolares(rango.maximo)}.{" "}
          {rango.motivo}.
        </p>
      ) : (
        <p>Fuera del horario publicado: sin límites.</p>
      )}
      <p>
        Precio antes de descuentos: <strong>{dolares(precioAntesDeDescuento)}</strong>
      </p>
    </section>
  );
}

function EtapaFinal({ resultado }) {
  return (
    <section className="tarjeta" aria-live="polite">
      <h2>4. Descuento y precio final</h2>
      <p>
        Descuento de cliente frecuente:{" "}
        <strong>{resultado.descuento > 0 ? conSigno(-porcentaje(resultado.descuento)) : "no aplica"}</strong>
      </p>
      <p className="precio-grande">{dolares(resultado.precio)}</p>
    </section>
  );
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

  return (
    <div className="pagina">
      <div className="pagina__cabecera">
        <div>
          <h1>Calculadora de precio</h1>
          <p className="pagina__intro">
            Simula una reserva y mira cómo se llega al precio, etapa por etapa.
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
          <EtapaReglas resultado={resultado} />
          <EtapaHistorial historial={resultado.historial} />
          <EtapaRango rango={resultado.rango} precioAntesDeDescuento={resultado.precioAntesDeDescuento} />
          <EtapaFinal resultado={resultado} />
        </>
      )}
    </div>
  );
}
