# API publica inicial de imoveis

Implementacao de 2026-09-18, publicada no commit `b516da7` por push autorizado e deploy automatico. Nao altera o site Premium.

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

**Politica aprovada pelo usuario e implementada localmente:** dados JSON podem permanecer desatualizados por ate 60 segundos. Cache interno por instancia, depois de CORS/metodo/rate limiting, sem cache HTTP/CDN (headers no-store preservados). Fotos verificam publicacao a cada acesso; uma requisicao ja em andamento pode concluir. Conteudo ja baixado por terceiros nao pode ser revogado. O commit de producao `b516da7` ainda nao possui este cache interno.

## Compatibilidade com o Premium

Leitura autorizada do repositorio Premium no commit `00445b8d0a2334a5caf0ed47f209733ab559f4b0` confirmou filtros e pagina padrao de 24 itens. A busca atual POST e interna ao site; futuramente seu servidor pode traduzir para GET no CRM, sem alterar esta restricao.

A API nao reproduz o formato legado nem inventa slugs. Antes da troca, preservar URLs atuais, resolver codigo/ID externo versus codigo atribuido e adaptar precos decimais, tipos normalizados e aliases de bairro. Nao regenerar URLs a partir de titulos editados. Home, semelhantes, bairros editoriais, lancamentos, condominios, contatos e sitemap ainda precisam de cobertura; nao remover acesso legado nesta etapa.

## Evidencias e pendencias

- Migracao 014 aplicada no Neon com autorizacao; anteriores preservadas.
- `test:catalog-api --db`: entradas, decimais, projecao recursiva, metodos, CORS, imagens, mensagens, curadoria, unidades, retirada de publicacao, filtros/ha/paginacao e concorrencia do contador aprovados. Fixtures exclusivas removidas e ausencia verificada.
- Banco real no teste; imagens/stream simulados. Nenhuma foto real transferida ou imovel real alterado.
- Regressao `test:catalog-contract` e build aprovados. Smoke HTTP do Next em porta temporaria confirmou 405 e 403 antes do banco; servidor temporario encerrado.
- Deploy do commit `b516da7` verificado por acesso publico: login/API 200, parametros invalidos 400, POST 405 e CORS para a origem permitida.
- Usuario escolheu CA5278, confirmou 10 fotos na galeria e salvou publicacao Premium. Lote real: 10/10 fotos em 10 tentativas, 1,13 MB baixados e 1,10 MB de imagens/miniaturas gravadas. AP0104 nao foi publicado para este aceite, pois o usuario informou que nao pertence ao Premium.
- GET publico do CA5278 retornou 200, unidade premium e 10 midias. Verificacao recursiva nao encontrou campos privados estruturados. Uma foto real e sua miniatura retornaram 200/image/webp, com 149.628 e 26.038 bytes respectivamente. Nao houve verificacao automatica de todas as dez imagens nem auditoria semantica dos textos.
- Consulta do CA5278 pela unidade matriz retornou 404. Resposta Premium manteve no-store. Nenhuma alteracao do imovel foi feita pelo agente nesta verificacao; publicacao foi salva pelo usuario.
- Pendente: publicar e verificar o cache interno em producao, teste de retirada de publicacao real e integracao/paridade do Premium. Nenhuma nova publicacao ou despublicacao autorizada por este registro.

## Cache de dados - politica aprovada

- Usuario aprovou ate 60 segundos de desatualizacao para listagem, detalhe e filtros publicos, incluindo preco antigo e imovel retirado de publicacao. Implementacao local em `lib/catalog/public-cache.ts`, ligada aos handlers JSON; ainda sem deploy.
- TTL monotonicamente contado desde o inicio da leitura da fonte, incluindo consulta/serializacao. Leitura que consumir a janela inteira falha com 503 generico. Sem stale-while-revalidate, stale-if-error, renovacao do TTL no hit ou cache de 404/erros.
- Cache armazena somente JSON publico serializado, com chave por unidade/recurso/codigo ou filtros validados. Headers CORS sao reconstruidos para cada requisicao. Metodos, origem e rate limiting sao verificados antes de qualquer hit.
- Limites tecnicos por instancia: 100 entradas e 10 MiB de corpos JSON UTF-8 (nao e limite da memoria total do processo). Corpos maiores sao servidos sem armazenamento; remocao por expiracao e ordem de insercao. Leitura concorrente antiga nao substitui uma entrada de janela mais recente. Nao ha coalescencia de misses.
- Cache em memoria nao distribuido: cold starts e instancias distintas podem consultar novamente o banco. O contador distribuido continua sendo consultado em todos os acessos. Reduz leituras de catalogo, nao custo de todas as Functions/contadores nem trafego de imagens. Cache CDN agressivo continua adiado para nao contornar o rate limiting.
- Fotos continuam fora do cache: consulta de publicacao/unidade/estado em toda requisicao e headers no-store. Rotas administrativas nao foram alteradas.
- Testes locais com relogio controlado aprovados: hit, limite exato de 60 segundos, expiracao de lista/detalhe/filtros, unidade/paginacao, CORS novo em hit, bloqueio por metodo/origem/limite, despublicacao com foto negada imediatamente, erros sem cache, leitura lenta, capacidade e concorrencia. Dependencias de banco/Blob simuladas; nenhum registro real alterado. Nao repetido teste Neon porque SQL/schema nao mudaram.
- O site futuro nao deve somar outro cache e ultrapassar a janela acordada. A janela limita a selecao da resposta no servidor; transporte e copias ja entregues ao cliente nao sao revogaveis.
- Referencia consultada: https://vercel.com/docs/caching/cache-control-headers . A configuracao efetiva deve ser verificada em producao; um TTL isolado nao comprova a janela de retirada ponta a ponta.
