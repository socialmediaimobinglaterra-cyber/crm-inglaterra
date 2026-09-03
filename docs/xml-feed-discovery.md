# XML Feed Discovery

Diagnostico da fonte XML configurada em `PROPERTY_FEED_URL`.

Data da analise: 2026-09-03.

Escopo: analise somente leitura do documento completo. A URL do feed, query string e qualquer token foram tratados como segredo. O XML foi baixado apenas para arquivo temporario e removido ao final. Este documento nao contem URL do feed, token, telefones, e-mails de corretores ou enderecos completos de imoveis.

## Resumo quantitativo

| Item | Resultado |
|-|-:|
| Tamanho aproximado do XML | 34.143.907 bytes, cerca de 32,6 MiB |
| Total de imoveis | 2.206 |
| Caminhos XML distintos observados | 162 |
| Campos com valor observados | 155 |
| Fotos | 44.996 |
| Fotos por imovel | minimo 1, media 20,4, maximo 115 |
| Fotos marcadas como principal | 2.206 |
| Imoveis com preco de venda | 1.802 |
| Imoveis com preco de locacao | 466 |
| Imoveis com venda e locacao simultaneas | 62 |
| Imoveis sem venda e sem locacao | 0 |
| `CodigoImovel` duplicado | 0 |

## Hierarquia observada

```text
/Carga
  /Imoveis
    /Imovel
      campos diretos do imovel
      /Fotos
        /Foto
          /FotoTipo
          /URLArquivo
          /NomeArquivo
          /Principal
          /FotoDescricao
          /FotoTitulo
      /GarantiaLocacao
        /Garantia
      /corretor
        /nome
        /email
        /telefone
        /celular
        /foto
```

`/Carga/Imoveis/Imovel` e o registro principal. Cada `Imovel` possui campos diretos, lista de fotos, garantias de locacao quando aplicavel e dados de corretor. Os dados de corretor foram classificados como sensiveis/internos e nao devem ir para a API publica.

## Valores distintos relevantes

### Tipo de imovel

| Valor | Frequencia |
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

### Subtipo de imovel

Subtipos mais frequentes: Casa Residencial, Apartamento de Condominio, Apartamento Residencial, Terreno Padrao, Casa de Condominio, Loteamento/Condominio, Sala Comercial, Loja Comercial, Barracao Comercial, Chacara Rural, Sitio Rural e Cobertura Residencial.

Decisao pendente: confirmar se `TipoImovel` e `SubTipoImovel` serao tratados como taxonomia controlada do CRM ou como valores de origem mapeados para uma taxonomia interna.

### Finalidade

| Valor | Frequencia |
|-|-:|
| Residencial | 1.786 |
| Comercial | 361 |
| Rural | 48 |
| Industrial | 10 |
| Corporativa | 1 |

### Oferta, publicacao e status

| Campo | Valores observados |
|-|-|
| `TipoOferta` | `1` em 2.206 registros |
| `Publicar` | `1` em 2.206 registros |
| `PublicaValores` | `2` em 1.740; `3` em 398; `1` em 61; `4` em 7 |
| `StatusComercial` | Padrao 2.171; Lancamento 32; Pronto para Morar 2; Futuro lancamento 1 |
| `CategoriaImovel` | Padrao em 2.206 registros |
| `Ocupacao` | Desocupado 1.175; Ocupado 637; Nao Informado 317; Em construcao 63; Lancamento 12; Novo 2 |

`TipoOferta` e `PublicaValores` usam codigos numericos sem significado seguro inferido. Nao converter para regra de negocio sem confirmacao.

### Localidade

| Estado | Frequencia |
|-|-:|
| PR | 2.200 |
| SP | 2 |
| MT | 1 |
| SC | 1 |
| PI | 1 |
| MG | 1 |

