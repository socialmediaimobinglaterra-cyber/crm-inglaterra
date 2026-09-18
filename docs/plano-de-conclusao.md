# Plano de conclusao do CRM

Sequencia aprovada pelo usuario em 2026-09-16. Complementa o plano de arquitetura; preserva stack, seguranca e limites de acesso aos repositorios.

## Objetivo operacional

Importar imoveis reais, revisa-los e administra-los em uma interface simples, e publica-los no Inglaterra Premium por API segura. Contatos e metricas completam o projeto depois dessa primeira entrega operacional.

## Entregas e aceite

| Ordem | Entrega | Criterio de fechamento | Estado |
| --- | --- | --- | --- |
| 1 | Correcoes concentradas de seguranca e contrato | Corrigir exposicao no DTO publico, validacao de midia, deduplicacao de bloqueios com e-mails variaveis, emissao concorrente de codigos e ordem de locks dos convites; completar validacao de IDs/UF e publicacao por unidade. Verificar os cenarios afetados e revisar o diff uma vez ao final. | Concluida localmente; validada, sem publicacao |
| 2 | Banco e importacao XML | Importacao real pelo adaptador, repetivel sem duplicar; relatorio de resultado; falha parcial preserva catalogo valido; cadastro manual e curadoria protegidos. | Carga real e idempotencia aprovadas no Neon; sem publicacao nos sites |
| 3 | Interface operacional do catalogo | Busca, filtros, cadastro/edicao, imagens, curadoria e publicacao de imoveis, lancamentos e condominios; fluxo principal validado pelo usuario. | Em andamento: listagem, busca, negociacao e abertura do editor confirmadas pelo usuario |
| 4 | API e transicao do Premium | API de leitura com dados publicos por unidade; paridade de conteudo, precos, fotos, filtros e URLs; plano de retorno antes da troca; remover legado somente apos validacao. | Pendente |
| 5 | Contatos e metricas | Configuracoes de contato autorizadas/auditadas e metricas reais, conforme as fases 6 e 7 da arquitetura. | Pendente |

O acesso ao repositorio do site depende de autorizacao especifica. Este plano nao autoriza commit, push, deploy ou alteracoes de configuracao por si so.

## Experiencia de uso

- Navegacao consistente e acesso facil a conta e logout.
- Priorizar encontrar imovel, revisar, editar e publicar.
- Separar claramente dados privados e informacoes publicadas no site.
- Formularios organizados, mensagens claras, protecao contra perda de edicao e confirmacao de acoes destrutivas.
- Estados de carregamento e erro, acessibilidade e layout funcional em desktop e mobile.
- Relatorio de importacao compreensivel, com pendencias acionaveis.

## Execucao e testes proporcionais

1. Trabalhar uma entrega com escopo fechado; dividi-la apenas quando houver dependencia real ou tamanho que prejudique a revisao.
2. Reunir implementacao, testes necessarios e revisao no mesmo ciclo, sem exigir prompts repetidos para verificar o mesmo resultado.
3. Para cada correcao, testar o cenario que revela o defeito e as regressoes diretamente afetadas. Concorrencia SQL exige validacao PostgreSQL; fixtures locais nao comprovam comportamento do Neon.
4. Executar build ao fechar alteracoes de codigo. Repetir somente se uma alteracao posterior afetar o resultado ou houver falha/evidencia nova. Documentacao exige apenas revisao e `git diff --check`.
5. Nao rodar toda a bateria por padrao. Ampliar testes quando o impacto compartilhado justificar, registrando brevemente o motivo.
6. Validacao manual concentra-se no fluxo de negocio e experiencia de uso, sem repetir o que ja foi demonstrado para a mesma versao.
7. Passados os criterios e a revisao final, encerrar a entrega e avancar. Reabrir apenas por defeito concreto novo, mudanca de requisito ou dependencia descoberta.
8. Registrar resultado, pendencias reais e proximo passo aqui. Distinguir dados simulados, verificacao local e producao; nunca declarar validacao que nao ocorreu.

## Ponto de retomada

Correcoes da entrega 1 implementadas em 2026-09-16. Sem novas migracoes ou alteracao das existentes.

A fundacao de autenticacao possui validacao de producao registrada na arquitetura. As correcoes desta entrega ainda nao foram publicadas. As alteracoes locais anteriores foram preservadas.

## Registro tecnico da entrega 1

