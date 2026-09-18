create table catalog_image_pilot (
  imovel_id uuid not null references imoveis(id),
  slot smallint not null check (slot between 1 and 3),
  source_url text not null check (length(source_url) between 1 and 4096),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  image_id uuid references catalog_images(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','working','done','failed')),
  attempt_id uuid,
  attempts smallint not null default 0 check (attempts between 0 and 3),
  claimed_at timestamptz,
  primary key (imovel_id,slot),
  unique (imovel_id,source_hash)
);
