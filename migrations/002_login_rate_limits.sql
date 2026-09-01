create table if not exists login_rate_limit_attempts (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('email', 'ip')),
  identifier_hash text not null,
  allowed boolean not null default false,
  test_run_id text,
  created_at timestamptz not null default now(),
  constraint login_rate_limit_identifier_hash_hex check (identifier_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists login_rate_limit_attempts_lookup_idx
  on login_rate_limit_attempts (scope, identifier_hash, created_at desc);

create index if not exists login_rate_limit_attempts_created_at_idx
  on login_rate_limit_attempts (created_at);

create index if not exists login_rate_limit_attempts_test_run_id_idx
  on login_rate_limit_attempts (test_run_id)
  where test_run_id is not null;