- Emissao e consumo de codigo compartilham advisory lock transacional por e-mail; o teste usa identidade temporaria, nunca o administrador real.
- Bloqueios da auditoria sao deduplicados por IP, motivo e intervalo fixo de 15 minutos, independentemente do e-mail. A primeira ocorrencia representa o grupo. Isso limita repeticoes do mesmo IP, nao ataques distribuidos entre muitos IPs.
- Criacao, reenvio, revogacao e aceite de convite compartilham advisory lock por destinatario antes dos locks de registros. A limpeza encerra sua propria transacao antes da operacao para nao inverter essa ordem.
- DTO publico exige unidade publicada, estado publicado e disponibilidade; omite alertas, metadados e valores originais. Caracteristicas publicas usam projecao e validacao proprias.
- IDs numericos sao aceitos como strings, preservando zeros iniciais; UF usa a lista brasileira; unidades de publicacao nao aceitam duplicatas.
- Midia privada exige proxy. `toPublicCatalogItem` recebe `mediaOrigin` somente de configuracao confiavel do servidor; libera apenas HTTPS nessa origem e caminho `/api/blob-image/`, sem credenciais, query ou fragmento. Sem politica configurada, URL publica e nula. O proxy e a integracao Blob ainda pertencem a entrega de imagens; fixtures nao comprovam sua existencia.
- Filtros de texto nao substituem curadoria de descricoes/caracteristicas antes da publicacao do feed real.

Validacao: `test:catalog-contract` com fixtures anonimizadas; `test:auth-concurrency`, `test:auth-audit`, `test:user-invites` e `test:login-validation-rate-limit` no Neon, todos aprovados, com dados temporarios removidos ao final e sem envio de e-mail. Build unico aprovado e diff revisado. Testes de banco inicialmente bloqueados por EACCES foram executados com permissao de rede. Regressoes limitadas aos caminhos afetados.

## Ponto de retomada atualizado

Entrega 2 documentada em `docs/catalog-import.md`. Migracao 007 aplicada; adaptador e testes de banco aprovados. Apos autorizacao explicita, carga real inseriu 2.221 imoveis e 45.152 referencias de fotos. Segunda execucao manteve os 2.221 registros inalterados, sem insercoes ou atualizacoes. Consultas somente leitura confirmaram ausencia de duplicatas, todos inativos/pendentes e nenhuma unidade publicada. Nao ha agendamento automatico nem migracao de imagens para Blob nesta entrega.

Proxima acao: curadoria/publicacao por unidade. Catalogo e galeria publicados nos commits 9bfc219 e f6b02b9. Usuario confirmou no fluxo de producao: selecao de fotos, miniaturas, salvamento, persistencia apos atualizar e alteracao persistente da principal. Nao repetir esses testes sem mudanca relevante. Permissao confirmada: admin e cadastro podem cadastrar, editar e publicar; corretor pode cadastrar/editar, mas nao publicar. Antes de implementar elegibilidade automatica, confirmar regras comerciais do Premium; nao existem criterios concretos de preco/tipo/localizacao documentados neste repositorio. Nenhum acesso ao repositorio do site autorizado.

## Preparacao da migracao gradual de fotos - 2026-09-17

