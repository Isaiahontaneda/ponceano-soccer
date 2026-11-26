// Funciones puras de apoyo para los beneficios del cliente (sin base de datos ni alias "@/").
import { reglaVigente } from "./calcularPrecio.js";

// Cuenta lo que el Core necesita saber del cliente a partir de sus reservas NO canceladas.
// reservas: [{ estado, reglaClienteId, fechaCreacion }]; idsSello: ids de las reglas TARJETA_SELLOS.
// Devuelve { reservasPrevias, confirmadasDesdeUltimoSello }.
export function contarReservasCliente(reservas, idsSello) {
  const vigentes = reservas.filter((r) => r.estado !== "CANCELADA");

  // Última reserva que usó un sello. Una PENDIENTE también cuenta como "sello usado": así el cliente
  // no puede crear dos reservas pendientes seguidas con el mismo sello. Si esa reserva se cancela,
  // deja de estar en "vigentes" y el sello vuelve a estar disponible.
  // fechaCreacion llega de la base siempre con el mismo formato (UTC), así que se compara como texto.
  let ultimoSello = null;
  for (const r of vigentes) {
    if (!idsSello.includes(r.reglaClienteId)) continue;
    if (ultimoSello === null || r.fechaCreacion > ultimoSello) ultimoSello = r.fechaCreacion;
  }

  const confirmadasDesdeUltimoSello = vigentes.filter(
    (r) => r.estado === "CONFIRMADA" && (ultimoSello === null || r.fechaCreacion > ultimoSello)
  ).length;

  return { reservasPrevias: vigentes.length, confirmadasDesdeUltimoSello };
}

// Texto fijo por tipo, para que el cliente entienda cada beneficio.
export function describirRegla(regla) {
  const porcentaje = `${Math.round(Number(regla.descuento) * 1000) / 10} %`;
  switch (regla.tipoCodigo) {
    case "TARJETA_SELLOS":
      return `${porcentaje} de descuento cada ${regla.cadaReservas} reservas confirmadas`;
    case "BIENVENIDA":
      return `${porcentaje} en tu primera reserva`;
    case "RESERVA_ANTICIPADA":
      return `${porcentaje} si reservas con ${regla.diasAnticipacion} días o más de anticipación`;
    case "HORARIO_VALLE":
      return `${porcentaje} en horarios de baja demanda`;
    default:
      return `${porcentaje} de descuento`;
  }
}

// Lo que el cliente ve de sus beneficios: nunca ocupaciones ni datos del historial.
// reglas: todas las reglas con "tipoCodigo"; hoy: "AAAA-MM-DD"; datos: resultado de contarReservasCliente.
export function resumirBeneficios(reglas, hoy, datos) {
  const disponibles = reglas.filter((r) => r.activa && reglaVigente(r, hoy));

  const sello = disponibles.find((r) => r.tipoCodigo === "TARJETA_SELLOS");
  const sellos = sello
    ? {
        acumulados: Math.min(datos.confirmadasDesdeUltimoSello, sello.cadaReservas),
        necesarios: sello.cadaReservas,
        faltan: Math.max(sello.cadaReservas - datos.confirmadasDesdeUltimoSello, 0),
        descuento: Number(sello.descuento),
      }
    : null;

  return {
    sellos,
    reglas: disponibles.map((r) => ({ nombre: r.nombre, descuento: Number(r.descuento), descripcion: describirRegla(r) })),
  };
}
