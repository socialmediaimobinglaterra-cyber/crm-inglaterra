create table catalog_api_rate_limits (
  identifier_hash text not null check (identifier_hash ~ '^[a-f0-9]{64}$'),
  scope text not null check (scope in ('json', 'image')),
  window_start timestamptz not null,
  attempts integer not null check (attempts between 1 and 600),
  primary key (identifier_hash, scope)
);
create index catalog_api_rate_limits_expiry_idx on catalog_api_rate_limits(window_start);
