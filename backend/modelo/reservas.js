import "server-only";
import { randomInt } from "node:crypto";
import { calcularPrecioReserva } from "@/backend/core/servicioPrecio";
import { ErrorSinTarifaBase } from "@/backend/core/calcularPrecio";
import { ALFABETO_CODIGO, construirCodigo } from "@/backend/validaciones/reserva";

export const CAMPOS_RESERVA = "id, codigo, fecha, horaInicio, estado, precio, descuento, reglaClienteId, clienteId";
const INTENTOS_CODIGO = 5;

function sufijoAleatorio() {
  let texto = "";
  for (let i = 0; i < 4; i++) texto += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)];
  return texto;
}

// Error interno: el detalle va solo al registro del servidor, nunca al navegador.
function fallo(error, mensaje) {
  console.error(mensaje, error?.message ?? error);
  return { estado: 500, cuerpo: { error: mensaje } };
}

// Crea una reserva PENDIENTE con el precio del Core y el beneficio que se aplicó (si hubo).
// Los datos deben venir ya validados (validarNuevaReserva).
// Devuelve { estado, cuerpo } para responder directo con NextResponse.json(cuerpo, { status: estado }).
export async function crearReserva(admin, { clienteId, fecha, horaInicio }) {
  // El cliente debe existir y tener rol CLIENTE.
  const { data: cliente, error: errorCliente } = await admin
    .from("usuarios")
    .select("id")
    .eq("id", clienteId)
    .eq("rol", "CLIENTE")
    .maybeSingle();
  if (errorCliente) return fallo(errorCliente, "No se pudo crear la reserva");
  if (!cliente) return { estado: 422, cuerpo: { errores: ["El cliente elegido no existe."] } };

  // Comprobación amable de horario libre (la garantía real es el índice único de la base).
  const { data: ocupada, error: errorHorario } = await admin
    .from("reservas")
    .select("id")
    .eq("fecha", fecha)
    .eq("horaInicio", horaInicio)
    .neq("estado", "CANCELADA")
    .maybeSingle();
  if (errorHorario) return fallo(errorHorario, "No se pudo crear la reserva");
  if (ocupada) return { estado: 409, cuerpo: { error: "Ese horario ya está reservado" } };

  // Precio y beneficio calculados por el Core en el servidor. Quedan fijos en la reserva, como el precio.
  let precio, reglaClienteId, descuento;
  try {
    const resultado = await calcularPrecioReserva({ clienteId, fecha, horaInicio });
    precio = resultado.precio;
    descuento = resultado.descuento;
    reglaClienteId = resultado.beneficios.aplicada?.id ?? null;
  } catch (error) {
    if (error instanceof ErrorSinTarifaBase) {
      return {
        estado: 409,
        cuerpo: { error: "No hay una tarifa base configurada. Créala antes de registrar reservas." },
      };
    }
    return fallo(error, "No se pudo calcular el precio de la reserva");
  }

  return insertarReserva(admin, { clienteId, fecha, horaInicio, precio, reglaClienteId, descuento });
}

// Inserta la reserva. Si el código generado ya existe (columna "codigo" única), prueba con otro.
async function insertarReserva(admin, { clienteId, fecha, horaInicio, precio, reglaClienteId, descuento }) {
  for (let intento = 0; intento < INTENTOS_CODIGO; intento++) {
    const { data: creada, error } = await admin
      .from("reservas")
      .insert({
        codigo: construirCodigo(fecha, horaInicio, sufijoAleatorio()),
        fecha,
        horaInicio,
        estado: "PENDIENTE",
        precio,
        reglaClienteId,
        descuento,
        clienteId,
      })
      .select(CAMPOS_RESERVA)
      .single();

    if (!error) return { estado: 201, cuerpo: { reserva: creada } };

    if (error.code === "23505") {
      // Índice único del horario: alguien reservó justo ahora.
      if (String(error.message).includes("reservas_horario_unico")) {
        return { estado: 409, cuerpo: { error: "Ese horario ya está reservado" } };
      }
      continue; // choque de código: se prueba con otro
    }
    return fallo(error, "No se pudo crear la reserva");
  }

  return fallo(new Error("No se pudo generar un código único"), "No se pudo crear la reserva");
}
