// Validación de tarifas. Funciones puras (sin base de datos ni alias "@/"),
// para poder usarlas en el servidor y en las pruebas con `node --test`.
import { fechaValida, horaValida, recortarHora } from "../fechas.js";

// A qué comparación del Core pertenece cada tipo de tarifa.
// DIA_SEMANA y FECHA_ESPECIAL cuentan como un solo grupo ("calendario").
export const GRUPOS_CORE = {
  FRANJA_HORARIA: "franja",
  DIA_SEMANA: "calendario",
  FECHA_ESPECIAL: "calendario",
  CLIENTE_FRECUENTE: "clienteFrecuente",
};

export const NOMBRE_GRUPO = {
  franja: "franja horaria",
  calendario: "calendario (día de la semana o fecha especial)",
  clienteFrecuente: "cliente frecuente",
};

// Porcentaje escrito por el usuario (12.5) -> decimal guardado (0.125).
export function porcentajeADecimal(porcentaje) {
  return Math.round(porcentaje * 10) / 1000;
}

function esEnteroEn(valor, minimo, maximo) {
  return Number.isInteger(valor) && valor >= minimo && valor <= maximo;
}

// Convierte "12" o 12 en número; cualquier otra cosa da NaN.
function aNumero(crudo) {
  if (typeof crudo === "number") return crudo;
  if (typeof crudo === "string" && crudo.trim() !== "") return Number(crudo);
  return NaN;
}

// Estado de las 3 comparaciones del Core según las tarifas existentes.
// tarifas: cada una con "tipoCodigo" (o "codigo").
export function comparacionesActivas(tarifas) {
  const codigoDe = (t) => t.tipoCodigo ?? t.codigo;
  const grupos = new Set(tarifas.map((t) => GRUPOS_CORE[codigoDe(t)]).filter(Boolean));
  const estado = {
    franja: grupos.has("franja"),
    calendario: grupos.has("calendario"),
    clienteFrecuente: grupos.has("clienteFrecuente"),
    hayBase: tarifas.some((t) => codigoDe(t) === "BASE"),
  };
  estado.total = [estado.franja, estado.calendario, estado.clienteFrecuente].filter(Boolean).length;
  return estado;
}

// Devuelve el motivo por el que una tarifa NO se puede eliminar, o null si se puede.
// tarifas: todas las tarifas, cada una con "id" y "tipoCodigo" (o "codigo").
export function motivoNoEliminable(tarifa, tarifas) {
  const codigoDe = (t) => t.tipoCodigo ?? t.codigo;
  const codigo = codigoDe(tarifa);

  if (codigo === "BASE") {
    return "No puedes eliminar la tarifa base. Edita su valor en su lugar.";
  }

  const grupo = GRUPOS_CORE[codigo];
  if (grupo) {
    const hermanas = tarifas.filter(
      (t) => t.id !== tarifa.id && GRUPOS_CORE[codigoDe(t)] === grupo
    );
    if (hermanas.length === 0) {
      return (
        `No puedes eliminar la última regla de ${NOMBRE_GRUPO[grupo]}: ` +
        "el sistema necesita al menos una regla de cada tipo para calcular el precio. " +
        "Crea otra regla del mismo grupo antes de eliminar esta, o edítala."
      );
    }
  }
  return null;
}

// entrada: lo que manda el navegador (no es de fiar).
// tipoCodigo: código del tipo elegido (BASE, FRANJA_HORARIA, ...).
// existentes: tarifas ya guardadas, cada una con su "codigo" de tipo.
// idEditando: id de la tarifa que se está editando (para no compararla consigo misma).
// Devuelve { errores, datos }; "datos" solo trae los campos aprobados.
// El valor de recargos/descuentos se recibe en PORCENTAJE y sale en decimal.
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
  const dato = entrada && typeof entrada === "object" ? entrada : {};

  // ---- nombre
  const nombre = typeof dato.nombre === "string" ? dato.nombre.trim() : "";
  if (nombre.length < 1 || nombre.length > 60) {
    errores.push("El nombre es obligatorio y debe tener máximo 60 caracteres.");
  }
  datos.nombre = nombre;

  // ---- valor
  const valor = aNumero(dato.valor);
  if (tipoCodigo === "BASE") {
    // Dólares por hora: máximo 2 decimales.
    if (!Number.isFinite(valor) || Math.round(valor * 100) / 100 !== valor || valor <= 0 || valor > 1000) {
      errores.push("La tarifa base debe ser un valor en dólares mayor que 0, máximo 1000 y con máximo 2 decimales.");
    } else {
      datos.valor = valor;
    }
  } else if (tipoCodigo) {
    // Porcentaje: máximo 1 decimal, de 0 a 100. Se guarda como decimal.
    if (!Number.isFinite(valor) || Math.round(valor * 10) / 10 !== valor || valor < 0 || valor > 100) {
      errores.push("El porcentaje debe estar entre 0 y 100 y tener máximo 1 decimal (por ejemplo 12.5).");
    } else {
      datos.valor = porcentajeADecimal(valor);
    }
  }

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
      const { horaInicio, horaFin } = dato;
      if (!horaValida(horaInicio) || !horaValida(horaFin)) {
        errores.push("La hora de inicio y la hora de fin son obligatorias (formato HH:MM).");
        break;
      }
      const inicio = recortarHora(horaInicio);
      const fin = recortarHora(horaFin);
      if (inicio >= fin) {
        errores.push("La hora de inicio debe ser menor que la hora de fin.");
        break;
      }
      // El Core compara con "inicio <= hora <= fin" (ambos extremos incluidos),
      // por eso dos franjas que se tocan en un extremo también se consideran cruzadas.
      const choca = otras.find(
        (t) =>
          t.codigo === "FRANJA_HORARIA" &&
          inicio <= recortarHora(t.horaFin) &&
          recortarHora(t.horaInicio) <= fin
      );
      if (choca) {
        errores.push(
          `La franja se cruza con "${choca.nombre}" (${recortarHora(choca.horaInicio)} a ${recortarHora(choca.horaFin)}).`
        );
      }
      datos.horaInicio = inicio;
      datos.horaFin = fin;
      break;
    }

    case "DIA_SEMANA": {
      const dia = aNumero(dato.diaSemana);
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
      if (!fechaValida(dato.fecha)) {
        errores.push("La fecha es obligatoria y debe ser válida (formato AAAA-MM-DD).");
        break;
      }
      if (otras.some((t) => t.codigo === "FECHA_ESPECIAL" && t.fecha === dato.fecha)) {
        errores.push("Ya existe una regla para esa fecha.");
      }
      datos.fecha = dato.fecha;
      break;
    }

    case "CLIENTE_FRECUENTE": {
      const minimo = aNumero(dato.minReservas);
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
