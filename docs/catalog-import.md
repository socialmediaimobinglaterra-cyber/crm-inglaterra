# Banco e importacao do catalogo

Implementacao local de 2026-09-16. Migracao `007_catalog_import.sql` aplicada no Neon. As migracoes anteriores permanecem intactas.

## Estrutura

- `catalog_sources`: identificacao interna; nao guarda URL ou credenciais.
- `sincronizacoes_log`: execucoes, estado, contagens, motivos controlados e alertas agregados; nenhum XML ou texto de erro externo.
- `imoveis`: identidade unica por fonte/ID externo, codigo publico, snapshot normalizado JSONB, endereco privado separado, curadoria separada, referencias opcionais de bairro/condominio/lancamento, precos NUMERIC indexados, estado de publicacao e presenca na fonte.
- `bairros`, `condominios`, `lancamentos`: estrutura inicial. Bairros sao deduplicados por nome/cidade/UF. Nomes de edificios e status comerciais da origem nao criam relacionamentos automaticamente.
- `unidades_publicacao`: publicacao/curadoria por Premium ou Matriz, para imovel, condominio ou lancamento. A importacao nao escreve nesta tabela.

`dados_origem` e dado interno, nao DTO publico. A API futura devera compor o contrato com curadoria, disponibilidade e unidades efetivamente aprovadas, e usar o DTO por allowlist. Nunca enviar o snapshot diretamente aos sites.

## Execucao

Com as variaveis deste projeto ja configuradas em `.env.local`:

```powershell
# Somente leitura do feed: nenhuma carga do catalogo.
node --env-file=.env.local --import tsx scripts/import-catalog.ts

# Gravacao no Neon: executar somente apos autorizacao da carga real.
node --env-file=.env.local --import tsx scripts/import-catalog.ts --apply
```

O script usa a fonte interna `property-feed` e o adaptador `property-xml-v1`. A interface `CatalogFeedAdapter` permite outros adaptadores sem mudar as consultas de persistencia. O agendamento acrescentado em 22/09 esta descrito abaixo; a API publica dos sites nao permite iniciar importacoes.

## Seguranca e consistencia

- HTTPS, sem redirecionamento automatico e timeout de download de 120 segundos. URL vem somente de `PROPERTY_FEED_URL`; nunca e impressa ou persistida.
- Parser SAX `saxes`; XML bruto nao e salvo em disco. Leitura incremental, com limite de 64 MiB, 20 mil imoveis, 1.000 fotos por imovel e profundidade 16. DTDs e XML malformado sao recusados. O snapshot normalizado completo permanece em memoria ate a validacao terminar.
- XML vazio, truncado, com IDs repetidos ou registros rejeitados impede a aplicacao inteira. A execucao registra falha e conserva o catalogo anterior.
- Snapshot validado entra em tabela temporaria em lotes de 100. Aplicacao, contagens e sucesso do log usam a mesma transacao; advisory lock por fonte impede aplicacoes concorrentes. Execucao antiga nao sobrescreve uma mais nova.
- Identidade unica evita duplicacao. Hash de conteudo exclui a data de captura; reimportacao identica preserva `updated_at`.
- Origem manual, curadoria, publicacao por unidade e vinculos manuais com condominios/lancamentos nao sao sobrescritos.
- Ausencia na fonte apenas muda `fonte_presente`; nao exclui nem desativa o imovel. Revisao de retirada/publicacao pertence a curadoria. Respostas incompletas nunca provocam exclusao em massa.
- Midias ficam pendentes de Blob/proxy; nenhuma foto e baixada nesta etapa. Dados de corretor, URL do feed e identificadores de cliente nao sao persistidos.

## Normalizacao conservadora

Negociacao deriva dos precos positivos. Valores decimais permanecem strings no contrato e NUMERIC no banco. IDs numericos preservam zeros iniciais. Os tres codigos sem documentacao permanecem metadados.

Nenhum imovel importado e publicado automaticamente: status inicial `pending_review`, ativo falso, sem unidades aprovadas. `Filial` nao e convertido automaticamente em Premium/Matriz. Tipos/subtipos recebem chave normalizada sem agrupar categorias diferentes; original preservado. Caracteristicas reconhecidas permanecem `pending_review`, sem inventar o significado de ausencia ou do valor `1`.

Datas locais sem fuso sao mantidas como metadados de origem; os campos ISO ficam nulos com alerta. O fuso devera ser confirmado antes da conversao. Campos textuais inadequados ficam nulos com alerta, inclusive titulo; o DTO publico exige titulo valido antes de publicacao. Filtros automaticos nao substituem curadoria de texto livre.

## Evidencias e pendencias

