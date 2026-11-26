// CORE de Ponceano Soccer: cálculo del precio de una reserva, en 4 etapas.
//
// Función PURA: no toca la base de datos, no lee la hora del servidor ni depende de su zona
// horaria. Todo llega por parámetros (tarifas, historiales, reglas y datos del cliente los prepara
// servicioPrecio.js).
//
//   ETAPA 1  Reglas de tarifas       subtotal = base × (1 + recargos)            comparaciones 1 y 2
//   ETAPA 2  Historial               ajustado = subtotal × (1 + ajuste)          comparaciones 3 y 4
//   ETAPA 3  Rango publicado         acotado  = ajustado limitado a [mínimo, máximo] de su franja
//   ETAPA 4  Beneficios del cliente  precio   = acotado × (1 − descuento)        comparación 5
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
// ETAPA 1. Reglas de tarifas: un solo recorrido por la lista; aquí ocurren las comparaciones 1 y 2.
// ---------------------------------------------------------------------------------------------
function aplicarReglasTarifas({ fecha, hora, dia }, tarifas) {
  let baseCentavos = null;
  let franja = null; // regla de franja horaria que cubre la hora (o null)
  const reglasCalendario = []; // reglas de día de la semana / fecha especial que aplican

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

      default:
        // Tipo desconocido: se ignora. Así también se ignoran las tarifas CLIENTE_FRECUENTE que queden
        // en la base hasta ejecutar la migración 004 (ese beneficio ahora vive en la etapa 4).
        break;
    }
  });

  return { baseCentavos, franja, reglasCalendario };
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
    // COMPARACIÓN 3 (historial ANTIGUO, 3 años) y COMPARACIÓN 4 (historial ACTUAL, últimas semanas):
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
// ETAPA 4. Beneficios del cliente (reglas de fidelidad).
// ---------------------------------------------------------------------------------------------

// ¿La regla está vigente en la fecha? Las fechas AAAA-MM-DD se comparan bien como texto.
export function reglaVigente(regla, fecha) {
  if (regla.vigenteDesde && fecha < regla.vigenteDesde) return false;
  if (regla.vigenteHasta && fecha > regla.vigenteHasta) return false;
  return true;
}

const textoReservas = (n) => (n === 1 ? "1 reserva confirmada" : `${n} reservas confirmadas`);
const textoDias = (n) => (n === 1 ? "1 día" : `${n} días`);

// Condición propia de cada tipo de regla. Devuelve { aplica, motivo }.
function cumpleCondicion(regla, cliente, historial) {
  switch (regla.tipoCodigo) {
    case "TARJETA_SELLOS": {
      const aplica = cliente.confirmadasDesdeUltimoSello >= regla.cadaReservas;
      const motivo = `${textoReservas(cliente.confirmadasDesdeUltimoSello)} desde el último sello (se necesitan ${regla.cadaReservas})`;
      return { aplica, motivo };
    }
    case "BIENVENIDA": {
      const aplica = cliente.reservasPrevias === 0;
      return { aplica, motivo: aplica ? "Primera reserva del cliente" : `El cliente ya tiene ${cliente.reservasPrevias} reservas` };
    }
    case "RESERVA_ANTICIPADA": {
      const aplica = cliente.diasAnticipacion >= regla.diasAnticipacion;
      const motivo = `${textoDias(cliente.diasAnticipacion)} de anticipación (se necesitan ${regla.diasAnticipacion})`;
      return { aplica, motivo };
    }
    case "HORARIO_VALLE": {
      // El Core ya sabe qué horarios están vacíos (etapa 2): esta regla convierte ese dato en un
      // incentivo para el cliente. Aplica con demanda baja o muy baja (ajuste negativo).
      const aplica = historial.ajuste < 0;
      return { aplica, motivo: aplica ? "La etapa 2 detectó demanda baja en este horario" : "El horario no es de baja demanda" };
    }
    default:
      return { aplica: false, motivo: "Tipo de regla desconocido" };
  }
}

