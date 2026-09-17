alter table catalog_images drop constraint catalog_images_status_check;
alter table catalog_images add constraint catalog_images_status_check
  check (status in ('pending', 'staged', 'ready', 'deleting'));
