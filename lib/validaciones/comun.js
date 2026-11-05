// Validaciones pequeñas que comparten varios módulos (puras, sin alias "@/").

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ¿Es un uuid con formato válido? (id de usuario de Supabase Auth)
export function esUuid(valor) {
  return typeof valor === "string" && REGEX_UUID.test(valor);
}