// La regla aplica si está activa, está vigente en la fecha de la reserva y cumple su condición.
function evaluarRegla(regla, { fecha, cliente, historial }) {
  if (!regla.activa) return { aplica: false, motivo: "Regla inactiva" };
  if (!reglaVigente(regla, fecha)) return { aplica: false, motivo: "Fuera de vigencia en la fecha de la reserva" };
  return cumpleCondicion(regla, cliente, historial);
}

// De las reglas que aplican, la de mayor descuento; en empate, la de menor id (o null).
function elegirMayorDescuento(evaluadas) {
  let mejor = null;
  for (const regla of evaluadas) {
    if (!regla.aplica) continue;
    const mayor = mejor === null || regla.milesimas > mejor.milesimas;
    const empataConMenorId = mejor !== null && regla.milesimas === mejor.milesimas && regla.id < mejor.id;
    if (mayor || empataConMenorId) mejor = regla;
  }
  return mejor;
}

// cliente: { reservasPrevias, confirmadasDesdeUltimoSello, diasAnticipacion }, o null ("Sin cliente").
function evaluarBeneficios({ fecha, cliente, historial }, reglasCliente) {
  // Sin cliente no hay a quién darle el descuento: no se evalúa ninguna regla.
  if (cliente === null) return { evaluadas: [], aplicada: null, milesimas: 0 };

  const evaluadas = [];
  reglasCliente.forEach((regla) => {
    // COMPARACIÓN 5: ¿el cliente cumple esta regla de fidelidad?
    const { aplica, motivo } = evaluarRegla(regla, { fecha, cliente, historial });
    const milesimas = aMilesimas(regla.descuento);
    evaluadas.push({ id: regla.id, nombre: regla.nombre, tipoCodigo: regla.tipoCodigo, milesimas, aplica, motivo });
  });

  // Los descuentos NO se acumulan: se usa solo el mayor. Así nadie suma sellos, bienvenida y
  // reserva anticipada para pagar la mitad.
  const mejor = elegirMayorDescuento(evaluadas);
  const publica = ({ milesimas, ...resto }) => ({ ...resto, descuento: milesimas / 1000 });
  return {
    evaluadas: evaluadas.map(publica),
    aplicada: mejor ? { id: mejor.id, nombre: mejor.nombre, descuento: mejor.milesimas / 1000 } : null,
    milesimas: mejor ? mejor.milesimas : 0,
  };
}

// ---------------------------------------------------------------------------------------------
// Desglose paso a paso, en el orden de las etapas (para mostrarlo en la calculadora).
// Cada línea lleva "monto" (dólares) o "porcentaje".
// ---------------------------------------------------------------------------------------------
function armarDesglose({ reglas, subtotal, historial, rango, acotado, aplicada }) {
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
  if (aplicada) {
    desglose.push({ etapa: 4, concepto: aplicada.nombre, tipo: "BENEFICIO", porcentaje: -aPorcentaje(aMilesimas(aplicada.descuento)) });
  }
  return desglose;
}

// Resumen de cuáles de las comparaciones 1 y 2 se cumplieron.
function resumirComparaciones({ franja, reglasCalendario }) {
  const resumen = (t) => ({ nombre: t.nombre, tipo: t.tipoCodigo, valor: Number(t.valor) });
  return {
    franja: { aplicada: franja !== null, regla: franja ? resumen(franja) : null },
    calendario: { aplicada: reglasCalendario.length > 0, reglas: reglasCalendario.map(resumen) },
  };
}

// Los datos del cliente los cuenta el servicio: deben ser enteros (o cliente null).
function validarCliente(cliente) {
  if (cliente === null || cliente === undefined) return null;
  const { reservasPrevias, confirmadasDesdeUltimoSello, diasAnticipacion } = cliente;
  if (![reservasPrevias, confirmadasDesdeUltimoSello, diasAnticipacion].every(Number.isInteger)) {
    throw new Error("Los datos del cliente deben ser números enteros.");
  }
  return { reservasPrevias, confirmadasDesdeUltimoSello, diasAnticipacion };
}

