// CORE de Ponceano Soccer: cálculo del precio de una reserva, en 4 etapas.
//
// Función PURA: no toca la base de datos, no lee la hora del servidor ni depende de su zona
// horaria. Todo llega por parámetros (las tarifas y los historiales los prepara servicioPrecio.js).
//
//   ETAPA 1  Reglas de tarifas   subtotal = base × (1 + recargos)            comparaciones 1, 2 y 3
//   ETAPA 2  Historial           ajustado = subtotal × (1 + ajuste)          comparaciones 4 y 5
//   ETAPA 3  Rango publicado     acotado  = ajustado limitado a [mínimo, máximo] de su franja
//   ETAPA 4  Cliente frecuente   precio   = acotado × (1 − descuento)
//
// Para que el resultado sea exacto (sin errores de coma flotante como 1.005), todo se calcula
// con enteros: la base en centavos y los porcentajes en milésimas (0.125 = 125).
// El redondeo a centavos se hace UNA sola vez, al final.
import {
  AJUSTE_ALZA_FUERTE,
  AJUSTE_ALZA_SUAVE,
  AJUSTE_BAJA_FUERTE,
  AJUSTE_BAJA_SUAVE,
  OCUPACION_MUY_ALTA,
  OCUPACION_MUY_BAJA,
  RANGOS_PRECIO,
  UMBRAL_DEMANDA_ALTA,
  UMBRAL_DEMANDA_BAJA,
} from "../configuracion.js";
import { diaSemanaDe, fechaValida, horaValida, recortarHora } from "../fechas.js";

// Se lanza cuando no existe ninguna tarifa de tipo BASE.
export class ErrorSinTarifaBase extends Error {
  constructor() {
    super("No hay una tarifa base configurada: no se puede calcular el precio.");
    this.name = "ErrorSinTarifaBase";
  }
}

// Escala entera de cada etapa. Cada etapa multiplica por (1000 ± milésimas), así que suma 3 ceros.
const ESCALA_SUBTOTAL = 1_000; // centavos × 10³
const ESCALA_AJUSTADO = 1_000_000; // centavos × 10⁶
const ESCALA_PRECIO = 1_000_000_000; // centavos × 10⁹

// Decimal (0.125) -> milésimas enteras (125).
const aMilesimas = (decimal) => Math.round(Number(decimal) * 1000);

// Milésimas -> porcentaje legible (125 -> 12.5).
const aPorcentaje = (milesimas) => milesimas / 10;

// Ocupación (0.8512) -> diezmilésimas enteras (8512), para comparar promedios sin decimales.
const aDiezmilesimas = (decimal) => Math.round(Number(decimal) * 10000);

// Centavos -> "$55.00".
const textoDolares = (centavos) => `$${(centavos / 100).toFixed(2)}`;

// Divide num/den y redondea al entero más cercano, con la mitad hacia arriba.
// Solo para enteros no negativos; usa el resto (%) para no depender de decimales.
function dividirRedondeando(num, den) {
  const doble = 2 * num + den;
  return (doble - (doble % (2 * den))) / (2 * den);
}

// ---------------------------------------------------------------------------------------------
// ETAPA 1. Reglas de tarifas: un solo recorrido por la lista; aquí ocurren las comparaciones 1, 2 y 3.
// ---------------------------------------------------------------------------------------------
function aplicarReglasTarifas({ fecha, hora, dia, reservas }, tarifas) {
  let baseCentavos = null;
  let franja = null; // regla de franja horaria que cubre la hora (o null)
  const reglasCalendario = []; // reglas de día de la semana / fecha especial que aplican
  let frecuente = null; // regla de cliente frecuente con el mayor descuento (o null)

  tarifas.forEach((tarifa) => {
    switch (tarifa.tipoCodigo) {
      case "BASE":
        baseCentavos = Math.round(Number(tarifa.valor) * 100);
        break;

      case "FRANJA_HORARIA":
        // COMPARACIÓN 1: franja horaria.
        // ¿La hora de inicio de la reserva cae dentro del rango [horaInicio, horaFin] de la regla?
        if (hora >= recortarHora(tarifa.horaInicio) && hora <= recortarHora(tarifa.horaFin)) {
          if (franja === null) franja = tarifa; // las franjas no se cruzan; si hubiera dos, gana la primera
        }
        break;

      case "DIA_SEMANA":
        // COMPARACIÓN 2 (calendario): ¿el día de la semana de la fecha es el de la regla?
        if (dia === tarifa.diaSemana) reglasCalendario.push(tarifa);
        break;

      case "FECHA_ESPECIAL":
        // COMPARACIÓN 2 (calendario): ¿la fecha de la reserva es exactamente la fecha de la regla?
        if (fecha === tarifa.fecha) reglasCalendario.push(tarifa);
        break;

      case "CLIENTE_FRECUENTE":
        // COMPARACIÓN 3: cliente frecuente.
        // ¿Las reservas CONFIRMADAS de los 30 días previos alcanzan el mínimo de la regla?
        // Si se cumplen varias reglas, se usa solo la de mayor descuento (se aplica en la etapa 4).
        if (reservas >= tarifa.minReservas) {
          if (frecuente === null || aMilesimas(tarifa.valor) > aMilesimas(frecuente.valor)) {
            frecuente = tarifa;
          }
        }
        break;

      default:
        break; // tipo desconocido: se ignora
    }
  });

  return { baseCentavos, franja, reglasCalendario, frecuente };
}