- Feed real lido integralmente: 2.221 imoveis, 45.152 fotos, zero registros rejeitados apos normalizacao. 44 ocorrencias de texto exigem revisao; 4.442 campos de data exigem fuso. Esses numeros sao da leitura atual, nao substituem o historico da descoberta anterior.
- Teste local: parsing em chunks, privacidade, valores decimais, zeros, DTD, duplicidade, XML incompleto/vazio, preco invalido e titulo privado.
- Neon com fixtures: primeira carga, repeticao sem duplicar, atualizacao de preco, preservacao de manual/curadoria/unidade, falhas sem alterar catalogo e concorrencia. Fixtures removidas ao final.
- Build aprovado. Sem execucao das baterias de autenticacao, pois esta entrega nao alterou esses caminhos.
- Carga real autorizada e aplicada no Neon: 2.221 inseridos, zero rejeitados. Segunda execucao: zero inseridos, zero atualizados e 2.221 inalterados. Consulta somente leitura confirmou 2.221 IDs distintos, 45.152 referencias de fotos, todos pendentes de revisao/inativos e nenhuma unidade de publicacao. Ambas as execucoes possuem log de sucesso. As imagens ainda nao foram copiadas para Blob.
- O audit inicial apontou 1 aviso critico em Next.js 15.5.23 e 2 altos em PostCSS/sharp. Corrigidos localmente em 2026-09-17: Next 15.5.24, PostCSS 8.5.28 e sharp 0.35.4. Audit da instalacao sem vulnerabilidades conhecidas. Build e verificacoes locais de rotas/middleware e processamento de imagem aprovados; correcao ainda nao publicada.
- Nao houve commit, push ou deploy. Nenhum site foi alterado.

## Sincronizacao diaria - 2026-09-22

- Usuario aprovou execucao diaria as 03h de Brasilia e uma carga imediata. `vercel.json` preparado com `0 6 * * *` (06h UTC, equivalente a 03h America/Sao_Paulo no fuso vigente). Revisar a conversao se houver mudanca oficial de fuso. Nao depende do computador local.
- Endpoint operacional `/internal/cron/catalog-sync`, separado da API publica. Aceita somente GET com `Authorization: Bearer <CRON_SECRET>` em `VERCEL_ENV=production`. Falha fechada se o segredo faltar, tiver menos de 32 caracteres ou contiver espacos. Comparacao de hashes em tempo constante; nenhum segredo em URL ou log. HEAD/OPTIONS/metodos de escrita retornam 405 sem executar; local e preview retornam 404.
- URL e identidade da fonte sao fixas no servidor; parametros de consulta sao recusados. Reutiliza `importCatalog`, validacao integral e aplicacao transacional existentes; nenhuma nova regra de curadoria, vinculos ou fotos. Limite da Function de 300 segundos. Logs de inicio/sucesso/falha controlada continuam em sincronizacoes_log; encerramento forcado pode deixar running e deve ser investigado pelo log Vercel, nao interpretado como sucesso.
- Repeticoes sao idempotentes quanto ao catalogo, mas podem registrar novas execucoes. Locks existentes serializam a aplicacao e rejeitam snapshots antigos; duas chamadas concorrentes ainda podem baixar o XML em paralelo. Falhas retornam 503 generico, sem XML ou credenciais. Nao ha retry automatico implementado ou promessa de alerta por e-mail.
- Ativacao pendente: no painel do projeto CRM da Vercel, confirmar `DATABASE_URL` e `PROPERTY_FEED_URL` em Production e cadastrar `CRON_SECRET` aleatorio com pelo menos 32 caracteres. Nao copiar segredos para o repositorio/chat. Depois publicar via push autorizado no GitHub e confirmar o cron no painel; nenhum CLI Vercel usado.
- Referencias: https://vercel.com/docs/cron-jobs/quickstart e https://vercel.com/docs/cron-jobs/manage-cron-jobs . A Vercel envia o segredo pelo header; cron em producao depende do deploy e das configuracoes do projeto.
- Testes locais de autenticacao/ambiente/metodos/parametros/cache/falha e horario aprovados; regressao do parser aprovada. Build e smoke HTTP do Next aprovados: local GET 404, outros metodos 405, todos no-store. Sem executar o agendamento em producao nesta etapa.

### Resultado da carga imediata autorizada

- XML atual: 2.221 imoveis, 45.199 referencias de fotos, zero rejeitados. Aplicacao: 42 inseridos, 1.640 atualizados, 539 inalterados, 42 ausentes, zero manuais afetados. Ausentes permanecem no CRM mas deixam de ser elegiveis na API enquanto fora da fonte.
- Consulta posterior: 2.263 imoveis externos armazenados, 2.221 presentes. CA2054 continua sem correspondencia pelo codigo atual ou referencias textuais nos dados de origem. Nao foi criado, publicado nem renumerado um cadastro para simular sua presenca.
- Fotos nao foram baixadas; vinculacao dos novos imoveis a condominios nao e automatica nesta importacao. Curadoria e vinculos existentes nao sao sobrescritos pelo SQL de importacao. Nao houve mudanca no site Premium.