// ---------------------------------------------------------------------------------------------
// Función principal.
// reserva: { fecha: "AAAA-MM-DD", horaInicio: "HH:MM",
//            historiales: [{ clave, nombre, ocupacion, muestras }],                 (opcional)
//            cliente: { reservasPrevias, confirmadasDesdeUltimoSello, diasAnticipacion } | null }
// tarifas: [{ tipoCodigo, nombre, valor, horaInicio, horaFin, diaSemana, fecha }]
// reglasCliente: [{ id, tipoCodigo, nombre, descuento, cadaReservas, diasAnticipacion, activa,
//                   vigenteDesde, vigenteHasta }]                                   (opcional)
// ---------------------------------------------------------------------------------------------
export function calcularPrecio({ fecha, horaInicio, historiales = [], cliente = null }, tarifas, reglasCliente = []) {
  if (!fechaValida(fecha)) throw new Error("Fecha inválida: se esperaba AAAA-MM-DD.");
  if (!horaValida(horaInicio)) throw new Error("Hora inválida: se esperaba HH:MM.");
  const datosCliente = validarCliente(cliente);
  const hora = recortarHora(horaInicio);

  // ETAPA 1: subtotal = base × (1 + recargos), en centavos × 10³.
  const reglas = aplicarReglasTarifas({ fecha, hora, dia: diaSemanaDe(fecha) }, tarifas);
  if (reglas.baseCentavos === null) throw new ErrorSinTarifaBase();
  const milesimasFranja = reglas.franja ? aMilesimas(reglas.franja.valor) : 0;
  const milesimasCalendario = reglas.reglasCalendario.reduce((suma, r) => suma + aMilesimas(r.valor), 0);
  const milesimasRecargos = milesimasFranja + milesimasCalendario;
  const subtotal = reglas.baseCentavos * (1000 + milesimasRecargos);

  // ETAPA 2: ajustado = subtotal × (1 + ajuste por demanda), en centavos × 10⁶.
  const historial = contrastarHistorial(Array.isArray(historiales) ? historiales : []);
  const ajustado = subtotal * (1000 + aMilesimas(historial.ajuste));

  // ETAPA 3: el precio general se limita al rango publicado de su franja (antes del descuento).
  const { acotado, rango } = aplicarRango(ajustado, hora, historial.demandaMuyAlta);

  // ETAPA 4: beneficios del cliente; se aplica solo el mayor descuento de las reglas que cumple.
  const listaReglas = Array.isArray(reglasCliente) ? reglasCliente : [];
  const { evaluadas, aplicada, milesimas: milesimasDescuento } = evaluarBeneficios(
    { fecha, cliente: datosCliente, historial },
    listaReglas
  );

  // precio = acotado × (1 − descuento), en centavos × 10⁹, y el ÚNICO redondeo a centavos.
  // Con el techo de $55 el mayor valor intermedio es 5 500 × 10⁶ × 1 000 ≈ 5.5 × 10¹², muy por
  // debajo de Number.MAX_SAFE_INTEGER (≈ 9 × 10¹⁵). Se comprueba igual por si cambian los rangos.
  const precioEscalado = acotado * (1000 - milesimasDescuento);
  if (!Number.isSafeInteger(precioEscalado)) throw new Error("El precio excede el rango de cálculo exacto.");
  const precioCentavos = dividirRedondeando(precioEscalado, ESCALA_PRECIO);

  return {
    precio: precioCentavos / 100,
    base: reglas.baseCentavos / 100,
    recargos: milesimasRecargos / 1000, // decimal: 0.35 = 35 %
    descuento: milesimasDescuento / 1000, // decimal: el de la regla aplicada (0.15 = 15 %), o 0
    subtotal: dividirRedondeando(subtotal, ESCALA_SUBTOTAL) / 100,
    desglose: armarDesglose({ reglas, subtotal, historial, rango, acotado, aplicada }),
    comparaciones: resumirComparaciones(reglas),
    historial,
    rango,
    beneficios: { evaluadas, aplicada },
    precioAntesDeDescuento: dividirRedondeando(acotado, ESCALA_AJUSTADO) / 100,
  };
}
