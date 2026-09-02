do $$ begin
  create type auth_audit_event_type as enum (
    'login_success',
    'login_rejected',
    'rate_limit_blocked',
    'logout'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type auth_audit_reason as enum (
    'code_consumed',
    'invalid_credentials',
    'request_rate_limited',
    'validation_rate_limited',
    'user_logout'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists auth_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type auth_audit_event_type not null,
  usuario_id uuid references usuarios(id),
  email_hash text,
  ip inet,
  user_agent varchar(512) not null default '',
  reason auth_audit_reason not null,
  dedupe_key text,
  test_run_id text,
  created_at timestamptz not null default now(),
  constraint auth_audit_email_hash_hex check (email_hash is null or email_hash ~ '^[0-9a-f]{64}$'),
  constraint auth_audit_dedupe_key_hex check (dedupe_key is null or dedupe_key ~ '^[0-9a-f]{64}$'),
  constraint auth_audit_known_user_or_email_hash check (usuario_id is not null or email_hash is not null)
);

create unique index if not exists auth_audit_events_dedupe_key_idx
  on auth_audit_events (dedupe_key)
  where dedupe_key is not null;

create index if not exists auth_audit_events_usuario_idx
  on auth_audit_events (usuario_id, created_at desc);

create index if not exists auth_audit_events_type_idx
  on auth_audit_events (event_type, created_at desc);

create index if not exists auth_audit_events_ip_idx
  on auth_audit_events (ip, created_at desc);

create index if not exists auth_audit_events_created_at_idx
  on auth_audit_events (created_at);

create index if not exists auth_audit_events_test_run_id_idx
  on auth_audit_events (test_run_id)
  where test_run_id is not null;

create or replace function prevent_auth_audit_events_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'auth_audit_events are immutable';
end;
$$;

drop trigger if exists auth_audit_events_prevent_update on auth_audit_events;

create trigger auth_audit_events_prevent_update
before update on auth_audit_events
for each row execute function prevent_auth_audit_events_update();