Cidades observadas: Londrina, Cambe, Sertanopolis, Ibipora, Primeiro de Maio, Alvorada do Sul, Porecatu, Tamarana, Sertaneja, Rolandia, Assai, Maringa, Jataizinho, Carlopolis, Sabaudia, Itapecerica da Serra, Nova America da Colina, Peruibe, Chapada Gaucha, Ribeirao Claro, Sapopema, Faxinal, Comodoro, Urucui, Cornelio Procopio, Arapongas, Apucarana, Ortigueira, Guairaca e Araquari.

### Unidades metricas

| Campo | Valor |
|-|-|
| `UnidadeMetrica` | `M2` em 2.206 registros |

## Estrutura de precos e medidas

| Campo XML | Frequencia | Obrigatorio na pratica | Tipo inferido | Exemplo anonimo | Observacoes |
|-|-:|-|-|-|-|
| `/Carga/Imoveis/Imovel/PrecoVenda` | 1.802 | opcional | decimal | `123.45` | Ausente em imoveis sem venda |
| `/Carga/Imoveis/Imovel/PrecoLocacao` | 466 | opcional | decimal | `123.45` | Ausente em imoveis sem locacao |
| `/Carga/Imoveis/Imovel/PrecoCondominio` | 985 | opcional | decimal | `123.45` | Valor auxiliar |
| `/Carga/Imoveis/Imovel/PrecoIptu` | 2.180 | opcional | decimal | `123.45` | Quase completo, mas ausente em 26 |
| `/Carga/Imoveis/Imovel/PrecoMedioM2Venda` | 1.802 | opcional | decimal | `123.45` | Derivado da origem; pode ser recalculado no CRM |
| `/Carga/Imoveis/Imovel/PrecoMedioM2Locacao` | 460 | opcional | decimal | `123.45` | Ausente em parte dos registros de locacao |
| `/Carga/Imoveis/Imovel/AreaTotal` | 2.206 | obrigatorio | inteiro | `123` | Sempre presente |
| `/Carga/Imoveis/Imovel/AreaUtil` | 2.206 | opcional | inteiro | `123` | 445 registros vazios |
| `/Carga/Imoveis/Imovel/AreaPrivativa` | 7 | opcional | decimal | `123.45` | Campo raro |
| `/Carga/Imoveis/Imovel/AreaComum` | 9 | opcional | decimal | `123.45` | Campo raro |
| `/Carga/Imoveis/Imovel/AlturaPeDireito` | 8 | opcional | decimal | `123.45` | Campo raro |

## Estrutura de dormitorios, suites, banheiros e vagas

| Campo XML | Frequencia | Obrigatorio na pratica | Tipo inferido | Exemplo anonimo | Observacoes |
|-|-:|-|-|-|-|
| `/Carga/Imoveis/Imovel/QtdDormitorios` | 2.206 | obrigatorio | inteiro | `123` | 751 registros usam `0`, provavelmente ausencia ou nao aplicavel para comerciais/terrenos |
| `/Carga/Imoveis/Imovel/QtdSuites` | 927 | opcional | inteiro | `123` | Ausente quando nao informado ou nao aplicavel |
| `/Carga/Imoveis/Imovel/QtdBanheiros` | 1.705 | opcional | inteiro | `123` | Ausente em 501 registros |
| `/Carga/Imoveis/Imovel/QtdVagas` | 1.619 | opcional | inteiro | `123` | Ausente em 587 registros |
| `/Carga/Imoveis/Imovel/QtdVagasCobertas` | 1.321 | opcional | inteiro | `123` | Detalhamento parcial |
| `/Carga/Imoveis/Imovel/QtdVagasDescobertas` | 643 | opcional | inteiro | `123` | Detalhamento parcial |
| `/Carga/Imoveis/Imovel/QtdSalas` | 1.435 | opcional | inteiro | `123` | Relevante para comerciais e residenciais |
| `/Carga/Imoveis/Imovel/QtdAndar` | 845 | opcional | inteiro | `123` | Predio/condominio |
| `/Carga/Imoveis/Imovel/NumeroAndar` | 773 | opcional | inteiro | `123` | Andar da unidade |
| `/Carga/Imoveis/Imovel/QtdElevador` | 149 | opcional | inteiro | `123` | Campo raro |

