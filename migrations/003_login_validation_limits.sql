alter table codigos_login
  add column if not exists failed_attempts integer not null default 0,
  add column if not exists invalidated_at timestamptz;

create table if not exists login_validation_rate_limit_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  allowed boolean not null default false,
  test_run_id text,
  created_at timestamptz not null default now(),
  constraint login_validation_rate_limit_ip_hash_hex check (ip_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists login_validation_rate_limit_lookup_idx
  on login_validation_rate_limit_attempts (ip_hash, created_at desc);

create index if not exists login_validation_rate_limit_created_at_idx
  on login_validation_rate_limit_attempts (created_at);

create index if not exists login_validation_rate_limit_test_run_id_idx
  on login_validation_rate_limit_attempts (test_run_id)
  where test_run_id is not null;