- Commit c7c6807 enviado; usuario confirmou a secao Publicacao por unidade em producao. Acesso publico por HTTPS validado, com login e protecao das rotas privadas. Isso nao valida novas operacoes autenticadas em producao.
- Preflight somente leitura no Neon: 45.152 referencias de fotos em 2.221 imoveis; 37.608 URLs distintas; 3.624 referencias HTTP. Host observado: lh3.googleusercontent.com. Contagens refletem o banco atual, nao uma nova leitura do feed.
- Blob sem token/OIDC local disponivel. Nao copiar credencial de producao nem alterar configuracao. Executor real precisa rodar em ambiente autorizado com Blob, preferencialmente na Vercel com OIDC existente.
- Usuario aprovou como piloto o imovel aberto no editor (ID configurado exclusivamente no servidor), limitado a 3 fotos. Preservar galeria manual e publicacao.
- Executor implementado em `/admin/image-pilot`: somente admin ativo confirmado no banco, uma foto por POST, selecao persistente das primeiras 3 URLs unicas na ordem da fonte. Nao recebe URL, identidade de ator ou ID de imovel do formulario. Nenhuma execucao no GET.
- Migracao 012 aplicada no Neon: tabela de controle com slots 1-3, hash por URL/imovel, tentativa com identificador, limite de 3 tentativas por foto e expiracao de processamento em 10 minutos. Transacoes curtas bloqueiam usuario e imovel; download/Blob fora da transacao. Recibos concluidos permanecem apos exclusao de imagem, evitando reimportacao silenciosa.
- Downloader restrito ao hostname exato observado no feed, sem credenciais, portas alternativas, redirecionamentos ou fallback HTTP. Upgrade para HTTPS, IPv4 resolvido e verificado contra redes reservadas/privadas antes da conexao TLS, limite de 15 segundos e 4 MB em streaming. Reutiliza validacao por bytes/pixels, WebP e remocao de metadados.
- Fotos sao anexadas depois da galeria existente; principal existente nunca e substituida. Sem principal existente, primeira foto concluida torna-se principal. Videos e migracao global/deduplicacao entre imoveis ficam fora do piloto. Falhas conservam intencao de limpeza na fila existente; sem trafego, arquivos pendentes podem aguardar limpeza.
- Teste image-pilot no Neon aprovado: autorizacao, concorrencia, limite, deduplicacao, retry de envio parcial, preservacao da galeria/principal, remocao sem reimportacao e publicacao intacta. Download e Blob simulados no teste; fixtures removidas. Build e diff check aprovados.
- Amostra real do piloto baixada e processada somente em memoria: 97.022 bytes de origem, WebP de 88.682 bytes, 1024x768. Nenhuma URL sensivel registrada, nenhum arquivo persistido, nenhum envio ao Blob. Transferencia real depende de commit/push autorizado e execucao na Vercel com OIDC. Sem novas credenciais locais, commit ou push nesta entrega.

- Em 2026-09-18, usuario autorizou commit/push do piloto para disponibilizar a pagina em producao. Teste e build finais aprovados, sem mudanca posterior de codigo; nao repetidos. Aceite com transferencia real para Blob permanece pendente apos deploy automatico pelo GitHub.

## Aceite do piloto de fotos em producao - 2026-09-18

- Piloto publicado pelo commit `4636c37`; usuario confirmou abertura de `/admin/image-pilot` no dominio oficial.
- Usuario executou as tres transferencias e confirmou as fotos na galeria, preservando as fotos anteriores e a principal. Aceite manual com fotos reais e Blob de producao, nao apenas simulacao.
- Sem falha relatada neste fluxo. Esta confirmacao nao constitui validacao de migracao em massa, custos ou integracao publica com o site.
- Proximo passo: preparar migracao gradual em lotes retomaveis, com limites de processamento, acompanhamento de falhas e controle de custos antes de ampliar a execucao. Nenhuma transferencia adicional autorizada ou iniciada neste registro.
- Alteracao somente documental; testes/build nao repetidos. Sem novo commit/push.

## Lotes retomaveis de fotos - 2026-09-18