## Fotos, videos e URLs

| Campo XML | Frequencia | Obrigatorio na pratica | Tipo inferido | Exemplo anonimo | Observacoes |
|-|-:|-|-|-|-|
| `/Carga/Imoveis/Imovel/Fotos/Foto` | 44.996 | lista | composto | `[foto]` | Todo imovel tem ao menos 1 foto |
| `/Carga/Imoveis/Imovel/Fotos/Foto/URLArquivo` | 44.996 | obrigatorio por foto | URL | `[url]` | Nao expor diretamente se o CRM usar Blob privado/proxy |
| `/Carga/Imoveis/Imovel/Fotos/Foto/NomeArquivo` | 44.996 | obrigatorio por foto | texto | `[arquivo]` | Nome externo, nao usar como nome final no Blob |
| `/Carga/Imoveis/Imovel/Fotos/Foto/Principal` | 44.996 | obrigatorio por foto | booleano `0/1` | `0/1` | 2.206 fotos principais, uma por imovel |
| `/Carga/Imoveis/Imovel/Fotos/Foto/FotoTipo` | 44.996 | obrigatorio por foto | texto controlado | `[tipo de foto]` | Foto 44.894; Banner 100; Decorado 1; Foto planta 1 |
| `/Carga/Imoveis/Imovel/Fotos/Foto/FotoDescricao` | 25.265 | opcional | texto | `[texto]` | Descricao livre |
| `/Carga/Imoveis/Imovel/Fotos/Foto/FotoTitulo` | 23.896 | opcional | texto | `[texto]` | Titulo livre |
| `/Carga/Imoveis/Imovel/URLGaiaSite` | 2.206 | obrigatorio | URL | `[url]` | Link da origem; nao deve ser contrato interno |
| `/Carga/Imoveis/Imovel/LinkVideo` | 2.176 | opcional | texto/URL parcial | `[url ou id externo]` | Precisa validar formato antes de publicar |
| `/Carga/Imoveis/Imovel/TourVirtual` | 136 | opcional | URL | `[url]` | Recurso publico condicionado a curadoria |

## Dicionario de campos principais