// ---------------------------------------------------------------------------------------------
// ETAPA 2. Contraste con el historial.
// ---------------------------------------------------------------------------------------------

// Nivel de demanda de un bloque según su ocupación (0 a 1, o null si no hay datos suficientes).
export function clasificarDemanda(ocupacion) {
  if (ocupacion === null || ocupacion === undefined) return "SIN_DATOS";
  if (ocupacion >= UMBRAL_DEMANDA_ALTA) return "ALTA";
  if (ocupacion <= UMBRAL_DEMANDA_BAJA) return "BAJA";
  return "NORMAL";
}

// ¿El promedio de las ocupaciones es >= (o <=) el umbral? Se compara en diezmilésimas enteras
// y sin dividir: con decimales, (0.10 + 0.20) / 2 da 0.15000000000000002 y fallaría el borde.
function promedioAlcanza(ocupaciones, umbral) {
  const suma = ocupaciones.reduce((total, o) => total + aDiezmilesimas(o), 0);
  return suma >= aDiezmilesimas(umbral) * ocupaciones.length;
}
function promedioNoSupera(ocupaciones, umbral) {
  const suma = ocupaciones.reduce((total, o) => total + aDiezmilesimas(o), 0);
  return suma <= aDiezmilesimas(umbral) * ocupaciones.length;
}

// Regla de decisión. Ningún dato aislado cambia el precio: solo se ajusta cuando el pasado
// lejano (3 años) y el reciente (últimas semanas) COINCIDEN. El orden de los niveles no importa.
// Devuelve { ajuste (decimal), demandaMuyAlta, motivo }.
export function decidirAjusteDemanda(niveles, ocupaciones) {
  const sinAjuste = (motivo) => ({ ajuste: 0, demandaMuyAlta: false, motivo });

  if (niveles.length < 2 || niveles.includes("SIN_DATOS")) {
    return sinAjuste("Historial insuficiente: no se ajusta");
  }
  if (niveles.every((nivel) => nivel === "ALTA")) {
    return promedioAlcanza(ocupaciones, OCUPACION_MUY_ALTA)
      ? { ajuste: AJUSTE_ALZA_FUERTE, demandaMuyAlta: true, motivo: "Ambos historiales muestran demanda muy alta" }
      : { ajuste: AJUSTE_ALZA_SUAVE, demandaMuyAlta: false, motivo: "Ambos historiales muestran demanda alta" };
  }
  if (niveles.every((nivel) => nivel === "BAJA")) {
    return promedioNoSupera(ocupaciones, OCUPACION_MUY_BAJA)
      ? { ajuste: AJUSTE_BAJA_FUERTE, demandaMuyAlta: false, motivo: "Ambos historiales muestran demanda muy baja" }
      : { ajuste: AJUSTE_BAJA_SUAVE, demandaMuyAlta: false, motivo: "Ambos historiales muestran demanda baja" };
  }
  return sinAjuste("Los historiales no coinciden: no se ajusta");
}

// historiales: [{ clave, nombre, ocupacion, muestras }], uno ANTIGUO y uno ACTUAL.
function contrastarHistorial(historiales) {
  const comparaciones = [];

  historiales.forEach((historial) => {
    // COMPARACIÓN 4 (historial ANTIGUO, 3 años) y COMPARACIÓN 5 (historial ACTUAL, últimas semanas):
    // una por elemento de la lista. ¿La ocupación de este bloque fue alta, normal o baja?
    const nivel = clasificarDemanda(historial.ocupacion);
    const { clave, nombre, ocupacion, muestras } = historial;
    comparaciones.push({ clave, nombre, ocupacion, muestras, nivel });
  });

  const decision = decidirAjusteDemanda(
    comparaciones.map((c) => c.nivel),
    comparaciones.map((c) => c.ocupacion)
  );
  return { comparaciones, ...decision };
}

