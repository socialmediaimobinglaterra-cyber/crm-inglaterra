# Catalog Normalization Decisions

Evidencias e decisoes definitivas para o contrato normalizado do catalogo.

Data da analise: 2026-09-03. Decisoes confirmadas pelo usuario em 2026-09-04.

Escopo: analise somente leitura do XML configurado em `PROPERTY_FEED_URL`. A URL, query string e token foram tratados como segredo. O XML foi baixado apenas para arquivo temporario e removido ao final. Este documento nao contem URL do feed, token, e-mails, telefones, CEPs numericos ou enderecos completos.

Este documento nao implementa schema, importador ou adaptador. Ele separa fatos observados, decisoes aprovadas, riscos conhecidos e a unica pendencia mantida: obter a documentacao oficial dos codigos `TipoOferta`, `PublicaValores` e `TipoLocacao`.

## 1. Venda e locacao

### Evidencia

Total analisado: 2.206 imoveis.

| Combinacao | Quantidade |
|-|-:|
| `TipoOferta=1`, `TipoLocacao` vazio, com `PrecoVenda`, sem `PrecoLocacao`, sem `PrecoCondominio`, com `PrecoIptu` | 969 |
| `TipoOferta=1`, `TipoLocacao` vazio, com `PrecoVenda`, sem `PrecoLocacao`, com `PrecoCondominio`, com `PrecoIptu` | 749 |
| `TipoOferta=1`, `TipoLocacao=3`, sem `PrecoVenda`, com `PrecoLocacao`, sem `PrecoCondominio`, com `PrecoIptu` | 208 |
| `TipoOferta=1`, `TipoLocacao=3`, sem `PrecoVenda`, com `PrecoLocacao`, com `PrecoCondominio`, com `PrecoIptu` | 193 |
| `TipoOferta=1`, `TipoLocacao=3`, com `PrecoVenda`, com `PrecoLocacao`, com `PrecoCondominio`, com `PrecoIptu` | 35 |
| `TipoOferta=1`, `TipoLocacao=3`, com `PrecoVenda`, com `PrecoLocacao`, sem `PrecoCondominio`, com `PrecoIptu` | 26 |
| `TipoOferta=1`, `TipoLocacao` vazio, com `PrecoVenda`, sem `PrecoLocacao`, sem `PrecoCondominio`, sem `PrecoIptu` | 15 |
| `TipoOferta=1`, `TipoLocacao` vazio, com `PrecoVenda`, sem `PrecoLocacao`, com `PrecoCondominio`, sem `PrecoIptu` | 7 |
| `TipoOferta=1`, `TipoLocacao=3`, sem `PrecoVenda`, com `PrecoLocacao`, sem `PrecoCondominio`, sem `PrecoIptu` | 3 |
| `TipoOferta=1`, `TipoLocacao=3`, com `PrecoVenda`, com `PrecoLocacao`, com `PrecoCondominio`, sem `PrecoIptu` | 1 |

Resumo por presenca de preco:

| Caso | Quantidade |
|-|-:|
| Somente venda | 1.740 |
| Somente locacao | 404 |
| Venda e locacao | 62 |
| Sem venda e sem locacao | 0 |

`TipoOferta` foi sempre `1`, portanto nao diferencia venda/locacao neste feed. `TipoLocacao=3` aparece em todos os 466 imoveis com `PrecoLocacao`, incluindo os 62 que tambem possuem `PrecoVenda`.

### Decisao aprovada

Inferir `finalidade_comercial` pela presenca de precos positivos:

| Condicao | Valor normalizado recomendado |
|-|-|
| `PrecoVenda` positivo e `PrecoLocacao` ausente/nao positivo | `venda` |
| `PrecoVenda` ausente/nao positivo e `PrecoLocacao` positivo | `locacao` |
| ambos positivos | `venda_locacao` |
| ambos ausentes/nao positivos | rejeitar importacao do item ou marcar como `indefinida` para revisao |

Manter `Finalidade` da origem como `categoria_uso` ou campo equivalente, porque ela representa uso do imovel: residencial, comercial, rural, industrial ou corporativa.

### Risco

