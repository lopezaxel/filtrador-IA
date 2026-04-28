-- ═══════════════════════════════════════════════════
-- FILTRADOR IA — Schema Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ═══════════════════════════════════════════════════

-- 1. Organizaciones (un cliente = una org)
create table organizations (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  plan             text not null default 'trial', -- trial | active | inactive
  whop_membership_id text,
  trial_expires_at timestamptz,
  created_at       timestamptz default now()
);

-- 2. Perfiles de usuario (extiende auth.users de Supabase)
create table user_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  org_id     uuid references organizations(id) on delete cascade,
  role       text not null default 'client', -- admin | client
  status     text not null default 'active', -- active | inactive
  created_at timestamptz default now()
);

-- 3. Proveedores por organización
create table providers (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid references organizations(id) on delete cascade,
  name       text not null,
  created_at timestamptz default now()
);

-- 4. Palabras clave por proveedor
create table keywords (
  id          uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id) on delete cascade,
  word        text not null
);

-- 5. Palabras clave base por organización
create table base_keywords (
  id     uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  word   text not null
);

-- ═══════════════════════════════════════════════════
-- Row Level Security (RLS)
-- ═══════════════════════════════════════════════════

alter table organizations  enable row level security;
alter table user_profiles  enable row level security;
alter table providers      enable row level security;
alter table keywords       enable row level security;
alter table base_keywords  enable row level security;

-- user_profiles: cada usuario ve solo su propio perfil
create policy "user_profiles_own" on user_profiles
  for all using (auth.uid() = id);

-- organizations: usuario ve solo su org
create policy "organizations_own" on organizations
  for all using (
    id in (
      select org_id from user_profiles where id = auth.uid()
    )
  );

-- providers: usuario ve solo los de su org
create policy "providers_own" on providers
  for all using (
    org_id in (
      select org_id from user_profiles where id = auth.uid()
    )
  );

-- keywords: usuario ve solo las de sus proveedores
create policy "keywords_own" on keywords
  for all using (
    provider_id in (
      select p.id from providers p
      join user_profiles up on up.org_id = p.org_id
      where up.id = auth.uid()
    )
  );

-- base_keywords: usuario ve solo las de su org
create policy "base_keywords_own" on base_keywords
  for all using (
    org_id in (
      select org_id from user_profiles where id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════
-- Admin inicial (ejecutar UNA VEZ después de crear
-- tu usuario en Supabase Auth)
-- Reemplazá 'TU-USER-ID' con tu UUID de auth.users
-- ═══════════════════════════════════════════════════

-- insert into organizations (id, name, plan)
--   values ('00000000-0000-0000-0000-000000000001', 'ADMIN', 'active');

-- insert into user_profiles (id, org_id, role, status)
--   values ('TU-USER-ID', '00000000-0000-0000-0000-000000000001', 'admin', 'active');