// ---------------------------------------------------------------------------------------------
// ETAPA 3. Rango publicado de la franja (Mañana, Tarde o Noche).
// ajustado viene en centavos × 10⁶; los límites se llevan a esa escala para comparar sin redondear.
// ---------------------------------------------------------------------------------------------
function aplicarRango(ajustado, hora, demandaMuyAlta) {
  const rango = RANGOS_PRECIO.find((r) => hora >= r.desde && hora <= r.hasta);
  if (!rango) return { acotado: ajustado, rango: null }; // fuera del horario publicado: sin límites

  // El máximo alto (en la noche, $55) solo vale con demanda MUY alta en ambos historiales.
  const usaMaximoAlto = demandaMuyAlta && rango.maximoDemandaMuyAlta > rango.maximo;
  const minimoCentavos = Math.round(rango.minimo * 100);
  const maximoCentavos = Math.round((usaMaximoAlto ? rango.maximoDemandaMuyAlta : rango.maximo) * 100);
  const datos = {
    franja: rango.franja,
    nombre: rango.nombre,
    minimo: minimoCentavos / 100,
    maximo: maximoCentavos / 100,
  };

  if (ajustado > maximoCentavos * ESCALA_AJUSTADO) {
    const motivo = usaMaximoAlto ? "Limitado al máximo por demanda muy alta" : "Limitado al máximo publicado";
    return {
      acotado: maximoCentavos * ESCALA_AJUSTADO,
      rango: { ...datos, aplicado: true, motivo: `${motivo}: ${textoDolares(maximoCentavos)}` },
    };
  }
  if (ajustado < minimoCentavos * ESCALA_AJUSTADO) {
    return {
      acotado: minimoCentavos * ESCALA_AJUSTADO,
      rango: { ...datos, aplicado: true, motivo: `Limitado al mínimo publicado: ${textoDolares(minimoCentavos)}` },
    };
  }
  const motivo = `Dentro del rango ${rango.nombre}: ${textoDolares(minimoCentavos)} a ${textoDolares(maximoCentavos)}`;
  return { acotado: ajustado, rango: { ...datos, aplicado: false, motivo } };
}

// ---------------------------------------------------------------------------------------------
// Desglose paso a paso, en el orden de las etapas (para mostrarlo en la calculadora).
// Cada línea lleva "monto" (dólares) o "porcentaje".
// ---------------------------------------------------------------------------------------------
function armarDesglose({ reglas, subtotal, historial, rango, acotado, milesimasDescuento }) {
  const desglose = [
    { etapa: 1, concepto: "Tarifa base por hora", tipo: "BASE", monto: reglas.baseCentavos / 100 },
  ];
  if (reglas.franja) {
    desglose.push({
      etapa: 1,
      concepto: reglas.franja.nombre,
      tipo: "FRANJA_HORARIA",
      porcentaje: aPorcentaje(aMilesimas(reglas.franja.valor)),
    });
  }
  for (const regla of reglas.reglasCalendario) {
    desglose.push({ etapa: 1, concepto: regla.nombre, tipo: regla.tipoCodigo, porcentaje: aPorcentaje(aMilesimas(regla.valor)) });
  }
  desglose.push(
    { etapa: 1, concepto: "Subtotal: base × (1 + recargos)", tipo: "SUBTOTAL", monto: dividirRedondeando(subtotal, ESCALA_SUBTOTAL) / 100 },
    { etapa: 2, concepto: historial.motivo, tipo: "DEMANDA", porcentaje: aPorcentaje(aMilesimas(historial.ajuste)) },
    {
      etapa: 3,
      concepto: rango ? rango.motivo : "Fuera del horario publicado: sin límites",
      tipo: "RANGO",
      monto: dividirRedondeando(acotado, ESCALA_AJUSTADO) / 100,
    }
  );
  if (reglas.frecuente) {
    desglose.push({ etapa: 4, concepto: reglas.frecuente.nombre, tipo: "CLIENTE_FRECUENTE", porcentaje: -aPorcentaje(milesimasDescuento) });
  }
  return desglose;
}