Se `PrecoVenda` ou `PrecoLocacao` puderem existir ocultos por regra de publicacao, a inferencia pode classificar errado. Os 62 casos com venda e locacao simultaneas serao tratados como `venda_locacao`. Se a origem passar a enviar precos zerados no futuro, a regra deve considerar apenas precos positivos.

### Decisao final

A finalidade comercial do CRM sera inferida por `PrecoVenda` e `PrecoLocacao` positivos. `Finalidade` fica como categoria de uso.

## 2. Codigos da origem

### Evidencia

| Campo | Valores e frequencia |
|-|-|
| `TipoOferta` | `1`: 2.206 |
| `TipoLocacao` | vazio: 1.740; `3`: 466 |
| `PublicaValores` | `2`: 1.740; `3`: 398; `1`: 61; `4`: 7 |

Correlacao observada:

| Campo | Correlacao |
|-|-|
| `TipoOferta=1` | aparece em venda, locacao e venda+locacao; nao diferencia finalidade |
| `TipoLocacao=3` | aparece em todos os registros com `PrecoLocacao`; ausente nos registros somente venda |
| `PublicaValores=2` | quase todos somente venda: 1.739; tambem 1 caso venda+locacao |
| `PublicaValores=3` | 398 casos somente locacao |
| `PublicaValores=1` | 61 casos venda+locacao |
| `PublicaValores=4` | 6 casos somente locacao e 1 caso somente venda |

### Decisao aprovada

Armazenar os codigos em campos de origem/metadados sem atribuir significado de negocio ainda:

* `origem_tipo_oferta`
* `origem_publica_valores`
* `origem_tipo_locacao`

Usar somente a presenca de precos positivos para a primeira regra de finalidade comercial.

### Risco

`PublicaValores` provavelmente influencia exibicao de preco, mas os dados nao provam o significado de cada codigo. Usar esses codigos agora para ocultar/exibir valores pode publicar preco indevido ou esconder preco valido.

### Pendencia mantida

Obter dicionario da origem para `TipoOferta`, `PublicaValores` e `TipoLocacao` antes de usar esses campos em regra publica.

## 3. Zeros

### Evidencia e decisao campo a campo

| Campo | Presente | Vazio | Zero | Nao zero | Decisao |
|-|-:|-:|-:|-:|-|
| `latitude` | 2.206 | 0 | 1.220 | 986 | Normalizar zero para `NULL` |
| `longitude` | 2.206 | 0 | 1.220 | 986 | Normalizar zero para `NULL` |
| `Numero` | 2.206 | 0 | 255 | 1.951 | Tratar zero como ausente/oculto e armazenar `NULL` no campo privado |
| `AreaTotal` | 2.206 | 0 | 0 | 2.206 | Preservar valor |
| `AreaUtil` | 2.206 | 445 | 0 | 1.761 | Vazio vira `NULL`; preservar nao zero |
| `PrecoVenda` | 1.802 | 0 | 0 | 1.802 | Preservar nao zero; ausente vira `NULL` |
| `PrecoLocacao` | 466 | 0 | 0 | 466 | Preservar nao zero; ausente vira `NULL` |
| `PrecoCondominio` | 985 | 0 | 0 | 985 | Preservar nao zero; ausente vira `NULL` |
| `PrecoIptu` | 2.180 | 0 | 0 | 2.180 | Preservar nao zero; ausente vira `NULL` |
| `QtdDormitorios` | 2.206 | 0 | 751 | 1.455 | Preservar zero como valor semantico, mas permitir revisao por tipo |
| `QtdSuites` | 927 | 0 | 0 | 927 | Ausente vira `NULL`; preservar nao zero |
| `QtdBanheiros` | 1.705 | 0 | 0 | 1.705 | Ausente vira `NULL`; preservar nao zero |
| `QtdVagas` | 1.619 | 0 | 0 | 1.619 | Ausente vira `NULL`; preservar nao zero |
| `QtdVagasCobertas` | 1.321 | 0 | 0 | 1.321 | Ausente vira `NULL`; preservar nao zero |
| `QtdVagasDescobertas` | 643 | 0 | 0 | 643 | Ausente vira `NULL`; preservar nao zero |

### Risco

