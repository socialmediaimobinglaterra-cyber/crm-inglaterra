create table catalog_sources (
  key text primary key check (key ~ '^[a-zA-Z][a-zA-Z0-9_.:-]{0,79}$'),
  adapter text not null,
  last_success_started_at timestamptz,
  created_at timestamptz not null default now()
);

create table sincronizacoes_log (
  id uuid primary key default gen_random_uuid(),
  source_key text not null references catalog_sources(key),
  status text not null check (status in ('running', 'success', 'failed')),
  iniciada_em timestamptz not null default clock_timestamp(),
  finalizada_em timestamptz,
  total_xml integer not null default 0 check (total_xml >= 0),
  entraram integer not null default 0 check (entraram >= 0),
  atualizados integer not null default 0 check (atualizados >= 0),
  inalterados integer not null default 0 check (inalterados >= 0),
  ausentes integer not null default 0 check (ausentes >= 0),
  protegidos integer not null default 0 check (protegidos >= 0),
  resumo jsonb not null default '{}'::jsonb check (jsonb_typeof(resumo) = 'object'),
  failure_code text check (failure_code ~ '^[A-Z_]{1,80}$')
);
create index sincronizacoes_source_started_idx on sincronizacoes_log(source_key, iniciada_em desc);

create table bairros (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cidade text not null,
  estado text not null check (estado in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  descricao text,
  faq jsonb not null default '[]'::jsonb check (jsonb_typeof(faq) = 'array'),
  unique(nome, cidade, estado)
);

create table condominios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  sobre text,
  bairro_id uuid references bairros(id),
  endereco_privado jsonb not null default '{}'::jsonb check (jsonb_typeof(endereco_privado) = 'object'),
  galeria jsonb not null default '[]'::jsonb check (jsonb_typeof(galeria) = 'array'),
  ativo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lancamentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  sobre text,
  bairro_id uuid references bairros(id),
  endereco_privado jsonb not null default '{}'::jsonb check (jsonb_typeof(endereco_privado) = 'object'),
  galeria jsonb not null default '[]'::jsonb check (jsonb_typeof(galeria) = 'array'),
  ativo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table imoveis (
  id uuid primary key default gen_random_uuid(),
  codigo text not null check (length(codigo) between 1 and 128),
  origem text not null check (origem in ('external', 'manual')),
  source_key text references catalog_sources(key),
  external_id text,
  bairro_id uuid references bairros(id),
  condominio_id uuid references condominios(id),
  lancamento_id uuid references lancamentos(id),
  dados_origem jsonb not null check (jsonb_typeof(dados_origem) = 'object'),
  endereco_privado jsonb not null check (jsonb_typeof(endereco_privado) = 'object'),
  curadoria jsonb not null default '{}'::jsonb check (jsonb_typeof(curadoria) = 'object'),
  status_publicacao text not null default 'pending_review' check (status_publicacao in ('pending_review', 'published', 'unpublished')),
  ativo boolean not null default false,
  fonte_presente boolean not null default true,
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  last_seen_run uuid references sincronizacoes_log(id),
  preco_venda numeric generated always as ((dados_origem #>> '{prices,sale}')::numeric) stored,
  preco_locacao numeric generated always as ((dados_origem #>> '{prices,rent}')::numeric) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (preco_venda is null or preco_venda > 0),
  check (preco_locacao is null or preco_locacao > 0),
  check (origem <> 'external' or (source_key is not null and external_id is not null)),
  unique(source_key, external_id)
);
create index imoveis_codigo_idx on imoveis(codigo);
create index imoveis_bairro_idx on imoveis(bairro_id);
create index imoveis_publicacao_idx on imoveis(status_publicacao, ativo);
create index imoveis_preco_venda_idx on imoveis(preco_venda) where preco_venda is not null;
create index imoveis_preco_locacao_idx on imoveis(preco_locacao) where preco_locacao is not null;

create table unidades_publicacao (
  id uuid primary key default gen_random_uuid(),
  imovel_id uuid references imoveis(id) on delete cascade,
  condominio_id uuid references condominios(id) on delete cascade,
  lancamento_id uuid references lancamentos(id) on delete cascade,
  unidade text not null check (unidade in ('premium', 'matriz')),
  ativo boolean not null default false,
  inclusao_manual boolean,
  elegivel_filtro_automatico boolean not null default false,
  check (num_nonnulls(imovel_id, condominio_id, lancamento_id) = 1),
  unique(imovel_id, unidade),
  unique(condominio_id, unidade),
  unique(lancamento_id, unidade)
);
create index unidades_publicacao_unidade_idx on unidades_publicacao(unidade, ativo);
