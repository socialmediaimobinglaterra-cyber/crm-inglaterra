create unique index imoveis_codigo_unique on imoveis (upper(codigo));
alter table imoveis add column curadoria_privada jsonb not null default '{}'::jsonb check (jsonb_typeof(curadoria_privada) = 'object');

create table catalog_code_reservations (
  codigo text primary key check (codigo = upper(codigo)),
  owner_id uuid not null unique
);
insert into catalog_code_reservations (codigo, owner_id) select upper(codigo), id from imoveis;

create table catalog_code_counters (
  prefix text primary key check (prefix ~ '^[A-Z]{2}$'),
  last_number bigint not null check (last_number >= 0)
);
insert into catalog_code_counters (prefix, last_number)
select substring(codigo from '^([A-Z]{2})'), max(substring(codigo from '([0-9]+)$')::bigint)
from catalog_code_reservations where codigo ~ '^[A-Z]{2}[0-9]{1,15}$' group by 1;

-- Reservations survive deletion: a public reference is never reassigned.
create function reserve_catalog_code(p_owner uuid, p_requested text, p_prefix text)
returns text language plpgsql as $$
declare result text; next_number bigint;
begin
  perform pg_advisory_xact_lock(91491002);
  select codigo into result from catalog_code_reservations where owner_id = p_owner;
  if found then return result; end if;
  if p_requested is not null then
    if length(p_requested) not between 1 and 128 or p_requested !~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$' then
      raise exception 'INVALID_CATALOG_CODE';
    end if;
    insert into catalog_code_reservations(codigo, owner_id) values (upper(p_requested), p_owner)
    on conflict (codigo) do nothing returning codigo into result;
    if found then
      if result ~ '^[A-Z]{2}[0-9]{1,15}$' then
        insert into catalog_code_counters(prefix,last_number)
        values (left(result,2),substring(result from '([0-9]+)$')::bigint)
        on conflict (prefix) do update set last_number=greatest(catalog_code_counters.last_number,excluded.last_number);
      end if;
      return result;
    end if;
  end if;
  if p_prefix is null or p_prefix !~ '^[A-Z]{2}$' then raise exception 'UNKNOWN_CATALOG_PREFIX'; end if;
  loop
    insert into catalog_code_counters(prefix,last_number) values(p_prefix,1)
    on conflict(prefix) do update set last_number=catalog_code_counters.last_number+1
    returning last_number into next_number;
    result := p_prefix || lpad(next_number::text, greatest(4,length(next_number::text)), '0');
    insert into catalog_code_reservations(codigo,owner_id) values(result,p_owner)
    on conflict(codigo) do nothing;
    if found then return result; end if;
  end loop;
end;
$$;