Coordenadas e numero zero parecem ausencia. Dormitorios zero podem ser correto para terrenos, salas e lojas, mas podem tambem representar ausencia. Converter dormitorios zero para `NULL` destruiria uma informacao util para busca por "sem dormitorio" em imoveis nao residenciais.

### Decisao final

Coordenadas `0/0` viram `NULL`. Numero `0` vira `NULL` dentro do endereco privado. Dormitorios `0` permanece como zero.

## 4. Localizacao

### Evidencia

| Comparacao | Quantidade |
|-|-:|
| `Bairro` igual a `BairroOficial` apos normalizacao simples | 1.383 |
| `Bairro` diferente de `BairroOficial` | 823 |
| `Bairro` vazio | 0 |
| `BairroOficial` vazio | 0 |
| Ambos vazios | 0 |

Exemplos anonimizados de divergencia:

| `Bairro` | `BairroOficial` |
|-|-|
| `[bairro A]` | `[bairro oficial A]` |
| `[bairro B]` | `[bairro oficial B]` |
| `[bairro C]` | `[bairro oficial C]` |

### Decisao aprovada

Usar `BairroOficial` como campo principal normalizado para busca, filtros, URLs e agrupamentos. Preservar `Bairro` como `bairro_origem` para rastreabilidade e comparacao.

### Risco

`Bairro` pode conter nomenclatura comercial mais reconhecida pelo publico, enquanto `BairroOficial` pode ser melhor para consistencia. Trocar sem curadoria pode afetar SEO e expectativa do usuario.

### Decisao final

O CRM deve priorizar `BairroOficial` para taxonomia, busca e agrupamento. `Bairro` deve ser preservado como alias/origem, sem descarte.

## 5. Endereco

### Evidencia

Campos de endereco presentes: `Endereco`, `Numero`, `ComplementoEndereco`, `CEP`, `PontoReferenciaEndereco`, coordenadas, cidade, estado e bairro. O documento de discovery ja classificou endereco completo e dados de referencia como sensiveis.

### Decisao aprovada

Separar o contrato em duas camadas:

| Camada | Campos permitidos |
|-|-|
| CRM privado | logradouro, numero, complemento, CEP, ponto de referencia, coordenadas brutas, observacoes internas |
| API publica | cidade, estado, bairro normalizado, tipo/subtipo, area, preco permitido, caracteristicas publicas, midias publicas, coordenada aproximada somente se aprovada |

Endereco completo nao deve sair na API publica por padrao. Coordenadas devem permanecer privadas ate existir regra explicita de precisao/exposicao.

### Risco

Publicar endereco completo pode expor proprietarios, ocupantes e imoveis desocupados. Publicar coordenadas exatas pode revelar localizacao sensivel mesmo sem logradouro.

### Decisao final

API publica expoe apenas bairro, cidade e UF por padrao. Endereco completo fica privado. Coordenadas ficam privadas ate decisao especifica posterior.

## 6. Imagens

### Evidencia

| Item | Resultado |
|-|-:|
| Total de fotos | 44.996 |
| URLs unicas | 37.695 |
| Linhas com URL duplicada | 7.301 |
| Nomes de arquivo unicos | 37.695 |
| Linhas com nome duplicado | 7.301 |
| Hosts distintos | 1 |
| URLs HTTPS unicas | 34.804 |
| URLs HTTP unicas | 2.891 |
| Amostra HTTPS testada com `HEAD` | 12 |
| Amostra com resposta 2xx | 12 |
| Amostra com mesmo status em duas chamadas | 12 |

### Decisao aprovada

Adotar migracao gradual para Vercel Blob:

1. Na primeira importacao, preservar `url_origem`, tipo, ordem e flag principal.
2. Enfileirar copia de imagens para Blob privado de forma assincroma e deduplicada por URL/hash.
3. Servir imagens pela rota proxy do CRM quando copiadas.
4. Manter fallback temporario para URL externa apenas durante a transicao.

### Risco

Copiar 44.996 fotos imediatamente aumenta tempo de importacao, custo, trafego e risco de falha parcial. Referenciar a origem diretamente e mais simples, mas cria dependencia operacional do fornecedor, mistura HTTP/HTTPS e reduz controle de privacidade/cache.

### Decisao final

Usar migracao gradual para Blob privado com fallback temporario para URL externa. Nao fazer copia imediata bloqueante das 44.996 fotos.