- Nova rota `/admin/image-migration`, exclusiva de admin ativo confirmado no banco na pagina, nas actions e nas consultas. Selecao explicita por codigo do imovel, de 1 a 10 fotos por lote. Preparar lote grava somente a selecao; transferir exige outro clique. Nao ha scheduler nem selecao automatica de todo o catalogo.
- Migracao `013_catalog_image_batches.sql` aplicada no Neon com autorizacao explicita. Mantem os recibos da tabela do piloto e amplia seus slots ate o teto existente de 1.000 imagens; adiciona cabecalho/itens de lote e contadores de bytes. Migracoes anteriores imutaveis. Fotos concluidas no piloto ou posteriormente removidas nao sao reimportadas.
- Selecao fixa e deduplicada por URL canonica/imovel, na ordem da fonte. Criacoes concorrentes retomam o mesmo lote inacabado. Cada requisicao transfere uma foto; o navegador continua somente o lote escolhido, sequencialmente. Pausar interrompe as proximas requisicoes, sem cancelar uma gravacao em andamento. Fechar a pagina para a continuacao; a foto em andamento pode concluir. Retomada pelo mesmo lote, inclusive apos recarregar.
- Reutiliza downloader HTTPS restrito, validacao real, WebP, miniatura e Blob privado. Locks usuario/imovel, lease de 10 minutos, identificador por tentativa e maximo de 3 tentativas por foto no banco; sem transacao aberta durante rede. Limite de 10 fotos e 30 tentativas por lote; falhas param a continuacao automatica. Limite esgotado exige revisao, nao cria tentativa nova por preparar outro lote.
- Progresso, falhas padronizadas e volumes visiveis, sem URLs, hashes ou erros internos. Downloads completos contam inclusive retries; bytes gravados representam imagens/miniaturas confirmadas, nao toda a cobranca Blob. Downloads interrompidos, operacoes, trafego de leitura e arquivos aguardando limpeza nao sao uma estimativa financeira. Custo monetario depende da conta; nao foi inventado orcamento ou preco. Nao ha deduplicacao fisica entre imoveis nesta etapa.
- Preserva fotos manuais, ordem/principal existentes e estado de publicacao. Reaproveita fila de limpeza de arquivos pendentes; sem trafego, limpeza continua podendo aguardar. URL alterada pela origem e considerada nova referencia; nao tenta inferir identidade visual nem substitui automaticamente foto anterior.
- `test:image-batches --db` aprovado no Neon: entradas estritas, bloqueio de corretor/cadastro/inativo/ausente, criacao concorrente/idempotente, reaproveitamento do piloto, concorrencia de transferencia, retomada, falha parcial, teto de retries, recuperacao de lease, contadores, galeria/publicacao preservadas e projecao segura. Fixtures exclusivas removidas e ausencia confirmada. Downloads e Blob simulados; nenhum arquivo real transferido. Teste local `test:image-pilot` e build aprovados.
- Navegador local autenticado: tela inicial renderizada e legivel, formulario e estado sem lotes conferidos. GET sem sessao redireciona para `/login`. Fluxo visual com lote, pausa/retomada e envio real ainda pendente; nao confundir testes do servico com aceite do navegador em producao.
- Sem commit/push/deploy. Proximo passo: validar a interface do lote e publicar somente com autorizacao; depois executar um lote pequeno aprovado antes de ampliar volume. O site Premium e suas integracoes permanecem inalterados.
- Usuario autorizou commit/push em 2026-09-18. Codigo sem mudanca desde os testes/build aprovados; verificacao final do diff, sem repetir a bateria. O deploy nao executa transferencias; validacao real do lote continua pendente.

## Aceite dos lotes em producao - 2026-09-18

- Versao publicada no commit `a840b0a`. Usuario confirmou a abertura da pagina e preparou um lote de 3 fotos para AP0104.
- Screenshot confirmou pausa apos 1/3 transferencias e 1/9 tentativas, com duas fotos pendentes. Usuario confirmou que atualizar a pagina preservou o progresso sem iniciar transferencia automaticamente.
- Retomada concluida: screenshot mostrou 3/3 transferidas, 3/9 tentativas e Lote concluido, sem repetir a primeira transferencia. Volumes exibidos: 0,12 MB de downloads completos e 0,13 MB de imagens/miniaturas gravadas; valores arredondados, nao estimativa de cobranca.
- Usuario confirmou as tres novas fotos na galeria, preservando as anteriores e a principal. Fluxo real de lote, pausa, persistencia e retomada aprovado em producao, sem falha relatada.
- Registro documental somente; sem nova transferencia, consulta ao banco, teste/build, commit ou push. Migracao global e custos em escala nao foram validados por este lote.

## Ampliacao controlada e proxima entrega - 2026-09-18

- Usuario decidiu manter a Vercel. Captura confirmou upgrade para Pro; usuario confirmou salvar alerta de US$ 5 de consumo adicional, com pausa automatica desligada. Alerta nao constitui teto de cobranca. Nenhuma configuracao alterada pelo agente.
- Novo lote de AP0104 concluido em producao: 10/10 fotos, 10 tentativas, 0,87 MB de downloads completos e 0,92 MB de imagens/miniaturas gravadas, conforme captura. Usuario confirmou fotos visiveis e principal preservada. Nao repetir os testes anteriores sem mudanca relevante.
- Estes volumes pertencem somente ao lote, nao representam media confiavel de todo o catalogo nem custo total de operacao. Migracao global permanece sem autorizacao.
- Proxima entrega: API somente leitura para imoveis por unidade e entrega segura de imagens publicadas, reutilizando o contrato normalizado. O DTO existente nao equivale a uma API implementada; o proxy atual de imagens exige sessao administrativa.
- Antes de definir o contrato de integracao, solicitar acesso somente leitura ao repositorio do Premium para levantar campos, filtros, paginacao, URLs e consumo de imagens atuais. O acesso depende de autorizacao especifica e identificacao do repositorio pelo usuario. Nao alterar o site, trocar sua fonte de dados ou remover o legado nesta etapa.
- A implementacao devera preservar selecao explicita de campos publicos, publicacao/disponibilidade por unidade, validacao de entradas, limites de consulta, rate limiting, CORS restrito e politica de cache compativel com retirada de publicacao. Origens permitidas e requisitos de compatibilidade ainda precisam ser confirmados; nao inventar configuracoes.
- Gestao de lancamentos/condominios e integracao final continuam pendentes; esta proxima entrega nao encerra todo o escopo do catalogo. Registro documental apenas, sem banco, transferencia, build, commit, push ou deploy.

