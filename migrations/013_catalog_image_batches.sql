-- Preserve pilot receipts so transferred or removed photos are never imported again.
alter table catalog_image_pilot drop constraint catalog_image_pilot_slot_check;
alter table catalog_image_pilot add check (slot between 1 and 1000);
alter table catalog_image_pilot
  add column downloaded_bytes bigint not null default 0 check (downloaded_bytes >= 0),
  add column stored_bytes bigint not null default 0 check (stored_bytes >= 0),
  add column last_error text check (last_error in ('download','image','storage','finalize'));

create table catalog_image_batches (
  id uuid primary key,
  imovel_id uuid not null references imoveis(id),
  created_by uuid not null references usuarios(id),
  photo_limit smallint not null check (photo_limit between 1 and 10),
  created_at timestamptz not null default clock_timestamp(),
  unique (id, imovel_id)
);
create index catalog_image_batches_recent on catalog_image_batches(created_at desc, id);
create index catalog_image_batches_property on catalog_image_batches(imovel_id);
create table catalog_image_batch_items (
  batch_id uuid not null,
  imovel_id uuid not null,
  slot smallint not null,
  primary key (batch_id, slot),
  unique (imovel_id, slot),
  foreign key (batch_id, imovel_id) references catalog_image_batches(id, imovel_id),
  foreign key (imovel_id, slot) references catalog_image_pilot(imovel_id, slot)
);