| Caminho | Frequencia | Obrigatorio na pratica | Tipo inferido | Exemplo anonimizado | Observacao |
|-|-:|-|-|-|-|
| `/Carga/Imoveis/Imovel/CodigoImovel` | 2.206 | sim | texto curto | `[codigo]` | Identificador principal da origem; sem duplicidade observada |
| `/Carga/Imoveis/Imovel/CodigoCliente` | 2.206 | sim | texto curto | `[codigo]` | Identificador de cliente/conta da origem |
| `/Carga/Imoveis/Imovel/CodigoImovelAuxiliar` | 2.206 | nao | decimal/texto | `[codigo]` | 2.048 vazios |
| `/Carga/Imoveis/Imovel/TipoImovel` | 2.206 | sim | texto controlado | `[tipo]` | Mapear para taxonomia interna |
| `/Carga/Imoveis/Imovel/SubTipoImovel` | 2.206 | sim | texto controlado | `[subtipo]` | Mapear para taxonomia interna |
| `/Carga/Imoveis/Imovel/Finalidade` | 2.206 | sim | texto controlado | `[finalidade]` | Residencial, Comercial, Rural, Industrial, Corporativa |
| `/Carga/Imoveis/Imovel/TipoOferta` | 2.206 | sim | codigo numerico | `1` | Significado pendente |
| `/Carga/Imoveis/Imovel/StatusComercial` | 2.206 | sim | texto controlado | `[status]` | Inclui lancamentos |
| `/Carga/Imoveis/Imovel/Publicar` | 2.206 | sim | booleano `0/1` | `1` | Todos publicados na origem |
| `/Carga/Imoveis/Imovel/PublicaValores` | 2.206 | sim | codigo numerico | `1..4` | Significado pendente |
| `/Carga/Imoveis/Imovel/CategoriaImovel` | 2.206 | sim | texto controlado | `Padrao` | Sem variacao observada |
| `/Carga/Imoveis/Imovel/TituloImovel` | 2.206 | sim | texto | `[texto]` | Publicavel apos sanitizacao |
| `/Carga/Imoveis/Imovel/Observacao` | 2.206 | sim | texto longo | `[texto redigido]` | Pode conter texto comercial e dados sensiveis; revisar antes da API publica |
| `/Carga/Imoveis/Imovel/Filial` | 2.206 | sim | texto | `[texto]` | Pode ajudar a mapear unidade, mas nao substitui `unidades_publicacao` |
| `/Carga/Imoveis/Imovel/Pais` | 2.206 | sim | texto controlado | `Brasil` | Sem variacao observada |
| `/Carga/Imoveis/Imovel/Estado` | 2.206 | sim | UF | `PR` | Principalmente PR |
| `/Carga/Imoveis/Imovel/Cidade` | 2.206 | sim | texto controlado | `[cidade]` | Normalizar acentos e aliases |
| `/Carga/Imoveis/Imovel/Bairro` | 2.206 | sim | texto | `[bairro]` | Nao foi listado para evitar granularidade excessiva no diagnostico |
| `/Carga/Imoveis/Imovel/BairroOficial` | 2.206 | sim | texto | `[bairro]` | Decidir prioridade entre bairro comum e oficial |
| `/Carga/Imoveis/Imovel/Endereco` | 2.206 | sim | texto sensivel | `[redigido]` | Nao expor completo na API publica sem regra |
| `/Carga/Imoveis/Imovel/Numero` | 2.206 | sim | inteiro/texto | `[numero]` | 255 registros usam `0`, provavelmente ausencia |
| `/Carga/Imoveis/Imovel/ComplementoEndereco` | 2.206 | sim | texto sensivel | `[redigido]` | Nao expor completo na API publica sem regra |
| `/Carga/Imoveis/Imovel/CEP` | 2.206 | sim | inteiro/texto | `[cep]` | Dado de localizacao sensivel em conjunto com endereco |
| `/Carga/Imoveis/Imovel/PontoReferenciaEndereco` | 67 | nao | texto sensivel | `[redigido]` | Nao publicar sem curadoria |
| `/Carga/Imoveis/Imovel/latitude` | 2.206 | sim | decimal | `123.45` | 1.220 registros com zero |
| `/Carga/Imoveis/Imovel/longitude` | 2.206 | sim | decimal | `123.45` | 1.220 registros com zero |
| `/Carga/Imoveis/Imovel/NomeCondominio` | 2.206 | nao | texto | `[texto]` | 1.033 vazios |
| `/Carga/Imoveis/Imovel/NomeEdificio` | 2.206 | nao | texto | `[texto]` | 1.810 vazios |
| `/Carga/Imoveis/Imovel/CondominioFechado` | 2.206 | sim | booleano `0/1` | `0/1` | 810 positivos |
| `/Carga/Imoveis/Imovel/Ocupacao` | 2.206 | sim | texto controlado | `[ocupacao]` | Pode nao ser publico |
| `/Carga/Imoveis/Imovel/Ocupador` | 637 | nao | texto | `[texto]` | Campo interno; nao publicar |
| `/Carga/Imoveis/Imovel/PadraoImovel` | 2.206 | sim | texto controlado | `[padrao]` | Medio, Alto, Nao informado, Regular, Baixo |
| `/Carga/Imoveis/Imovel/PadraoLocalizacao` | 2.206 | sim | texto controlado | `[padrao]` | Otima, Media, Privilegiada, Nao informado, Boa, Regular |
| `/Carga/Imoveis/Imovel/FaceImovel` | 2.206 | sim | texto | `[texto]` | Classificacao de face; precisa normalizacao |
| `/Carga/Imoveis/Imovel/Regiao` | 2.206 | nao | texto | `[vazio]` | Todos vazios |
| `/Carga/Imoveis/Imovel/Zoneamento` | 1.460 | nao | texto | `[texto]` | Campo tecnico, confirmar uso publico |
| `/Carga/Imoveis/Imovel/DataCadastro` | 2.206 | sim | data | `AAAA-MM-DD` | Formato data |
| `/Carga/Imoveis/Imovel/DataAtualizacao` | 2.206 | sim | data-hora | `AAAA-MM-DD HH:mm:ss` | Formato data-hora |
| `/Carga/Imoveis/Imovel/DataAtualizacaoImovel` | 2.206 | sim | data-hora | `AAAA-MM-DD HH:mm:ss` | Formato data-hora |
| `/Carga/Imoveis/Imovel/Exclusividade` | 2.206 | sim | `Sim/Nao` | `Sim/Nao` | 162 exclusivos |
| `/Carga/Imoveis/Imovel/DataInicioExclusividade` | 162 | nao | data | `AAAA-MM-DD` | Presente quando exclusivo |
| `/Carga/Imoveis/Imovel/DataFimExclusividade` | 162 | nao | data | `AAAA-MM-DD` | Presente quando exclusivo |
| `/Carga/Imoveis/Imovel/PrecisaReforma` | 2.206 | sim | booleano/codigo | `1` | Todos com `1`; significado precisa confirmacao |
| `/Carga/Imoveis/Imovel/AceitaNegociacao` | 2.185 | nao | booleano `1` | `1` | Ausencia provavelmente falso/nao informado |
| `/Carga/Imoveis/Imovel/AceitaFinanciamento` | 2.060 | nao | booleano `1` | `1` | Ausencia provavelmente falso/nao informado |
| `/Carga/Imoveis/Imovel/AceitaPermuta` | 278 | nao | booleano `1` | `1` | Ausencia provavelmente falso/nao informado |
| `/Carga/Imoveis/Imovel/Locado` | 156 | nao | booleano `1` | `1` | Campo interno, nao publicar sem regra |
| `/Carga/Imoveis/Imovel/TipoLocacao` | 466 | nao | codigo numerico | `3` | Significado pendente |
| `/Carga/Imoveis/Imovel/GarantiaLocacao/Garantia` | 1.847 | nao | texto controlado | `[garantia]` | Multivalorado por imovel de locacao |
| `/Carga/Imoveis/Imovel/corretor/*` | 2.204 | nao | composto sensivel | `[redigido]` | Nome, e-mail, telefone, celular e foto de corretor; nao publicar |

