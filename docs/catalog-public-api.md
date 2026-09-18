# API publica inicial de imoveis

Implementacao local de 2026-09-18. Nao publicada; nao altera o site Premium.

## Escopo e rotas

- `GET /api/catalog/{unit}/properties`: listagem paginada.
- `GET /api/catalog/{unit}/properties/{code}`: ficha pelo codigo publico exato, como `AP0104`.
- `GET /api/catalog/{unit}/filters`: combinacoes distintas de bairro, cidade, UF e tipo normalizado dos imoveis publicados.
- `GET /api/blob-image/public/{unit}/{imageId}`: foto pronta no Blob privado; `size=thumb` para miniatura, `size=full` ou ausencia para imagem completa.

`unit` aceita somente `premium` ou `matriz`. GET nao exige sessao administrativa: o controle e a publicacao do recurso na unidade. POST, PUT, PATCH, DELETE, HEAD e OPTIONS retornam 405. Nenhuma escrita de catalogo e exposta; os contadores de abuso sao internos.

## Consulta e resposta

Filtros opcionais: `bairro`, `cidade`, `tipo`, `negocio` (Comprar/Alugar, padrao Comprar), `valorMinimo`, `valorMaximo`, `suitesMinimas`, `vagasMinimas`, `quartosMinimos`, `areaMinima`, `order`, `page` e `perPage`.

- `tipo` usa a chave normalizada, nao o rotulo original do XML.
- Valores de filtro monetario/area sao strings decimais nao negativas, ate 15 digitos inteiros e 6 casas, comparadas em numeric no PostgreSQL. Precos retornados preservam o contrato de strings decimais positivas ou null.
- `areaMinima` e expressa em m2. A consulta converte hectares para m2, sem mudar os valores/unidade retornados pelo contrato.
- Quantidades inteiras entre 0 e 1000; `page` entre 1 e 10000; `perPage` entre 1 e 48, padrao 24.
- Ordem: relevancia (inclusao manual, atualizacao, ID), maior_valor, menor_valor e mais_recentes. ID desempata todas as ordens. Pagina e total usam o mesmo snapshot SQL; edicoes entre requisicoes podem mudar as paginas.
- Campos desconhecidos, parametros repetidos, intervalos invertidos, negativos, cientificos e fracionarios onde se exige inteiro retornam 400. Query limitada a 2048 caracteres.
- Resposta de listagem: `{ items, total, page, perPage, hasMore }`. Cada item segue `publicCatalogItemSchema`; detalhe retorna um item. Filtros retornam `{ items: [{ bairro, cidade, estado, tipo }] }`, com limite operacional de 1000 combinacoes; excesso falha explicitamente, sem truncar silenciosamente.
- Recurso inexistente/nao publicado retorna 404 indistinguivel. Falha interna retorna 503 generico, nunca 200 com lista vazia simulando sucesso.

## Publicacao e privacidade

Consultas exigem imovel ativo, status published, unidade ativa e fonte presente quando externo. O estado de publicacao real no banco prevalece sobre o JSON original da importacao. Curadoria sobrepoe os dados da fonte, inclusive precos null.

Selecao SQL explicita nao busca endereco_privado, curadoria_privada, hashes, identidade da fonte ou metadados brutos. A projecao final seleciona campos por allowlist e valida com o schema publico. Valores originais da taxonomia/caracteristicas nao sao retornados. Somente caracteristicas marcadas publicas entram na resposta.

A galeria publica usa somente `catalog_images.status=ready`, com ordem/principal existentes. Referencias XML, staged/pending/deleting e videos externos nao sao publicados nesta entrega. URLs sao geradas no dominio oficial do CRM; nao sao copiadas do feed ou do Host recebido. O proxy consulta novamente publicacao/unidade/estado antes de ler o Blob e recebe somente UUID, nunca URL arbitraria. O proxy administrativo anterior continua exigindo sessao e nao foi modificado.

Textos livres continuam exigindo curadoria: validacao estrutural e filtros de padroes sensiveis nao garantem detectar todo endereco escrito dentro de uma descricao. Nao foi feita auditoria semantica do catalogo real nesta entrega.

## Rate limiting, CORS e cache

Migracao 014 cria contadores independentes da autenticacao. Limites operacionais iniciais: 120 requisicoes JSON/minuto/IP e 600 imagens/minuto/IP. Janela fixa pode permitir rajada na transicao entre minutos; nao substitui WAF nem protege contra ataque distribuido. O site fazendo chamadas server-to-server compartilha o IP de saida: validar limites na integracao antes de ampliar trafego.

Identificador e HMAC com contexto catalog-api:v1, sem persistir IP puro. Em Vercel, somente x-vercel-forwarded-for valido e confiavel; em ambiente local ou sem IP confiavel, bucket unico conservador. Incremento atomico no Postgres funciona entre instancias. Contador satura no limite; rejeicao retorna 429 e Retry-After 60. Falha no banco/segredo nega acesso com 503. Limpeza oportunista limitada remove buckets sem atualizacao ha mais de um dia; sem trafego, podem permanecer ate a proxima requisicao. Nao grava auditoria por leitura nem imprime erros de dependencia.

CORS permite somente a origem observada do site `https://inglaterrapremium.vercel.app`, sem wildcard, cookies ou credenciais. Mesma origem e consumidores sem Origin podem ler; CORS nao e autenticacao nem impede scraping. Dominios customizados/da matriz nao foram presumidos: confirmar antes de habilitar. Preflight nao e necessario para GET simples; nao usar headers personalizados na integracao inicial.

**Cache publico ainda pendente:** respostas usam no-store, inclusive CDN, erros e imagens. Decisao conservadora nesta entrega, ate aprovar janela de retirada de publicacao e invalidacao. Isso diverge temporariamente do objetivo de cache agressivo da arquitetura, aumenta consultas/trafego e impede considerar a fase completa para escala. A proxima requisicao apos retirada de publicacao deve ser negada; uma requisicao ja em andamento pode concluir. Conteudo ja baixado por terceiros nao pode ser revogado.

## Compatibilidade com o Premium

Leitura autorizada do repositorio Premium no commit `00445b8d0a2334a5caf0ed47f209733ab559f4b0` confirmou filtros e pagina padrao de 24 itens. A busca atual POST e interna ao site; futuramente seu servidor pode traduzir para GET no CRM, sem alterar esta restricao.

A API nao reproduz o formato legado nem inventa slugs. Antes da troca, preservar URLs atuais, resolver codigo/ID externo versus codigo atribuido e adaptar precos decimais, tipos normalizados e aliases de bairro. Nao regenerar URLs a partir de titulos editados. Home, semelhantes, bairros editoriais, lancamentos, condominios, contatos e sitemap ainda precisam de cobertura; nao remover acesso legado nesta etapa.

## Evidencias e pendencias

- Migracao 014 aplicada no Neon com autorizacao; anteriores preservadas.
- `test:catalog-api --db`: entradas, decimais, projecao recursiva, metodos, CORS, imagens, mensagens, curadoria, unidades, retirada de publicacao, filtros/ha/paginacao e concorrencia do contador aprovados. Fixtures exclusivas removidas e ausencia verificada.
- Banco real no teste; imagens/stream simulados. Nenhuma foto real transferida ou imovel real alterado.
- Regressao `test:catalog-contract` e build aprovados. Smoke HTTP do Next em porta temporaria confirmou 405 e 403 antes do banco; servidor temporario encerrado.
- Pendente: validacao GET publico com Blob real em producao apos publicacao autorizada, cache/CDN e integracao/paridade do Premium. Nao houve commit, push, deploy ou alteracao do site.
