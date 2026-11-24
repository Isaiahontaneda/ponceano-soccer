// Reporte de ingresos. Funciones puras (sin base de datos ni alias "@/").
import { fechaValida, sumarDias } from "../fechas.js";

// Rango máximo del reporte, contando los dos extremos (un año bisiesto completo).
export const MAX_DIAS_RANGO = 366;

// Valida { desde, hasta, agrupar }. Devuelve { errores, datos }.
export function validarRangoIngresos(entrada) {
  const dato = entrada && typeof entrada === "object" ? entrada : {};
  const errores = [];
  const { desde, hasta } = dato;
  const agrupar = dato.agrupar ?? "dia";

  if (!fechaValida(desde)) errores.push("La fecha «desde» es obligatoria y debe ser válida (AAAA-MM-DD).");
  if (!fechaValida(hasta)) errores.push("La fecha «hasta» es obligatoria y debe ser válida (AAAA-MM-DD).");

  if (errores.length === 0) {
    if (desde > hasta) {
      errores.push("La fecha «desde» no puede ser posterior a la fecha «hasta».");
    } else if (hasta > sumarDias(desde, MAX_DIAS_RANGO - 1)) {
      errores.push(`El rango no puede pasar de ${MAX_DIAS_RANGO} días.`);
    }
  }

  if (agrupar !== "dia" && agrupar !== "mes") errores.push("Agrupar debe ser «dia» o «mes».");

  return { errores, datos: { desde, hasta, agrupar } };
}

// Solo estos estados cuentan; CANCELADA y los desconocidos se ignoran.
const GRUPO_POR_ESTADO = { CONFIRMADA: "confirmadas", PENDIENTE: "pendientes" };

const vacio = () => ({
  confirmadas: { cantidad: 0, centavos: 0 },
  pendientes: { cantidad: 0, centavos: 0 },
});

// { cantidad, centavos } -> { cantidad, monto }. Aquí ocurre la única división entre 100.
const conMonto = ({ cantidad, centavos }) => ({ cantidad, monto: centavos / 100 });

// Agrupa reservas [{ fecha, estado, precio }] por "dia" o "mes".
// Devuelve { filas: [{ periodo, confirmadas, pendientes }], totales: { confirmadas, pendientes } }
export function agruparIngresos(reservas, agrupar) {
  const porPeriodo = {};
  const total = vacio();

  for (const reserva of reservas) {
    const grupo = GRUPO_POR_ESTADO[reserva.estado];
    if (!grupo) continue;

    const periodo = agrupar === "mes" ? reserva.fecha.slice(0, 7) : reserva.fecha;
    porPeriodo[periodo] ??= vacio();

    // Se suma en centavos enteros: con decimales, 0.10 + 0.20 da 0.30000000000000004.
    const centavos = Math.round(Number(reserva.precio) * 100);
    for (const suma of [porPeriodo[periodo][grupo], total[grupo]]) {
      suma.cantidad += 1;
      suma.centavos += centavos;
    }
  }

  const filas = Object.keys(porPeriodo)
    .sort()
    .map((periodo) => ({
      periodo,
      confirmadas: conMonto(porPeriodo[periodo].confirmadas),
      pendientes: conMonto(porPeriodo[periodo].pendientes),
    }));

  return {
    filas,
    totales: { confirmadas: conMonto(total.confirmadas), pendientes: conMonto(total.pendientes) },
  };
}