## 7. Taxonomia

### Evidencia

Tipos:

| Tipo | Quantidade |
|-|-:|
| Casa | 710 |
| Apartamento | 663 |
| Terreno | 404 |
| Sala | 105 |
| Loja | 89 |
| Barracao | 67 |
| Chacara | 66 |
| Sitio | 26 |
| Cobertura | 19 |
| Area | 17 |
| Salao | 17 |
| Predio | 11 |
| Fazenda | 8 |
| Galpao | 4 |

Subtipos:

| Subtipo | Quantidade |
|-|-:|
| Casa Residencial | 507 |
| Apartamento de Condominio | 366 |
| Apartamento Residencial | 297 |
| Terreno Padrao | 216 |
| Casa de Condominio | 203 |
| Loteamento/Condominio | 188 |
| Sala Comercial | 105 |
| Loja Comercial | 89 |
| Barracao Comercial | 67 |
| Chacara Rural | 66 |
| Sitio Rural | 26 |
| Cobertura Residencial | 19 |
| Area Comercial | 17 |
| Salao Comercial | 17 |
| Predio Comercial | 11 |
| Fazenda Rural | 8 |
| Galpao Comercial | 4 |

Caracteristicas mais frequentes:

| Caracteristica | Quantidade |
|-|-:|
| ServicoCozinha | 1.464 |
| AreaServico | 1.363 |
| PisoCeramica | 1.132 |
| Agua | 1.026 |
| PortaoEletronico | 1.003 |
| EnergiaEletrica | 979 |
| Churrasqueira | 950 |
| Esgoto | 950 |
| AnoConstrucao | 830 |
| ArmarioCozinha | 829 |
| RuaAsfaltada | 822 |
| Interfone | 740 |
| Piscina | 687 |
| ArmarioDormitorio | 575 |
| PisoLaminado | 552 |
| ArmarioBanheiro | 521 |
| QuadraPoliEsportiva | 454 |
| Quintal | 429 |
| PisoPorcelanato | 421 |
| Sacada | 336 |

### Decisao aprovada

Criar taxonomia interna separada dos valores da origem:

* `tipo_normalizado`: conjunto pequeno usado em filtro e API.
* `subtipo_normalizado`: opcional, derivado de mapeamento revisavel.
* `tipo_origem` e `subtipo_origem`: sempre preservados.
* `caracteristicas`: dicionario interno com chave, rotulo publico, grupo e visibilidade.
* `caracteristicas_origem`: preservar chave original para rastreabilidade.

### Risco

Normalizar agressivamente pode apagar diferencas comerciais importantes, como casa de condominio versus casa residencial, ou area versus terreno. Expor todas as caracteristicas como filtros pode criar uma interface barulhenta e dificil de manter.

### Decisao final

Criar taxonomia interna preservando os valores originais da fonte. A selecao final de filtros publicos, subtipos expostos, rotulos e aliases exige revisao humana na etapa de schema/interface, mas o contrato deve manter `tipo_origem`, `subtipo_origem` e chaves originais de caracteristicas.

## Decisoes definitivas

1. Inferir `venda`, `locacao` e `venda_locacao` pela presenca de `PrecoVenda` e `PrecoLocacao` positivos.
2. Manter `Finalidade` da origem como categoria de uso, nao como finalidade comercial.
3. Guardar `TipoOferta`, `PublicaValores` e `TipoLocacao` como metadados ate obter dicionario oficial.
4. Coordenadas zero viram `NULL`.
5. Numero zero vira `NULL` em endereco privado.
6. Dormitorios zero fica como `0` por enquanto.
7. `BairroOficial` vira bairro principal; `Bairro` fica preservado como alias/origem.
8. Endereco completo fica privado; API publica usa bairro/cidade/UF por padrao.
9. Imagens seguem migracao gradual para Blob privado, com fallback temporario para URL externa.
10. Taxonomia interna preserva valores originais e a definicao fina de filtros publicos exige revisao humana.

## Pendencia restante

Permanece pendente apenas obter a documentacao oficial do significado de `TipoOferta`, `PublicaValores` e `TipoLocacao`. Ate la, esses campos devem ser armazenados como metadados de origem e nao devem controlar comportamento publico.
