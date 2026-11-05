-- ============================================================================
-- Ponceano Soccer — esquema consolidado de la base de datos (Supabase / PostgreSQL)
--
-- Es la documentación del esquema. La base real ya fue creada a mano; este archivo
-- se reconstruyó a partir de su descripción, así que, antes de ejecutarlo en un
-- proyecto NUEVO, revísalo. En el proyecto actual NO hace falta ejecutarlo:
-- solo ejecuta las migraciones de supabase/migraciones/ que falten.
--
-- Los nombres van en camelCase entre comillas dobles, tal como los usa el código.
-- ============================================================================

-- ---------- Enumerados
do $$ begin
  create type "rolUsuario" as enum ('ADMINISTRADOR', 'RECEPCIONISTA', 'CLIENTE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type "estadoReserva" as enum ('PENDIENTE', 'CONFIRMADA', 'CANCELADA');
exception when duplicate_object then null; end $$;

-- ---------- Tipos de tarifa (catálogo)
create table if not exists "tiposTarifa" (
  "id"                  bigint generated always as identity primary key,
  "codigo"              text not null unique,
  "nombre"              text not null,
  "fechaCreacion"       timestamptz not null default now(),
  "fechaActualizacion"  timestamptz not null default now()
);

-- ---------- Usuarios (el id es el mismo de Supabase Auth; la contraseña vive en Auth)
create table if not exists "usuarios" (
  "id"                  uuid primary key references auth.users ("id") on delete cascade,
  "correo"              text not null unique,
  "nombre"              text not null,
  "apellido"            text not null,
  "rol"                 "rolUsuario" not null default 'CLIENTE',
  "fechaCreacion"       timestamptz not null default now(),
  "fechaActualizacion"  timestamptz not null default now()
);

-- ---------- Tarifas (las reglas que recorre el Core)
-- "valor": para BASE son dólares por hora (ej. 40.00);
--          para el resto es un decimal (0.25 = 25 %, 0.125 = 12.5 %).
create table if not exists "tarifas" (
  "id"                  bigint generated always as identity primary key,
  "tipoId"              bigint not null references "tiposTarifa" ("id"),
  "nombre"              text not null,
  "valor"               numeric(7, 3) not null check ("valor" >= 0),
  "horaInicio"          time,
  "horaFin"             time,
  "diaSemana"           smallint check ("diaSemana" between 0 and 6),
  "fecha"               date,
  "minReservas"         integer check ("minReservas" >= 1),
  "fechaCreacion"       timestamptz not null default now(),
  "fechaActualizacion"  timestamptz not null default now(),
  check ("horaInicio" < "horaFin")
);

-- ---------- Reservas
create table if not exists "reservas" (
  "id"                  bigint generated always as identity primary key,
  "codigo"              text not null unique,
  "fecha"               date not null,
  "horaInicio"          time not null,
  "estado"              "estadoReserva" not null default 'PENDIENTE',
  "precio"              numeric(8, 2) not null check ("precio" >= 0),
  "clienteId"           uuid not null references "usuarios" ("id"),
  "fechaCreacion"       timestamptz not null default now(),
  "fechaActualizacion"  timestamptz not null default now()
);

-- Un horario no puede tener dos reservas activas (las canceladas liberan el horario).
create unique index if not exists "reservas_horario_unico"
  on "reservas" ("fecha", "horaInicio")
  where "estado" <> 'CANCELADA';

-- Solo puede existir UNA tarifa base (tipoId = 1). Es la migración 001.
create unique index if not exists "tarifas_una_sola_base"
  on "tarifas" ("tipoId")
  where "tipoId" = 1;

-- ---------- Seguridad: RLS activado SIN políticas y sin permisos para anon/authenticated.
-- Solo el servidor (llave secret) puede leer y escribir. NO agregues políticas públicas.
alter table "tiposTarifa" enable row level security;
alter table "usuarios"    enable row level security;
alter table "tarifas"     enable row level security;
alter table "reservas"    enable row level security;

revoke all on "tiposTarifa", "usuarios", "tarifas", "reservas" from anon, authenticated;
