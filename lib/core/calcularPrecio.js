// CORE de Ponceano Soccer: cálculo del precio de una reserva.
//
// Función PURA: no toca la base de datos ni depende de la zona horaria del servidor.
// Recibe los datos de la reserva y la lista de tarifas y devuelve el precio con su desglose.
//
//   precio = tarifaBase × (1 + recargos) × (1 − descuento)
//
//   - recargos  = recargo de la franja horaria + todos los recargos de calendario que apliquen
//   - descuento = el mayor descuento de cliente frecuente que se cumpla
//   - El redondeo (2 decimales, mitad hacia arriba) se aplica UNA sola vez, al final.
//
// Para que el redondeo sea exacto (sin errores de coma flotante como 1.005), el cálculo
// se hace con enteros: la base en centavos y los porcentajes en milésimas (0.125 = 125).
import { diaSemanaDe, fechaValida, horaValida, recortarHora } from "../fechas.js";

// Se lanza cuando no existe ninguna tarifa de tipo BASE.
export class ErrorSinTarifaBase extends Error {
  constructor() {
    super("No hay una tarifa base configurada: el Core no puede calcular el precio.");
    this.name = "ErrorSinTarifaBase";
  }
}

// Decimal (0.125) -> milésimas enteras (125).
const aMilesimas = (decimal) => Math.round(Number(decimal) * 1000);

// Milésimas -> porcentaje legible (125 -> 12.5).
const aPorcentaje = (milesimas) => milesimas / 10;

// Divide num/den y redondea al entero más cercano, con la mitad hacia arriba.
// Solo para enteros no negativos; usa el resto (%) para no depender de decimales.
function dividirRedondeando(num, den) {
  const doble = 2 * num + den;
  return (doble - (doble % (2 * den))) / (2 * den);
}

// reserva: { fecha: "AAAA-MM-DD", horaInicio: "HH:MM", reservasConfirmadas30Dias: número }
// tarifas: [{ tipoCodigo, nombre, valor, horaInicio, horaFin, diaSemana, fecha, minReservas }]
export function calcularPrecio({ fecha, horaInicio, reservasConfirmadas30Dias = 0 }, tarifas) {
  if (!fechaValida(fecha)) throw new Error("Fecha inválida: se esperaba AAAA-MM-DD.");
  if (!horaValida(horaInicio)) throw new Error("Hora inválida: se esperaba HH:MM.");
  const reservas = Number(reservasConfirmadas30Dias);
  if (!Number.isFinite(reservas) || reservas < 0) {
    throw new Error("El número de reservas confirmadas debe ser un número válido.");
  }

  const hora = recortarHora(horaInicio);
  const dia = diaSemanaDe(fecha); // 0 = domingo ... 6 = sábado

  let baseCentavos = null;
  let franja = null; // regla de franja horaria que cubre la hora (o null)
  const reglasCalendario = []; // reglas de día de la semana / fecha especial que aplican
  let frecuente = null; // regla de cliente frecuente con el mayor descuento (o null)

  // Un solo recorrido por la lista de tarifas: aquí ocurren las 3 comparaciones.
  for (const tarifa of tarifas) {
    switch (tarifa.tipoCodigo) {
      case "BASE": {
        baseCentavos = Math.round(Number(tarifa.valor) * 100);
        break;
      }

      case "FRANJA_HORARIA": {
        // COMPARACIÓN 1: franja horaria.
        // ¿La hora de inicio de la reserva cae dentro del rango [horaInicio, horaFin] de la regla?
        if (hora >= recortarHora(tarifa.horaInicio) && hora <= recortarHora(tarifa.horaFin)) {
          if (franja === null) franja = tarifa; // las franjas no se cruzan; si hubiera dos, gana la primera
        }
        break;
      }

      case "DIA_SEMANA": {
        // COMPARACIÓN 2 (calendario): ¿el día de la semana de la fecha es el de la regla?
        if (dia === tarifa.diaSemana) reglasCalendario.push(tarifa);
        break;
      }

      case "FECHA_ESPECIAL": {
        // COMPARACIÓN 2 (calendario): ¿la fecha de la reserva es exactamente la fecha de la regla?
        if (fecha === tarifa.fecha) reglasCalendario.push(tarifa);
        break;
      }

      case "CLIENTE_FRECUENTE": {
        // COMPARACIÓN 3: cliente frecuente.
        // ¿Las reservas CONFIRMADAS de los 30 días previos alcanzan el mínimo de la regla?
        // Si se cumplen varias reglas, se aplica solo la de mayor descuento.
        if (reservas >= tarifa.minReservas) {
          if (frecuente === null || aMilesimas(tarifa.valor) > aMilesimas(frecuente.valor)) {
            frecuente = tarifa;
          }
        }
        break;
      }

      default:
        break; // tipo desconocido: se ignora
    }
  }

  if (baseCentavos === null) throw new ErrorSinTarifaBase();

  // ----- Fórmula (todo en enteros)
  const milesimasFranja = franja ? aMilesimas(franja.valor) : 0;
  const milesimasCalendario = reglasCalendario.reduce((suma, r) => suma + aMilesimas(r.valor), 0);
  const milesimasRecargos = milesimasFranja + milesimasCalendario;
  const milesimasDescuento = frecuente ? aMilesimas(frecuente.valor) : 0;

  // subtotal = base × (1 + recargos);  precio = subtotal × (1 − descuento)
  const subtotalCentavos = dividirRedondeando(baseCentavos * (1000 + milesimasRecargos), 1000);
  const precioCentavos = dividirRedondeando(
    baseCentavos * (1000 + milesimasRecargos) * (1000 - milesimasDescuento),
    1_000_000
  );

  // ----- Desglose paso a paso (para mostrarlo en pantalla)
  const desglose = [
    { concepto: "Tarifa base por hora", tipo: "BASE", monto: baseCentavos / 100 },
  ];
  if (franja) {
    desglose.push({
      concepto: franja.nombre,
      tipo: "FRANJA_HORARIA",
      porcentaje: aPorcentaje(milesimasFranja),
    });
  }
  for (const regla of reglasCalendario) {
    desglose.push({
      concepto: regla.nombre,
      tipo: regla.tipoCodigo,
      porcentaje: aPorcentaje(aMilesimas(regla.valor)),
    });
  }
  if (frecuente) {
    desglose.push({
      concepto: frecuente.nombre,
      tipo: "CLIENTE_FRECUENTE",
      porcentaje: -aPorcentaje(milesimasDescuento),
    });
  }

  // Resumen de cuáles de las 3 comparaciones se cumplieron.
  const resumen = (t) => ({ nombre: t.nombre, tipo: t.tipoCodigo, valor: Number(t.valor) });
  const comparaciones = {
    franja: { aplicada: franja !== null, regla: franja ? resumen(franja) : null },
    calendario: { aplicada: reglasCalendario.length > 0, reglas: reglasCalendario.map(resumen) },
    clienteFrecuente: { aplicada: frecuente !== null, regla: frecuente ? resumen(frecuente) : null },
  };

  return {
    precio: precioCentavos / 100,
    base: baseCentavos / 100,
    recargos: milesimasRecargos / 1000, // decimal: 0.35 = 35 %
    descuento: milesimasDescuento / 1000, // decimal: 0.1 = 10 %
    subtotal: subtotalCentavos / 100,
    desglose,
    comparaciones,
  };
}
