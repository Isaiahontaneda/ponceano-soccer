const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

const recortarHora = (hora) => hora.slice(0, 5);

function fechaValida(texto) {
  if (!REGEX_FECHA.test(texto)) return false;
  const fecha = new Date(texto + "T00:00:00Z");
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
}

function esEnteroEn(valor, minimo, maximo) {
  return Number.isInteger(valor) && valor >= minimo && valor <= maximo;
}

// entrada: lo que manda el navegador (no es de fiar).
// tipoCodigo: código del tipo elegido (BASE, FRANJA_HORARIA, ...).
// existentes: tarifas ya guardadas, cada una con su "codigo" de tipo.
// idEditando: id de la tarifa que se está editando (para no compararla consigo misma).
export function validarTarifa(entrada, tipoCodigo, existentes, idEditando = null) {
  const errores = [];
  const datos = {
    nombre: "",
    valor: 0,
    horaInicio: null,
    horaFin: null,
    diaSemana: null,
    fecha: null,
    minReservas: null,
  };

  // ---- nombre
  const nombre = typeof entrada.nombre === "string" ? entrada.nombre.trim() : "";
  if (nombre.length < 1 || nombre.length > 60) {
    errores.push("El nombre es obligatorio y debe tener máximo 60 caracteres.");
  }
  datos.nombre = nombre;

  // ---- valor
  const valorCrudo = entrada.valor;
  const valorEsTexto = typeof valorCrudo === "string" && valorCrudo.trim() !== "";
  const valor = typeof valorCrudo === "number" || valorEsTexto ? Number(valorCrudo) : NaN;

  if (!Number.isFinite(valor) || Math.round(valor * 1000) / 1000 !== valor) {
    errores.push("El valor debe ser un número con máximo 3 decimales.");
  } else if (tipoCodigo === "BASE") {
    if (valor <= 0 || valor > 1000) {
      errores.push("La tarifa base debe ser mayor que 0 y máximo 1000.");
    }
  } else if (valor < 0 || valor > 1) {
    errores.push("El valor de un recargo o descuento debe estar entre 0 y 1 (0.25 equivale a 25 %).");
  }
  datos.valor = valor;

  // ---- campos según el tipo (los que no corresponden se guardan como null)
  const otras = existentes.filter((t) => t.id !== idEditando);

  switch (tipoCodigo) {
    case "BASE": {
      if (otras.some((t) => t.codigo === "BASE")) {
        errores.push("Ya existe una tarifa base. Edítala en lugar de crear otra.");
      }
      break;
    }

    case "FRANJA_HORARIA": {
      const { horaInicio, horaFin } = entrada;
      if (
        typeof horaInicio !== "string" || !REGEX_HORA.test(horaInicio) ||
        typeof horaFin !== "string" || !REGEX_HORA.test(horaFin)
      ) {
        errores.push("La hora de inicio y la hora de fin son obligatorias (formato HH:MM).");
        break;
      }
      const inicio = recortarHora(horaInicio);
      const fin = recortarHora(horaFin);
      if (inicio >= fin) {
        errores.push("La hora de inicio debe ser menor que la hora de fin.");
        break;
      }
      const choca = otras.find(
        (t) =>
          t.codigo === "FRANJA_HORARIA" &&
          inicio < recortarHora(t.horaFin) &&
          recortarHora(t.horaInicio) < fin
      );
      if (choca) {
        errores.push(`La franja se cruza con "${choca.nombre}" (${recortarHora(choca.horaInicio)} a ${recortarHora(choca.horaFin)}).`);
      }
      datos.horaInicio = inicio;
      datos.horaFin = fin;
      break;
    }

    case "DIA_SEMANA": {
      const dia = typeof entrada.diaSemana === "string" && entrada.diaSemana.trim() !== ""
        ? Number(entrada.diaSemana)
        : entrada.diaSemana;
      if (!esEnteroEn(dia, 0, 6)) {
        errores.push("El día de la semana debe ser un número entero de 0 (domingo) a 6 (sábado).");
        break;
      }
      if (otras.some((t) => t.codigo === "DIA_SEMANA" && t.diaSemana === dia)) {
        errores.push("Ya existe una regla para ese día de la semana.");
      }
      datos.diaSemana = dia;
      break;
    }

    case "FECHA_ESPECIAL": {
      if (typeof entrada.fecha !== "string" || !fechaValida(entrada.fecha)) {
        errores.push("La fecha es obligatoria y debe ser válida (formato AAAA-MM-DD).");
        break;
      }
      if (otras.some((t) => t.codigo === "FECHA_ESPECIAL" && t.fecha === entrada.fecha)) {
        errores.push("Ya existe una regla para esa fecha.");
      }
      datos.fecha = entrada.fecha;
      break;
    }

    case "CLIENTE_FRECUENTE": {
      const minimo = typeof entrada.minReservas === "string" && entrada.minReservas.trim() !== ""
        ? Number(entrada.minReservas)
        : entrada.minReservas;
      if (!esEnteroEn(minimo, 1, 1000)) {
        errores.push("El mínimo de reservas debe ser un número entero mayor o igual a 1.");
        break;
      }
      datos.minReservas = minimo;
      break;
    }

    default:
      errores.push("Tipo de tarifa no reconocido.");
  }

  return { errores, datos };
}