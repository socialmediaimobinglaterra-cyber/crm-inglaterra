create extension if not exists pgcrypto;

do $$ begin
  create type usuario_role as enum ('admin', 'cadastro');
exception
  when duplicate_object then null;
end $$;

create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role usuario_role not null default 'admin',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint usuarios_email_lowercase check (email = lower(email)),
  constraint usuarios_email_domain check (email like '%@imobiliariainglaterra.com.br')
);

create table if not exists codigos_login (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists codigos_login_email_created_at_idx
  on codigos_login (email, created_at desc);

create index if not exists codigos_login_valid_idx
  on codigos_login (email, expires_at)
  where used_at is null;