## API inicial de imoveis - 2026-09-18

- Usuario autorizou consulta somente leitura ao repositorio Premium. Codigo `00445b8` analisado sem clonar, executar ou modificar o site; nenhum acesso ao banco do site. Filtros, paginas, slugs e dependencias editoriais identificados.
- API GET de listagem/detalhe/filtros por unidade e proxy publico de fotos ready implementados no CRM. Privacidade por allowlist, curadoria efetiva, publicacao real por unidade, parametros estritos, precos decimais, limites e erros genericos. Proxy administrativo preservado.
- Migracao 014 aplicada no Neon com autorizacao explicita. Contadores atomicos por identificador HMAC/IP, separados de login; limite por minuto de 120 JSON/600 imagens. Fixtures exclusivas removidas ao fim do teste autorizado; nenhum imovel real ou Blob alterado.
- Testes `catalog-api --db`, regressao `catalog-contract`, build e smoke HTTP de metodos/CORS aprovados. Banco real, Blob simulado. Sem repetir testes anteriores de galeria. Servidor temporario de smoke encerrado.
- Detalhes e limites em `docs/catalog-public-api.md`. Cache publico permanece pendente: no-store inicial evita servir retirada de publicacao por cache antigo, mas exige validacao de custo/desempenho antes da escala. CORS somente para origem Premium Vercel observada; confirmar dominios customizados antes da integracao.
- API ainda nao publicada nem validada com GET/Blob publico real em producao. Sem commit/push/deploy; nenhuma alteracao no Premium. Proximos criterios: revisao final, publicacao somente com autorizacao, aceite real, politica de cache e transicao com paridade/URLs preservadas. Lancamentos/condominios e demais dependencias do site nao estao concluidos.
- Usuario autorizou commit, push e deploy desta API. Publicacao exclusivamente por push em main e webhook da Vercel, sem CLI. Testes/build anteriores preservados, sem mudanca posterior de codigo; verificacao publica sera feita apos o deploy. Esta autorizacao nao troca a fonte do site nem inicia migracao de fotos.

## Implementacao do papel corretor - 2026-09-17

- Novo papel disponivel no codigo de convites, gestao de usuarios, sessao e autorizacao de catalogo/fotos. Administracao de contas/configuracoes continua exclusiva de admin ativo confirmado no banco. Nenhuma conta real criada ou alterada.
- Migracao 011 aplicada no Neon com autorizacao do usuario: adiciona somente o valor corretor ao enum compartilhado por usuarios e convites; anteriores preservadas e nao reaplicadas. Enum e registro unico em schema_migrations confirmados por consulta somente leitura. Nenhuma conta existente alterada.
- Regra de publicacao centralizada: somente admin/cadastro. A entrega de publicacao manual abaixo aplica essa regra dentro da transacao; edicao sem pedido explicito de publicacao preserva o estado existente.
- Teste local de papeis/sessao e entradas estritas aprovado; build aprovado, nao repetido sem mudanca de codigo. Testes admin-users, catalog-editor --db, catalog-manual --corretor e catalog-images --db --corretor aprovados no Neon: convite/aceite, bloqueio administrativo, criacao/edicao, preservacao do estado de publicacao, fotos e concorrencia.
- Fixtures removidas e limpeza verificada pelos testes. Nenhum e-mail real enviado; Blob simulado, sem novo teste de OIDC/Blob real. Numeros consumidos pela sequencia de codigos de teste nao sao reutilizados. Nenhum usuario ou imovel real alterado. Validacao navegavel do novo papel em producao permanece pendente de publicacao autorizada do codigo.
- Servidor local de testes encerrado antes do build. Sem commit, push ou deploy.

## Publicacao manual por unidade - 2026-09-17

