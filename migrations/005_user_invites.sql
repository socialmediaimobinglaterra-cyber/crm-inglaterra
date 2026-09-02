alter type auth_audit_event_type add value if not exists 'invite_created';
alter type auth_audit_event_type add value if not exists 'invite_resent';
alter type auth_audit_event_type add value if not exists 'invite_revoked';
alter type auth_audit_event_type add value if not exists 'invite_accepted';

alter type auth_audit_reason add value if not exists 'invite_created_by_admin';
alter type auth_audit_reason add value if not exists 'invite_resent_by_admin';
alter type auth_audit_reason add value if not exists 'invite_revoked_by_admin';
alter type auth_audit_reason add value if not exists 'invite_accepted_by_user';

create table if not exists convites_usuario (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role usuario_role not null,
  token_hash text not null unique,
  invited_by uuid not null references usuarios(id),
  expires_at timestamptz not null,
  sent_at timestamptz,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  test_run_id text,
  constraint convites_usuario_email_lowercase check (email = lower(email)),
  constraint convites_usuario_email_domain check (email like '%@imobiliariainglaterra.com.br'),
  constraint convites_usuario_token_hash_hex check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint convites_usuario_not_used_and_revoked check (used_at is null or revoked_at is null)
);

create index if not exists convites_usuario_email_created_at_idx
  on convites_usuario (email, created_at desc);

create index if not exists convites_usuario_active_email_idx
  on convites_usuario (email, expires_at)
  where used_at is null and revoked_at is null;

create index if not exists convites_usuario_invited_by_idx
  on convites_usuario (invited_by, created_at desc);

create index if not exists convites_usuario_expires_at_idx
  on convites_usuario (expires_at);

create index if not exists convites_usuario_test_run_id_idx
  on convites_usuario (test_run_id)
  where test_run_id is not null;