// Resumen de cuáles de las comparaciones 1 a 3 se cumplieron.
function resumirComparaciones({ franja, reglasCalendario, frecuente }) {
  const resumen = (t) => ({ nombre: t.nombre, tipo: t.tipoCodigo, valor: Number(t.valor) });
  return {
    franja: { aplicada: franja !== null, regla: franja ? resumen(franja) : null },
    calendario: { aplicada: reglasCalendario.length > 0, reglas: reglasCalendario.map(resumen) },
    clienteFrecuente: { aplicada: frecuente !== null, regla: frecuente ? resumen(frecuente) : null },
  };
}

// ---------------------------------------------------------------------------------------------
// Función principal.
// reserva: { fecha: "AAAA-MM-DD", horaInicio: "HH:MM", reservasConfirmadas30Dias: número,
//            historiales: [{ clave, nombre, ocupacion, muestras }] }   (historiales es opcional)
// tarifas: [{ tipoCodigo, nombre, valor, horaInicio, horaFin, diaSemana, fecha, minReservas }]
// ---------------------------------------------------------------------------------------------
export function calcularPrecio({ fecha, horaInicio, reservasConfirmadas30Dias = 0, historiales = [] }, tarifas) {
  if (!fechaValida(fecha)) throw new Error("Fecha inválida: se esperaba AAAA-MM-DD.");
  if (!horaValida(horaInicio)) throw new Error("Hora inválida: se esperaba HH:MM.");
  const reservas = Number(reservasConfirmadas30Dias);
  if (!Number.isFinite(reservas) || reservas < 0) {
    throw new Error("El número de reservas confirmadas debe ser un número válido.");
  }
  const hora = recortarHora(horaInicio);

  // ETAPA 1: subtotal = base × (1 + recargos), en centavos × 10³.
  const reglas = aplicarReglasTarifas({ fecha, hora, dia: diaSemanaDe(fecha), reservas }, tarifas);
  if (reglas.baseCentavos === null) throw new ErrorSinTarifaBase();
  const milesimasFranja = reglas.franja ? aMilesimas(reglas.franja.valor) : 0;
  const milesimasCalendario = reglas.reglasCalendario.reduce((suma, r) => suma + aMilesimas(r.valor), 0);
  const milesimasRecargos = milesimasFranja + milesimasCalendario;
  const milesimasDescuento = reglas.frecuente ? aMilesimas(reglas.frecuente.valor) : 0;
  const subtotal = reglas.baseCentavos * (1000 + milesimasRecargos);

  // ETAPA 2: ajustado = subtotal × (1 + ajuste por demanda), en centavos × 10⁶.
  const historial = contrastarHistorial(Array.isArray(historiales) ? historiales : []);
  const ajustado = subtotal * (1000 + aMilesimas(historial.ajuste));

  // ETAPA 3: el precio general se limita al rango publicado de su franja (antes del descuento).
  const { acotado, rango } = aplicarRango(ajustado, hora, historial.demandaMuyAlta);

  // ETAPA 4: precio = acotado × (1 − descuento), en centavos × 10⁹, y el ÚNICO redondeo a centavos.
  // Con el techo de $55 el mayor valor intermedio es 5 500 × 10⁶ × 1 000 ≈ 5.5 × 10¹², muy por
  // debajo de Number.MAX_SAFE_INTEGER (≈ 9 × 10¹⁵). Se comprueba igual por si cambian los rangos.
  const precioEscalado = acotado * (1000 - milesimasDescuento);
  if (!Number.isSafeInteger(precioEscalado)) throw new Error("El precio excede el rango de cálculo exacto.");
  const precioCentavos = dividirRedondeando(precioEscalado, ESCALA_PRECIO);

  return {
    precio: precioCentavos / 100,
    base: reglas.baseCentavos / 100,
    recargos: milesimasRecargos / 1000, // decimal: 0.35 = 35 %
    descuento: milesimasDescuento / 1000, // decimal: 0.1 = 10 %
    subtotal: dividirRedondeando(subtotal, ESCALA_SUBTOTAL) / 100,
    desglose: armarDesglose({ reglas, subtotal, historial, rango, acotado, milesimasDescuento }),
    comparaciones: resumirComparaciones(reglas),
    historial,
    rango,
    precioAntesDeDescuento: dividirRedondeando(acotado, ESCALA_AJUSTADO) / 100,
  };
}