- Editor de imovel existente mostra Premium e Matriz como checkboxes. Dados, galeria e mudanca explicita de publicacao usam o mesmo Salvar alteracoes e a mesma transacao. Corretor visualiza o estado, sem habilitar controles; tentativa manipulada e negada no servidor.
- Usuario ativo e papel confirmados no banco com lock compartilhado, antes do lock exclusivo do imovel. Versao de publicacao inclui ultima alteracao do imovel e estado das unidades; rejeita pedido desatualizado. Unidades gravadas em ordem deterministica. Falha de galeria ou conflito desfaz a transacao completa.
- Usa unidades_publicacao existente: inclusao_manual explicita, sem alterar elegibilidade automatica. Uma ou mais unidades selecionadas deixam o imovel ativo/published; nenhuma deixa inativo/unpublished. Nenhum criterio comercial automatico inventado; nenhuma nova migracao.
- Teste catalog-publication aprovado no Neon: admin/cadastro autorizados, corretor/inativo/ausente e papel rebaixado bloqueados, unidades independentes, retirada de publicacao, concorrencia, rollback e origem preservada. Regressoes catalog-editor e catalog-images --corretor aprovadas; Blob simulado, fixtures removidas. Build e diff check aprovados.
- Validacao manual local concluida pelo usuario: secao clara e legivel, selecao de Premium habilitou Salvar alteracoes, salvamento concluido e opcao preservada apos atualizar. O usuario registrou a publicacao do imovel escolhido no CRM; nenhuma integracao do site alterada. Commit e push deste conjunto autorizados pelo usuario apos o aceite.
- Este estado registra a decisao no CRM, nao entrega conteudo ao site nesta etapa. API publica, migracao de fotos externas e integracao Premium continuam pendentes. A regra aprovada permite ao corretor editar conteudo de imovel ja marcado como publicado, mas nao mudar suas unidades; nao foi criado fluxo de aprovacao de revisoes.

## Historico da interface inicial do catalogo - 2026-09-17

- `/catalog`: paginacao de 25 registros, busca por codigo/titulo/bairro/cidade, filtros por negociacao e publicacao. Dados do Neon, sem lista simulada.
- `/catalog/[id]`: edicao de titulo, descricao, precos, areas e ambientes. Valores monetarios permanecem strings decimais; negociacao deriva dos precos positivos.
- Navegacao reutilizavel no dashboard, usuarios e catalogo, com logout. Sem referencia visual externa, pois `design/` nao existe.
- Sessao verificada no servidor e usuario ativo confirmado no banco para admin/cadastro. Consultas e mutacoes repetem autorizacao dentro da transacao com lock compartilhado no usuario.
- Edicao salva somente na curadoria, sem sobrescrever XML, endereco privado, midias ou publicacao. Comparacao atomica da versao da curadoria + hash da fonte rejeita edicao concorrente desatualizada. Este modulo ainda nao publica alteracoes na API/site.
- Teste `test:catalog-editor --db` executado via Node com `.env.local`: validacao estrita, precos/zeros, acessos, filtros, persistencia, conflito concorrente, preservacao da origem e publicacao. Fixtures exclusivas removidas e ausencia confirmada no Neon. Nenhum usuario/imovel real editado pelo teste.
- Build e `git diff --check` aprovados. GET sem sessao para listagem/detalhe retorna redirect de streaming do Next para `/login`, sem dados de catalogo. A resposta inicial HTTP 200 decorre do loading boundary, nao de acesso autorizado.
- Validacao manual local confirmada pelo usuario: listagem carregada com dados reais, busca funcionando, todos os filtros de negociacao funcionando e editor abrindo sem erro e legivel. Nao houve confirmacao especifica de mobile, paginacao, filtro de publicacao ou salvamento pela interface; persistencia e concorrencia foram verificadas pelo teste controlado, nao por edicao de imovel real.
- O servidor local precisou ser reiniciado com permissao de rede apos bloqueio EACCES no acesso ao Neon. Nao foi necessario alterar codigo ou credenciais.
- Cadastro manual, imagens/Blob, publicacao, edicao de localizacao/taxonomia e gestao de condominios/lancamentos continuam pendentes. Nenhuma migracao nesta etapa.

## Decisao de codigos do cadastro manual

Usuario aprovou geracao automatica, sequencia propria e ausencia de colisao com importados, mantendo sigla do tipo seguida de numero. Consulta somente leitura ao Neon confirmou 2.221 registros com duas letras e quatro digitos, sem duplicatas ou codigos fora desse padrao.

