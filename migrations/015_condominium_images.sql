alter table catalog_images alter column imovel_id drop not null;
alter table catalog_images add column condominio_id uuid references condominios(id);
alter table catalog_images add constraint catalog_images_owner_check
  check (num_nonnulls(imovel_id, condominio_id) = 1);
alter table catalog_images add constraint catalog_images_condominium_position_key
  unique (condominio_id, position) deferrable initially deferred;
create unique index catalog_images_condominium_primary_idx
  on catalog_images(condominio_id) where is_primary;
create index catalog_images_condominium_idx
  on catalog_images(condominio_id, status, position);
