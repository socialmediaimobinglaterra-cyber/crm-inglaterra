alter type auth_audit_event_type add value if not exists 'user_activated';
alter type auth_audit_event_type add value if not exists 'user_deactivated';
alter type auth_audit_event_type add value if not exists 'user_role_changed';

alter type auth_audit_reason add value if not exists 'user_activated_by_admin';
alter type auth_audit_reason add value if not exists 'user_deactivated_by_admin';
alter type auth_audit_reason add value if not exists 'user_role_changed_by_admin';

alter table auth_audit_events
  add column if not exists target_usuario_id uuid references usuarios(id);

create index if not exists auth_audit_events_target_usuario_idx
  on auth_audit_events (target_usuario_id, created_at desc)
  where target_usuario_id is not null;