## Campos dinamicos de caracteristicas

Os campos abaixo aparecem como elementos diretos opcionais em `Imovel`, normalmente com valor booleano `1`. A ausencia parece representar falso ou nao informado, mas isso precisa ser confirmado antes do schema.

| Grupo | Campos observados |
|-|-|
| Lazer/externo | `Piscina`, `Churrasqueira`, `QuadraPoliEsportiva`, `Quintal`, `Sacada`, `Varanda`, `VarandaGourmet`, `Sauna`, `CampoFutebol`, `Solarium`, `Terraco`, `JardimInverno`, `FrenteMar`, `BeiraMar` |
| Ambientes | `AreaServico`, `ServicoCozinha`, `Copa`, `Despensa`, `Escritorio`, `Lavabo`, `Deposito`, `Mezanino`, `DormitorioEmpregada`, `DormitorioReversivel`, `WCEmpregada`, `Vestiario`, `Doca`, `AreaEscritorio` |
| Infraestrutura | `Agua`, `EnergiaEletrica`, `Esgoto`, `RuaAsfaltada`, `PortaoEletronico`, `Interfone`, `TVCabo`, `PontoReferenciaEndereco`, `EntradaCaminhoes`, `PlacaNoLocal`, `Zelador`, `Caseiro` |
| Acabamento/moveis | `ArmarioCozinha`, `ArmarioDormitorio`, `ArmarioBanheiro`, `ArmarioAreaServico`, `ArmarioSala`, `ArmarioCloset`, `ArmarioCorredor`, `ArmarioEscritorio`, `ArmarioHomeTheater`, `ArmarioDormitorioEmpregada`, `Mobiliado`, `ArCondicionado`, `Hidromassagem`, `Lareira`, `Adega` |
| Pisos | `PisoCeramica`, `PisoLaminado`, `PisoPorcelanato`, `PisoTacoMadeira`, `PisoGranito`, `PisoMarmore`, `PisoAquecido`, `PisoBloquete`, `CarpeteMadeira`, `CarpeteNylon`, `CimentoQueimado`, `ContraPiso` |
| Construcao | `AnoConstrucao`, `AnoReforma`, `PeDireitoDuplo`, `AlturaPeDireito`, `AreaComum`, `AreaPrivativa` |

