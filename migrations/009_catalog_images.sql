create table catalog_images (
  id uuid primary key,
  imovel_id uuid not null references imoveis(id),
  status text not null check (status in ('pending','ready','deleting')),
  position integer check (position >= 0),
  is_primary boolean not null default false,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  bytes integer not null check (bytes > 0),
  created_at timestamptz not null default clock_timestamp(),
  cleanup_at timestamptz,
  check (status = 'ready' or (position is null and not is_primary)),
  check (status <> 'ready' or position is not null),
  unique (imovel_id, position) deferrable initially deferred
);
create unique index catalog_images_primary_idx on catalog_images(imovel_id) where is_primary;
create index catalog_images_property_idx on catalog_images(imovel_id,status,position);
create index catalog_images_cleanup_idx on catalog_images(status,created_at) where status <> 'ready';
