-- =============================================================================================
-- 004 — Retirar la tarifa CLIENTE_FRECUENTE
--
-- El descuento de cliente frecuente ya no es una tarifa: lo reemplazan las reglas del cliente
-- (tabla "reglasCliente", migración 003), que se evalúan en la etapa 4 del cálculo de precio.
--
-- ⚠ ORDEN DE DESPLIEGUE: ejecuta este script DESPUÉS de desplegar en producción el código nuevo.
--   El código nuevo ya ignora estas tarifas. Si se ejecuta antes, el sitio en producción (código
--   viejo) pierde el descuento de cliente frecuente.
--
-- Se ejecuta a mano en el SQL Editor de Supabase.
-- =============================================================================================

begin;

-- 1. Tarifas de tipo CLIENTE_FRECUENTE (el tipo se busca por código, no por id).
delete from "tarifas"
where "tipoId" in (select "id" from "tiposTarifa" where "codigo" = 'CLIENTE_FRECUENTE');

-- 2. El tipo CLIENTE_FRECUENTE del catálogo de tarifas.
delete from "tiposTarifa"
where "codigo" = 'CLIENTE_FRECUENTE';

commit;

-- Comprobación: tarifas que quedan, con su tipo.
select t."id", tt."codigo", t."nombre", t."valor"
from "tarifas" t
join "tiposTarifa" tt on tt."id" = t."tipoId"
order by t."id";
