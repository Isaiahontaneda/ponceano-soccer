"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const FORMULARIO_VACIO = {
  tipoId: "",
  nombre: "",
  valor: "",
  horaInicio: "",
  horaFin: "",
  diaSemana: "",
  fecha: "",
  minReservas: "",
};

const hora = (texto) => (texto ? texto.slice(0, 5) : "");
const porcentaje = (valor) => Number((Number(valor) * 100).toFixed(1));

function valorTexto(t) {
  if (t.tipoCodigo === "BASE") return `$${Number(t.valor).toFixed(2)}`;
  if (t.tipoCodigo === "CLIENTE_FRECUENTE") return `-${porcentaje(t.valor)} %`;
  return `+${porcentaje(t.valor)} %`;
}

function detalleTexto(t) {
  switch (t.tipoCodigo) {
    case "BASE":
      return "Precio por hora";
    case "FRANJA_HORARIA":
      return `${hora(t.horaInicio)} a ${hora(t.horaFin)}`;
    case "DIA_SEMANA":
      return DIAS[t.diaSemana];
    case "FECHA_ESPECIAL":
      return t.fecha;
    case "CLIENTE_FRECUENTE":
      return `Desde ${t.minReservas} reservas confirmadas`;
    default:
      return "";
  }
}

export default function PaginaTarifas() {
  const router = useRouter();
  const [tarifas, setTarifas] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [errores, setErrores] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const [resTarifas, resTipos] = await Promise.all([
      fetch("/api/tarifas"),
      fetch("/api/tipos-tarifa"),
    ]);

    if (resTarifas.status === 401 || resTipos.status === 401) {
      router.push("/login");
      return;
    }
    if (resTarifas.status === 403 || resTipos.status === 403) {
      setErrores(["No tienes permiso para administrar tarifas."]);
      setCargando(false);
      return;
    }
    if (!resTarifas.ok || !resTipos.ok) {
      setErrores(["No se pudieron cargar los datos."]);
      setCargando(false);
      return;
    }

    const datosTarifas = await resTarifas.json();
    const datosTipos = await resTipos.json();
    setTarifas(datosTarifas.tarifas);
    setTipos(datosTipos.tipos);
    setCargando(false);
  }, [router]);

    useEffect(() => {
    // Carga inicial de datos desde la API al abrir la página: uso legítimo de un efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  const tipoElegido = tipos.find((t) => String(t.id) === String(formulario.tipoId))?.codigo;
  const base = tarifas.find((t) => t.tipoCodigo === "BASE");

  function cambiar(campo, valor) {
    setFormulario((anterior) => ({ ...anterior, [campo]: valor }));
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setFormulario(FORMULARIO_VACIO);
    setErrores([]);
  }

  function editar(t) {
    setEditandoId(t.id);
    setErrores([]);
    setMensaje("");
    setFormulario({
      tipoId: String(t.tipoId),
      nombre: t.nombre,
      valor: String(t.valor),
      horaInicio: hora(t.horaInicio),
      horaFin: hora(t.horaFin),
      diaSemana: t.diaSemana === null ? "" : String(t.diaSemana),
      fecha: t.fecha ?? "",
      minReservas: t.minReservas === null ? "" : String(t.minReservas),
    });
    window.scrollTo(0, 0);
  }

  // NUEVO: cerrar sesión
  async function cerrarSesion() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErrores([]);
    setMensaje("");
    setGuardando(true);

    const url = editandoId ? `/api/tarifas/${editandoId}` : "/api/tarifas";
    const respuesta = await fetch(url, {
      method: editandoId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formulario),
    });
    const datos = await respuesta.json().catch(() => ({}));
    setGuardando(false);

    if (respuesta.status === 401) {
      router.push("/login");
      return;
    }
    if (!respuesta.ok) {
      setErrores(datos.errores ?? [datos.error ?? "Ocurrió un error inesperado."]);
      return;
    }

    setMensaje(editandoId ? "Tarifa actualizada." : "Tarifa creada.");
    setEditandoId(null);
    setFormulario(FORMULARIO_VACIO);
    await cargar();
  }

  async function eliminar(t) {
    if (!window.confirm(`¿Eliminar la tarifa "${t.nombre}"?`)) return;
    setErrores([]);
    setMensaje("");

    const respuesta = await fetch(`/api/tarifas/${t.id}`, { method: "DELETE" });
    const datos = await respuesta.json().catch(() => ({}));

    if (respuesta.status === 401) {
      router.push("/login");
      return;
    }
    if (!respuesta.ok) {
      setErrores([datos.error ?? "No se pudo eliminar la tarifa."]);
      return;
    }
    setMensaje("Tarifa eliminada.");
    await cargar();
  }

  const celda = { border: "1px solid #ccc", padding: "6px 10px", textAlign: "left" };
  const campo = { display: "block", width: "100%", marginBottom: 12 };

  if (cargando) {
    return <main style={{ padding: 24 }}>Cargando...</main>;
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      {/* NUEVO: encabezado con botón de cerrar sesión */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Administración de tarifas</h1>
        <button type="button" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </div>

      {errores.length > 0 && (
        <ul role="alert" style={{ color: "crimson" }}>
          {errores.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
      {mensaje && <p style={{ color: "green" }}>{mensaje}</p>}

      <h2>{editandoId ? "Editar tarifa" : "Nueva tarifa"}</h2>
      <form onSubmit={enviar} style={{ maxWidth: 420, marginBottom: 32 }}>
        <label>
          Tipo de tarifa
          <select
            value={formulario.tipoId}
            onChange={(e) => cambiar("tipoId", e.target.value)}
            required
            style={campo}
          >
            <option value="">Selecciona un tipo...</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>

        <label>
          Nombre
          <input
            type="text"
            value={formulario.nombre}
            onChange={(e) => cambiar("nombre", e.target.value)}
            maxLength={60}
            required
            style={campo}
          />
        </label>

        <label>
          {tipoElegido === "BASE"
            ? "Valor (precio por hora en $)"
            : "Valor (decimal: 0.25 equivale a 25 %)"}
          <input
            type="number"
            step="0.001"
            value={formulario.valor}
            onChange={(e) => cambiar("valor", e.target.value)}
            required
            style={campo}
          />
        </label>

        {tipoElegido === "FRANJA_HORARIA" && (
          <>
            <label>
              Hora de inicio
              <input
                type="time"
                value={formulario.horaInicio}
                onChange={(e) => cambiar("horaInicio", e.target.value)}
                required
                style={campo}
              />
            </label>
            <label>
              Hora de fin
              <input
                type="time"
                value={formulario.horaFin}
                onChange={(e) => cambiar("horaFin", e.target.value)}
                required
                style={campo}
              />
            </label>
          </>
        )}

        {tipoElegido === "DIA_SEMANA" && (
          <label>
            Día de la semana
            <select
              value={formulario.diaSemana}
              onChange={(e) => cambiar("diaSemana", e.target.value)}
              required
              style={campo}
            >
              <option value="">Selecciona un día...</option>
              {DIAS.map((dia, indice) => (
                <option key={indice} value={indice}>
                  {dia}
                </option>
              ))}
            </select>
          </label>
        )}

        {tipoElegido === "FECHA_ESPECIAL" && (
          <label>
            Fecha
            <input
              type="date"
              value={formulario.fecha}
              onChange={(e) => cambiar("fecha", e.target.value)}
              required
              style={campo}
            />
          </label>
        )}

        {tipoElegido === "CLIENTE_FRECUENTE" && (
          <label>
            Mínimo de reservas confirmadas
            <input
              type="number"
              min="1"
              step="1"
              value={formulario.minReservas}
              onChange={(e) => cambiar("minReservas", e.target.value)}
              required
              style={campo}
            />
          </label>
        )}

        <button type="submit" disabled={guardando}>
          {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Crear tarifa"}
        </button>
        {editandoId && (
          <button type="button" onClick={cancelarEdicion} style={{ marginLeft: 8 }}>
            Cancelar
          </button>
        )}
      </form>

      <h2>Tarifas actuales</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={celda}>Tipo</th>
            <th style={celda}>Nombre</th>
            <th style={celda}>Valor</th>
            <th style={celda}>Detalle</th>
            <th style={celda}>Precio por hora</th>
            <th style={celda}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {tarifas.map((t) => (
            <tr key={t.id}>
              <td style={celda}>{t.tipoNombre}</td>
              <td style={celda}>{t.nombre}</td>
              <td style={celda}>{valorTexto(t)}</td>
              <td style={celda}>{detalleTexto(t)}</td>
              <td style={celda}>
                {t.tipoCodigo === "FRANJA_HORARIA" && base
                  ? `$${(Number(base.valor) * (1 + Number(t.valor))).toFixed(2)}`
                  : t.tipoCodigo === "BASE"
                  ? `$${Number(t.valor).toFixed(2)}`
                  : "—"}
              </td>
              <td style={celda}>
                <button type="button" onClick={() => editar(t)}>
                  Editar
                </button>{" "}
                <button type="button" onClick={() => eliminar(t)}>
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
          {tarifas.length === 0 && (
            <tr>
              <td style={celda} colSpan={6}>
                No hay tarifas registradas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}