Mapeamento observado: Apartamento/AP, Barracao/BA, Casa/CA, Chacara/CH, Cobertura/CO, Fazenda/FA, Galpao/GA, Loja/LO, Predio/PR, Sala/SA, Salao/SL, Sitio/SI, Terreno/TE, Area/AR.

Tratamento de colisao aprovado: preservar os codigos existentes e atribuir outro numero livre da mesma sigla ao novo importado conflitante, mantendo a referencia original em `rawMetadata.sourcePublicCode`. A identidade da fonte/ID externo nao muda.

Implementacao: migracao `008_catalog_codes.sql` aplicada no Neon, sem editar 001-007. Indice unico por codigo sem distinguir maiusculas, reservas persistentes por ID e contador por sigla. Advisory lock transacional comum ao cadastro e importacao; codigos livres da carga sao reservados antes de gerar substitutos. Reimportacao preserva o codigo atribuido; exclusao nao libera referencia para outro imovel. Minimo de quatro digitos, com crescimento natural apos 9999. Alteracao de tipo nao renumera imovel existente.

## Cadastro manual e localizacao

- `/catalog/new`, acessivel pelo botao Novo imovel. Mesmo formulario reutilizado no editor, com classificacao, localizacao publica e endereco privado. Nao gera codigo no GET; gera somente na transacao de criacao. Repeticao da mesma submissao usa o mesmo ID e nao duplica cadastro.
- Autorizacao pelo usuario ativo no banco para admin/cadastro. Novo registro tem origem manual, inativo, pendente de revisao e sem unidade publicada. Sem imagens ficticias ou envio de e-mail.
- Edicoes publicas ficam em curadoria; endereco privado editado fica em `curadoria_privada`, coluna separada. Campos originais importados permanecem intactos. Versao otimista inclui a curadoria privada. Busca e listagem usam localizacao revisada.
- CEP validado com oito digitos; pares de coordenadas incompletos/invalidos recusados, 0/0 vira nulo, zero isolado valido e preservado. Subtipo editavel, sem inventar equivalencias entre categorias. Taxonomia original permanece na origem.
- Testes no Neon: cadastro concorrente, retry sem duplicacao, colisao manual/importado, reimportacao estavel, edicao de tipo/localizacao, codigo imutavel, privacidade e usuario inativo. Regressoes de importacao e editor aprovadas. Fixtures removidas; contadores apenas avancaram, sem reutilizar numeros de teste.
- Teste local de CEP/coordenadas aprovado. Ajustado encerramento do teste local para nao exigir DATABASE_URL quando `--db` nao e usado. Build e diff check aprovados. Nenhuma carga nova do feed real, commit, push ou deploy.
- Usuario confirmou o formulario ampliado legivel e completo. Cadastro real pelo navegador permanece pendente. Imagens sao tratadas na entrega seguinte; publicacao continua pendente.

## Galeria privada - 2026-09-17

- Migracao `009_catalog_images.sql` aplicada no Neon; anteriores preservadas. Metadados e estados pending/ready/deleting separados das referencias XML, sem nomes de arquivos enviados pelo usuario.
- Upload JPEG/PNG/WebP com validacao de assinatura e decodificacao, limite tecnico de 4 MB e 40 megapixels, remocao de metadados, conversao WebP e miniatura. Arquivos animados recusados. Limites operacionais: 1.000 imagens e cinco uploads pendentes por imovel.
- SDK Blob usa autenticacao disponivel no servidor, incluindo OIDC do ambiente Vercel. Nenhum token recuperado, rotacionado ou exposto; sem alteracoes de ambiente ou deploy. Sem credenciais locais, upload indisponivel na interface.
- Galeria com ordem, principal unica e remocao confirmada. Mutacoes autorizadas no banco, lock por imovel e versao otimista. Proxy GET privado exige sessao/usuario ativo e nao usa cache publico. API publica de imagens fica para a entrega de publicacao.
- Foto aparece apenas depois de gravar imagem e miniatura. Falhas parciais ficam rastreadas para limpeza em lotes de cinco, com SKIP LOCKED e intervalo de retry de cinco minutos. Upload pendente abandonado torna-se elegivel apos uma hora. Limpeza acionada por upload/remocao; sem trafego, pode permanecer pendente, pois nao ha scheduler nesta entrega.
- `test:catalog-images` aprovado: formatos, arquivos corrompidos, tamanho, remocao de EXIF e miniatura. Teste `--db` aprovado no Neon com Blob simulado: autorizacao, concorrencia, ordem/principal, isolamento entre imoveis, remocao e recuperacao de falhas. Fixtures removidas e ausencia confirmada. Nenhuma foto real enviada ou referencia XML migrada.
- Dependencias: `@vercel/blob`, `lucide-react` e `sharp` direto. Validacao real de OIDC/upload e validacao visual da galeria ainda pendentes; nao confundir teste simulado com aceite de producao.