Recomendacao inicial: guardar caracteristicas em estrutura normalizada propria (`caracteristicas` + relacao por imovel) ou JSONB controlado no primeiro ciclo, preservando o nome original em `origem_campo` para auditoria de importacao.

## Formatos reais observados

| Tipo | Formato observado | Observacao |
|-|-|-|
| Data | `AAAA-MM-DD` | Ex.: cadastro e exclusividade |
| Data-hora | `AAAA-MM-DD HH:mm:ss` | Ex.: atualizacao |
| Decimal | Digitos com separador decimal quando necessario | Usado em precos e algumas areas |
| Inteiro | Digitos | Usado em quantidades, codigos e areas inteiras |
| Booleano | `0/1`, `1` somente, ou `Sim/Nao` dependendo do campo | Precisa normalizacao por campo |
| Campo vazio | Elemento presente sem conteudo | Ocorre em campos como `Regiao`, `AreaUtil`, `NomeCondominio`, `NomeEdificio`, `CodigoImovelAuxiliar` |
| URL | URL completa em campos de midia/link | Nao registrada neste documento |

## Duplicidades, inconsistencias e anomalias

* `CodigoImovel` nao apresentou duplicidade nos 2.206 registros.
* 62 imoveis possuem preco de venda e preco de locacao simultaneamente.
* `latitude` e `longitude` aparecem em todos os registros, mas 1.220 usam zero, que deve ser tratado como ausencia de coordenada.
* `Numero` aparece em todos os registros, mas 255 usam zero, provavelmente ausencia ou ocultacao.
* `QtdDormitorios` aparece em todos os registros, mas 751 usam zero; isso pode ser valido para terrenos/comerciais ou ausencia semantica.
* `Regiao` aparece em todos os registros, mas vazio em todos.
* `PrecisaReforma` aparece como `1` em todos os registros; nao e seguro inferir que todos precisam de reforma.
* `LinkVideo` aparece em 2.176 registros, mas foi inferido como texto/URL parcial; precisa validacao antes de publicar.
* Existem campos codificados sem semantica documentada: `TipoOferta`, `PublicaValores`, `TipoLocacao`.

## Campos sensiveis ou internos

Nao devem ir para a API publica sem regra explicita de produto/seguranca:

* URL do feed, query string e token de acesso.
* Dados de corretor: `/corretor/nome`, `/corretor/email`, `/corretor/telefone`, `/corretor/celular`, `/corretor/foto`.
* Endereco completo: `Endereco`, `Numero`, `ComplementoEndereco`, `CEP`, `PontoReferenciaEndereco`.
* Campos operacionais/internos: `CodigoCliente`, `Ocupador`, dados de origem e links internos da origem.
* Textos livres como `Observacao`, `FotoDescricao` e `FotoTitulo` devem passar por sanitizacao e revisao de regras antes de publicacao.

## Identificacao da fonte externa

A fonte deve ser identificada no CRM como uma fonte XML externa configurada por `PROPERTY_FEED_URL`. Alguns nomes de campo indicam legado/formato da origem atual, por exemplo `URLGaiaSite`, mas isso nao deve virar dependencia estrutural.

O contrato interno deve depender de conceitos do catalogo, nao dos nomes do fornecedor. O adaptador inicial deve mapear este XML para o contrato normalizado e armazenar `origem_fornecedor`, `origem_id` e metadados de importacao suficientes para rastreabilidade.

## Proposta inicial de contrato normalizado

```ts
type ImovelNormalizado = {
  origem: "xml";
  origemFornecedor: string;
  origemId: string;
  codigo: string;
  titulo: string;
  descricao: string;
  tipo: string;
  subtipo?: string;
  finalidade: "venda" | "locacao" | "venda_locacao" | "nao_definida";
  categoriaUso?: "residencial" | "comercial" | "rural" | "industrial" | "corporativa";
  statusComercial?: string;
  publicarOrigem: boolean;
  publicaValoresCodigo?: string;
  precoVenda?: number;
  precoLocacao?: number;
  precoCondominio?: number;
  precoIptu?: number;
  areaTotal?: number;
  areaUtil?: number;
  unidadeArea: "m2";
  quartos?: number;
  suites?: number;
  banheiros?: number;
  vagas?: number;
  vagasCobertas?: number;
  vagasDescobertas?: number;
  localizacao: {
    pais: string;
    estado: string;
    cidade: string;
    bairro?: string;
    bairroOficial?: string;
    latitude?: number;
    longitude?: number;
    enderecoPrivado?: {
      logradouro?: string;
      numero?: string;
      complemento?: string;
      cep?: string;
      referencia?: string;
    };
  };
  condominio?: {
    nome?: string;
    edificio?: string;
    fechado?: boolean;
  };
  midias: Array<{
    urlOrigem: string;
    tipo: string;
    principal: boolean;
    titulo?: string;
    descricao?: string;
    nomeArquivoOrigem?: string;
  }>;
  videos?: Array<{
    tipo: "video" | "tour_virtual";
    urlOrigem: string;
  }>;
  caracteristicas: Array<{
    chaveOrigem: string;
    nome: string;
    valor: boolean | number | string;
  }>;
  datasOrigem: {
    cadastradoEm?: string;
    atualizadoEm?: string;
    imovelAtualizadoEm?: string;
  };
  camposOrigemSemMapeamento?: Record<string, unknown>;
};
```

## Mapeamento XML para contrato normalizado

| XML | Contrato normalizado | Observacao |
|-|-|-|
| `CodigoImovel` | `codigo`, `origemId` | Identificador principal; manter tambem como `origem_id` |
| `CodigoImovelAuxiliar` | `camposOrigemSemMapeamento.codigoAuxiliar` | Usar somente apos confirmar significado |
| `TituloImovel` | `titulo` | Publicavel apos sanitizacao |
| `Observacao` | `descricao` | Publicavel somente apos sanitizacao e revisao |
| `TipoImovel` | `tipo` | Mapear para taxonomia interna |
| `SubTipoImovel` | `subtipo` | Mapear para taxonomia interna |
| `Finalidade` | `categoriaUso` | Nao confundir com venda/locacao; indica uso do imovel |
| `PrecoVenda` + `PrecoLocacao` | `finalidade`, `precoVenda`, `precoLocacao` | Venda/locacao inferida pela presenca de precos, salvo regra futura |
| `TipoOferta` | `camposOrigemSemMapeamento.tipoOferta` | Codigo sem semantica confirmada |
| `StatusComercial` | `statusComercial` | Pode orientar lancamentos |
| `Publicar` | `publicarOrigem` | Todos vieram como `1` |
| `PublicaValores` | `publicaValoresCodigo` | Codigo sem semantica confirmada |
| `PrecoCondominio` | `precoCondominio` | Decimal |
| `PrecoIptu` | `precoIptu` | Decimal |
| `AreaTotal` | `areaTotal` | Inteiro no XML |
| `AreaUtil` | `areaUtil` | Vazio deve virar `null` |
| `UnidadeMetrica` | `unidadeArea` | Normalizar `M2` para `m2` |
| `QtdDormitorios` | `quartos` | Zero precisa regra por tipo |
| `QtdSuites` | `suites` | Ausente vira `null` |
| `QtdBanheiros` | `banheiros` | Ausente vira `null` |
| `QtdVagas` | `vagas` | Ausente vira `null` |
| `QtdVagasCobertas` | `vagasCobertas` | Ausente vira `null` |
| `QtdVagasDescobertas` | `vagasDescobertas` | Ausente vira `null` |
| `Pais`, `Estado`, `Cidade` | `localizacao.pais/estado/cidade` | Normalizar texto e UF |
| `Bairro`, `BairroOficial` | `localizacao.bairro/bairroOficial` | Confirmar qual guia busca e SEO |
| `Endereco`, `Numero`, `ComplementoEndereco`, `CEP`, `PontoReferenciaEndereco` | `localizacao.enderecoPrivado` | Privado por padrao |
| `latitude`, `longitude` | `localizacao.latitude/longitude` | Zero deve virar `null` |
| `NomeCondominio`, `NomeEdificio`, `CondominioFechado` | `condominio` | Separar condominio/edificio no schema futuro |
| `Fotos/Foto/*` | `midias[]` | Baixar para Blob privado em fase futura, se aprovado |
| `LinkVideo`, `TourVirtual` | `videos[]` | Validar URL/formato antes da API |
| Caracteristicas booleanas | `caracteristicas[]` | Preservar `chaveOrigem` |
| `DataCadastro`, `DataAtualizacao`, `DataAtualizacaoImovel` | `datasOrigem` | Guardar para idempotencia e diagnostico |
| `corretor/*` | sem API publica | Dado sensivel/interno |

## Campos sem correspondencia segura

* `TipoOferta`, `PublicaValores`, `TipoLocacao`: codigos numericos sem dicionario confirmado.
* `PrecisaReforma`: valor `1` em todos os imoveis; nao inferir booleano real sem confirmacao.
* `Regiao`: sempre vazio.
* `CodigoCliente`: identificador interno da fonte.
* `URLGaiaSite`: link da origem; util para rastreabilidade interna, nao para contrato publico.
* `Ocupador`, `Ocupacao`, `Locado`: podem indicar estado comercial interno; publicar somente com decisao explicita.
* `FaceImovel`, `PadraoImovel`, `PadraoLocalizacao`, `Zoneamento`: campos uteis para curadoria, mas precisam de taxonomia/visibilidade definida.

## Decisoes de negocio pendentes antes do schema

1. Confirmar se venda/locacao deve ser inferida pela presenca de `PrecoVenda` e `PrecoLocacao` ou por outro campo da origem.
2. Definir semantica dos codigos `TipoOferta`, `PublicaValores` e `TipoLocacao`.
3. Decidir tratamento de zeros: coordenadas `0`, numero `0` e dormitorios `0`.
4. Confirmar qual bairro prevalece: `Bairro` ou `BairroOficial`.
5. Definir se endereco completo, CEP, numero e complemento ficam sempre privados.
6. Confirmar se dados de corretor devem ser descartados, armazenados internamente ou vinculados a usuarios do CRM.
7. Definir taxonomia interna para tipo/subtipo/finalidade e como lidar com valores raros.
8. Confirmar regra para imoveis com venda e locacao simultaneas.
9. Definir se fotos devem ser importadas para Vercel Blob ou referenciadas temporariamente pela URL da origem.
10. Confirmar se `StatusComercial` deve gerar entidades de lancamento/condominio ou apenas flag no imovel.
11. Definir quais caracteristicas serao filtros publicos e quais ficam apenas como detalhes.
12. Confirmar mapeamento de `Filial` para unidade de publicacao (`premium`, `matriz` ou ambas).
13. Definir se textos livres precisam de revisao humana antes da primeira publicacao via API.