## Publicacao autorizada - 2026-09-17

- Usuario confirmou visualmente o estado vazio da galeria: contador zero, referencias externas pendentes e upload local indisponivel sem autenticacao Blob. Controles com fotos e upload real ainda nao validados.
- Build final e testes da galeria aprovados antes desta revisao, sem mudanca posterior de codigo. Nao repetidos sem necessidade.
- Usuario autorizou commit/push do conjunto acumulado do catalogo e correcoes relacionadas para testar o Blob no ambiente Vercel. Deploy exclusivamente pelo webhook GitHub; sem CLI ou alteracao de configuracoes.
- Esta autorizacao nao publica imoveis no site Premium nem autoriza acesso ao repositorio do site. Migracao das fotos XML, curadoria/publicacao e integracao publica continuam pendentes.

## Edicao unificada de fotos - 2026-09-17

- Usuario confirmou upload real e miniatura em producao no fluxo anterior. Solicitou substituir envio imediato por selecao multipla com previa e um unico Salvar alteracoes.
- No editor de imovel existente, Escolher fotos abre o seletor; miniaturas locais, ordem, principal e remocoes ficam em rascunho. Nenhum envio ocorre ao selecionar. Ao salvar, cada arquivo e enviado separadamente (4 MB) e depois dados e galeria sao confirmados na mesma transacao, com verificacao das duas versoes. Falhas preservam campos e selecao na tela; arquivos ja enviados sao reutilizados na tentativa seguinte por ate 45 minutos.
- Migracao 010 aplicada no Neon: estado staged para upload completo ainda nao confirmado; migracoes anteriores inalteradas. Proxy serve somente ready. Rascunhos abandonados entram na limpeza limitada apos uma hora; ausencia de trafego continua podendo adiar a limpeza.
- Testes de imagens e editor no Neon aprovados: rollback conjunto, concorrencia, ordem/principal, staged invisivel e limpeza. Blob simulado e fixtures removidas. Build e diff check aprovados.
- Navegador local: botao abriu selecao multipla, duas imagens sinteticas apareceram como Nao salva e habilitaram Salvar alteracoes; principal alterada somente na previa; imagens sinteticas removidas sem salvar. Sem alteracao do imovel real. Imagem existente do Blob nao carrega localmente sem credencial, como esperado.
- Este ajuste cobre o editor de imovel existente. Novo imovel continua sendo cadastrado antes de abrir sua galeria. Fluxo unificado ainda nao publicado nem validado com Blob real; sem commit/push/deploy nesta etapa.

## Registro da atualizacao de seguranca - 2026-09-17

- Next atualizado de 15.5.23 para 15.5.24, mantendo a stack. Versao exata no manifesto.
- Overrides restritos ao Next: PostCSS 8.5.28 e sharp 0.35.4. O Next ainda fixa um PostCSS vulneravel e permite sharp antigo; remover overrides somente quando as dependencias nativas resolverem versoes seguras.
- Instalacao com scripts desabilitados; audit final da instalacao: zero vulnerabilidades conhecidas. Isso nao garante ausencia de vulnerabilidades ainda nao catalogadas.
- Build aprovado. Smoke test do servidor de producao local: `/login` responde; `/dashboard` e `/admin/users` sem sessao redirecionam para `/login`; pagina de aceite e redirect mantem `no-referrer`, pagina sem cache e token invalido removido da URL.
- sharp validado com imagem sintetica: codificacao AVIF, decodificacao, resize e PNG. Servidor temporario encerrado.
- Nenhuma consulta ou alteracao no Neon nesta atualizacao. Sem envio de e-mail ou repeticao da importacao. Login autenticado em producao nao foi retestado; as correcoes ainda dependem de publicacao autorizada.
- Referencias: https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36 e https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp .
