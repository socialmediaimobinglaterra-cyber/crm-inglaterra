# Plano de conclusao do CRM

## Bairro priorizado novamente - decisao vigente - 2026-09-22

- Usuario autorizou commit e push somente do CRM para publicar esta regra via deploy automatico do GitHub/main. Confirmacao do deploy e primeira sincronizacao com a nova versao continuam pendentes; testes ja aprovados nao foram repetidos sem alteracao de codigo.
- Apos conferir CA1135, usuario escolheu `Bairro`, com fallback para `BairroOficial` quando `Bairro` estiver vazio, mantendo rotulos. Adaptador e rotina de manutencao ajustados apenas no CRM.
- Aplicados 835 bairros no Neon, preservando demais campos por verificacao transacional. Consulta independente conferiu 2.263 externos sem divergencias de bairro principal/bairro_id; CA1135 agora Alphaville II. Curadoria manual, enderecos privados, fotos, vinculos e publicacao preservados.
- Testes parser e Neon com fixtures removidas e TypeScript aprovados. Sem alteracao no site. Commit/push/deploy do adaptador pendentes: producao ainda usa prioridade oficial e pode restaura-la na proxima sincronizacao. Secoes anteriores abaixo sao historicas.

## BairroOficial restaurado - decisao intermediaria substituida - 2026-09-22

- Usuario revogou a prioridade comercial e determinou BairroOficial como padrao. Restaurados no Neon os 835 valores alterados, usando os oficiais originais preservados; restantes intactos. Consulta independente: 2.263 externos conferidos, zero divergencias em bairro principal ou bairro_id. CA1772 voltou a Vivendas do Arvoredo.
- Curadoria, enderecos, fotos, vinculos, publicacao e nomes das telas preservados. Adaptador local voltou ao padrao oficial; codigo em producao ja o usava. A mudanca comercial nao foi enviada ao GitHub, portanto nao depende de novo deploy para impedir sua repeticao no cron.
- Testes de parser/importacao/restauracao no Neon aprovados e fixtures removidas; TypeScript aprovado. Nenhuma alteracao no site ou novo commit/push nesta etapa. A secao comercial abaixo e apenas historico revogado.

## Bairro comercial como dado principal - 2026-09-22

- Usuario confirmou `Bairro` do XML como prioridade, `BairroOficial` como fallback vazio, sem alterar nomenclatura das telas. Adaptador corrigido e valores originais preservados internamente; contrato/API, slugs e site inalterados.
- Atualizacao restrita no Neon aplicada aos 2.263 externos da fonte, com 835 bairros substituidos; demais valores iguais. Curadoria, endereco privado, fotos, vinculos e publicacao preservados por verificacao transacional. CA1772 confirmado como Alphaville II. Nenhum bairro inferido para os condominios sem bairro_id.
- Testes locais de fallback/ausencia, testes Neon com fixtures removidas, comparacao independente apos aplicacao (zero divergencias) e build aprovados. Novo codigo ainda local, sem commit/push/deploy nesta etapa; publicar o adaptador antes da proxima sincronizacao para nao restaurar o bairro oficial.

## Atualizacao diaria XML - 2026-09-22

- Usuario confirmou cadastro das variaveis no painel e autorizou commit/push do agendamento. O deploy anterior informado pelo usuario ainda nao incluia estes arquivos. Configuracao dos valores nao foi inspecionada; ativacao e primeira execucao em producao continuam dependendo da verificacao apos este novo deploy.

- Usuario autorizou sincronizacao diaria as 03h de Brasilia e atualizacao imediata usando a fonte e Neon do CRM. Carga realizada: 2.221 itens validos; 42 novos, 1.640 atualizados, 539 inalterados e 42 ausentes. Consulta posterior confirmou 2.263 externos armazenados e 2.221 presentes. CA2054 ainda nao localizado nos dados importados.
- Preparados cron Vercel 06h UTC e rota interna autenticada, restrita a Production, com segredo proprio e importador transacional existente. Sem endpoint de escrita para os sites, sem migracao e sem configuracao de projeto via CLI.
- Testes de auth/metodos/ambiente/cache/horario e parser aprovados; build aprovado. Smoke Next confirmou bloqueio fora de Production e metodos negados sem executar importacao. Nao repetidos testes Neon de fixtures porque persistencia nao foi alterada; carga real autorizada executada pelo importador existente.
- Ativacao diaria ainda pendente de confirmacao das variaveis Production (`PROPERTY_FEED_URL`, `DATABASE_URL`, `CRON_SECRET`), push/deploy autorizado e verificacao no painel/primeira execucao do cron. Nenhum segredo solicitado em texto ou copiado. Nenhuma alteracao do site Premium.

## Editor de condominios - 2026-09-22

- `/catalog/developments/[id]` abre pelo nome em Cadastros existentes. Nome e descricao editaveis; lista dos imoveis vinculados com links para seus editores e bairro/cidade atuais. Nenhum endereco inferido do grupo. Lancamentos ainda nao recebem editor nesta entrega.
- Pagina/action/queries verificam usuario ativo e papel no servidor. Admin, cadastro e corretor editam somente nome/sobre. Schema estrito rejeita campos extras; versao otimista rejeita edicoes desatualizadas. Lock compartilhado com agrupamentos evita concorrencia entre renomeacao e vinculo por nome.
- Slug, endereco, bairro, galeria, propriedades e publicacao preservados. Sem migracao, nova API publica ou alteracao no site. Nenhum cadastro real editado.
- Teste local de validacao e build aprovados. Teste Neon autorizado com fixtures confirmou tres papeis, inativos/ausentes bloqueados, concorrencia, privacidade e preservacao inclusive de cadastro ativo/publicado. Edge confirmou salvamento como corretor, persistencia apos recarga, desktop/mobile e redirect anonimo. Fixtures e unidades de teste removidas, limpeza verificada.
- Servidor local novo: http://localhost:3007/catalog/developments#cadastros. Aceite do usuario e deploy continuam pendentes. Sem commit/push. Esta entrega nao inclui galeria/publicacao editorial ou cadastro manual independente.

## Resolucao revisada de Terras de Canaa - 2026-09-22

- Usuario confirmou que CA4817, CA5355, CA5152 e TE0787 pertencem ao mesmo condominio. Quatro vinculos criados no cadastro inativo Residencial Terras de Canaa pela rotina administrativa ja validada, preservando enderecos, bairros, cidades, fonte, curadoria, imagens e publicacao.
- Comparacao transacional das demais colunas aprovada; consulta posterior independente confirmou os quatro no mesmo cadastro inativo e as cidades Londrina/Cambe mantidas. Total de 1.188 imoveis vinculados; nenhum caso ambiguo restante no planejador. Os 1.033 sem nome de condominio/edificio no XML continuam sem inferencia de vinculo.
- Nenhuma alteracao de codigo nesta etapa, nem site, commit, push ou deploy. Planilha de 21/09 permanece historica, anterior a resolucao dos sete casos.

## Resolucao revisada de Estancia Cabral - 2026-09-22

- Usuario confirmou que CA5333, CA4294 e TE1113 pertencem ao mesmo condominio e proibiu alteracoes de endereco. Grupo vinculado ao cadastro inativo ESTANCIA CABRAL pela rotina administrativa de revisao explicita.
- Transacao verificou nomes XML, origem, presenca na fonte e ausencia de vinculos conflitantes. Comparacao de todas as demais colunas dos imoveis comprovou preservacao, exceto updated_at nos tres registros vinculados. Enderecos, bairros, cidades, curadoria, fotos e publicacao mantidos. Nenhum outro vinculo alterado.
- TypeScript aprovado; confirmacao posterior somente leitura mostrou os tres no mesmo cadastro inativo, com Cambe/Londrina preservados. Restam quatro casos de cidade divergente em Residencial Terras de Canaa. Sem alteracao no site, commit, push ou deploy. Planilha anterior permanece como fotografia da consulta de 21/09/2026.

## Escopo exclusivo CRM e proxima entrega

- Usuario determinou manter as alteracoes ja feitas no site, mas proibiu novas alteracoes em seu codigo, layout, comportamento ou configuracao. Pedido subsequente de commit abrange somente o trabalho existente; nao autoriza novas mudancas no site nem push/deploy.
- Alteracoes Premium existentes registradas no commit 08a317a, sem novos edits no site. Testes/build anteriores aprovados; nao repetidos sem mudanca. Integracao futura deve ser tratada pelo CRM e seu contrato de API.
- Retomada da entrega 3: gestao de condominios e lancamentos dentro do CRM. Migracao 007 ja possui tabelas, vinculos de imoveis e unidades_publicacao; inventario local nao encontrou consultas, telas ou endpoints dedicados. Nao confundir filtro por nome importado com cadastro editorial completo de condominio.
- Antes de definir carga inicial, confirmar se os cadastros serao manuais no CRM ou se existe arquivo/base autorizada para importacao. Nao criar registros ficticios, agrupar automaticamente por nome nem extrair cadastros do site sem definicao dessa origem.
- Preservar permissoes: admin/cadastro editam e publicam, corretor edita sem publicar; endereco privado separado, API GET por unidade. Sem acesso novo ao Neon, migracao ou publicacao nesta retomada.

## Complemento da ficha na previa Premium - 2026-09-18

- Previa CA5278 ampliada com diferenciais da descricao e localizacao publica bairro/cidade/UF. Cliente valida caracteristicas estruturadas da API, mas CA5278 tem array vazio; sem inventar dados. Nenhuma mudanca de schema/API CRM ou registro real.
- Testes focados e TypeScript aprovados; desktop/mobile revisados sem overflow. Ficha completa ainda depende de contatos oficiais administraveis, semelhantes/URLs, videos e cobertura de fotos. Nao reintroduzir endereco privado ou dados de corretor do legado.
- Alteracoes locais, sem commit/push/deploy ou troca de busca publica.

## Mapeamento de URL do piloto conferido - 2026-09-18

- URL legada CA5278-INIC fornecida pelo usuario respondeu HTTP 200 com titulo/codigo esperados. URL /imoveis/...-ca5278 encontrada no sitemap publico Premium tambem respondeu 200. Sem consulta autenticada a banco ou inferencia de slug pelo titulo.
- Manifesto piloto docs/crm-url-mapping.json criado no Premium, limitado a CA5278 e inativo. Preservar caminho atual /imoveis ao conectar ficha CRM; caminho legado /imovel deve usar alias explicito quando a camada publica for autorizada. Nunca encaminhar visitante para previa admin.
- Dominio legado www.inglaterrapremium.com ainda separado da Vercel; compatibilidade do dominio depende de encaminhamento/configuracao futura. Sem DNS, redirects publicos, alteracao de imoveis, commit ou deploy nesta etapa.
- Proxima dependencia de implementacao publica: ficha completa/paridade CRM e cobertura de identidades/estoque alem do piloto, com plano de retorno. Nao generalizar sufixo INIC para outros codigos.

## Aceite da conversa real na previa protegida - 2026-09-18

- Commits CRM 26471a1 e Premium 31c0a9e enviados ao GitHub com autorizacao; ambos os status Vercel confirmaram deploy concluido. GET publico confirmou filtro condominio no CRM e protecao/no-store/noindex na previa Premium.
- Usuario acessou a previa autenticada na Vercel e testou a conversa real: casa no Royal Park com pelo menos cinco suites retornou CA5278; refinamento para area maxima 497 m2 retornou zero mantendo criterios anteriores (captura); alteracao para 498 m2 fez o imovel reaparecer (confirmacao textual). Aceite do fluxo piloto com IA real e CRM, nao apenas simulacao.
- Busca publica nao foi substituida. Este aceite nao comprova paridade de todo o estoque, URLs, ficha completa, semelhantes, home ou sitemap.
- Proxima entrega delimitada: preservar identidade/URLs atuais na transicao, com CA5278 como piloto. A correspondencia de identidade foi conferida anteriormente, mas o slug completo vigente nao foi coletado. Solicitar URL publica atual antes de propor mapeamento; nao gerar slug pelo titulo nem trocar rotas publicas.
- Registro documental apenas; sem novos testes/build, commit, push, deploy ou alteracoes de catalogo.

## Publicacao da previa protegida autorizada - 2026-09-18

- Usuario autorizou commit/push/deploy da previa protegida, preservando busca publica. CRM publica somente os filtros condominio/areaMaxima ja testados; Premium passa a permitir /preview/crm com admin validado no middleware e no servidor. Catalogo da previa Vercel usa API oficial, sem banco legado de imoveis.
- Protecao nega editor, visitante, sessao invalida, ausencia de segredo e falha de autorizacao; POST exige origem do site. Quota/registro OpenAI existentes mantidos na Vercel. Sem segredo novo, alteracao de ambiente ou migracao.
- Build Premium, testes de acesso/conversa e smoke de producao local aprovados. Nenhuma chamada real OpenAI. Filtros CRM ja tiveram build e teste Neon aprovado, sem mudanca de codigo posterior; nao repetidos.
- Commits/push/deploy e teste autenticado na Vercel pendentes neste registro. Previa nao substitui busca publica nem conclui paridade global.

## Ajuste da previa para busca conversacional - 2026-09-18

- Usuario confirmou que a busca Premium e por conversa com IA. Formulario tecnico anterior nao substituira essa interface. Autorizou adaptacoes em componentes compartilhados sem commit/push/deploy.
- Premium reutiliza HomeHeroSearch, BuscaImoveisClient e interpretacao existente, com vocabulario/resultados CRM apenas na previa local: http://localhost:3004/preview/crm . Defaults publicos preservados. Nenhuma nova alteracao de API/banco CRM nesta etapa.
- Testes simulados da IA cobrem estado cumulativo, remocao de criterios, privacidade, decimais, falhas, limite local e bloqueio de producao. Navegador consultou CRM real apos respostas IA simuladas: resultados 1/0/1, desktop/mobile e foto verificados. Build Premium aprovado.
- Chave OpenAI ausente localmente; conversa real e aceite visual pendentes. Sem consumo OpenAI, alteracao de imoveis reais, migracao, commit, push ou deploy. Integracao completa continua aberta.

## Previa de busca Premium - 2026-09-18

- Usuario aprovou a ficha local CA5278 e autorizou nome de condominio/edificio publico. Endereco privado e demais metadados permanecem excluidos.
- API ganhou condominio (nome exato com trim; nomeCondominio ou fallback nomeEdificio) e areaMaxima. Area util ou total, hectares convertidos para m2, numeric sem perda decimal; area/unidade desconhecida excluida quando filtrada. Sem migracao.
- Teste autorizado no Neon: fixtures exclusivas para nomes, limites decimais, hectares, visibilidade, privacidade, paginacao e rate limiting. Aprovado, limpeza e ausencia confirmadas; sem imoveis reais ou Blob alterados.
- Busca local: http://localhost:3004/preview/crm/imoveis usando API local 127.0.0.1:3005 ligada ao CRM real. Somente CA5278 tem ficha navegavel nesta etapa.
- Builds CRM/Premium, TypeScript e testes do cliente aprovados. Edge desktop/mobile sem overflow, foto real carregada; condominio e area maxima 497 excluem / 498 incluem CA5278, ficha/retorno e erro de intervalo invertido verificados.
- Sem commit/push/deploy. Aceite visual da busca e validacao em producao pendentes; integracao completa permanece aberta.

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

## Aceite publico da API e cache aprovado

- API publicada no commit `b516da7`. Usuario selecionou CA5278 como imovel destinado ao Premium, transferiu 10 fotos, confirmou a galeria e salvou publicacao nessa unidade. AP0104 nao foi usado para publicacao publica neste aceite.
- Verificacao real por GET: detalhe Premium 200 com 10 midias, foto/miniatura WebP 200, campos privados estruturados ausentes e detalhe Matriz 404. Nenhum imovel modificado pelo agente. Site Premium continua inalterado e nao integrado.
- Usuario aprovou ate 60 segundos de desatualizacao para dados; fotos mantem verificacao por requisicao. Cache interno limitado por instancia implementado depois do rate limiting, com expiracao rigida e sem cache de erros. HTTP/CDN continuam no-store para preservar protecoes em cada acesso. Detalhes em `docs/catalog-public-api.md`.
- Testes locais da API/cache aprovados com dependencias simuladas e relogio controlado. Nenhuma consulta ao Neon, mudanca de schema, transferencia Blob ou alteracao do site nesta etapa. Sem novo commit/push/deploy.
- Build aprovado e diff revisado, com `git diff --check` sem erros. Nenhuma dependencia adicionada. Validacao deste cache em producao ainda pendente.
- Proximo passo: publicacao autorizada e verificacao em producao; depois integracao/paridade do Premium. Nao considerar a integracao concluida por haver uma API funcional.

## Preparacao da integracao Premium - 2026-09-18

- Usuario confirmou deploy do cache `b149a28` concluido e autorizou preparar alteracoes no repositorio Premium, sem publicacao em producao. Nenhuma alteracao de imovel autorizada por esta etapa.
- Repositorio local Premium localizado e instrucoes lidas. Mudancas preexistentes na busca/IA preservadas; cliente independente de GET publico criado, sem modificar consultas ou paginas existentes.
- Cliente validou resposta real do CA5278 com dez fotos, preservando strings decimais e excluindo campos extras. Testes locais e TypeScript aprovados; build completo interrompido sem conclusao. Detalhes em `docs/crm-integration-preview.md` no repositorio Premium.
- Previa navegavel ainda pendente. Bloqueios para troca de fonte: mapeamento persistente dos slugs/codigos antigos, filtros de condominio e area maxima, cobertura de home/semelhantes/bairros/sitemap/lancamentos/condominios e paridade de estoque/midias. Nenhuma igualdade de codigo ou slug presumida. Proximo passo: resolver mapeamento de URLs com acesso somente leitura ao legado especificamente autorizado, antes de conectar as paginas.
- Sem commit, push, deploy, migracao ou acesso direto a banco. Site publico continua no legado.

## Previa local do piloto Premium - 2026-09-18

- Consultas READ ONLY executadas pelo usuario confirmaram os 2.419 slugs com sufixo de codigo no Premium e assinatura de identidade de origem coincidente para CA5278 nos dois bancos. Nao extrapolar o vinculo para todo o catalogo.
- Previa local CA5278 implementada no repositorio Premium, em localhost:3004/preview/crm/CA5278; nenhuma rota publica existente trocada. GET real do CRM, galeria compartilhada e precos decimais preservados; sem banco legado, leads ou analytics nesta rota. Bloqueada fora do desenvolvimento local, no-store/noindex.
- Testes focados, TypeScript e build aprovados. Edge desktop/mobile verificado com imagens reais e interacao da galeria; sobreposicao desktop corrigida. Dados exigem curadoria: IPTU 0.01 e divergencia entre quantidade de banheiros e descricao. Nenhum dado real editado.
- Sem commit/push/deploy. Proximo passo: aceite visual do piloto pelo usuario, antes de ampliar a integracao e resolver paridade/URLs de todo o catalogo.

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
# Revisao de condominios e lancamentos no CRM - 2026-09-21

- Implementada `/catalog/developments`, acessivel pela navegacao do CRM. Lista dados reais ja importados: nomes de condominio/edificio, codigo, cidade/UF, bairro, status comercial e vinculos existentes. Busca por nome/codigo/cidade e paginacao de 25 imoveis. Nao houve nova leitura do feed.
- Selecao explicita de imoveis e confirmacao de pertencimento ao mesmo empreendimento. Cria cadastro inativo ou acrescenta vinculos a cadastro inativo existente, sem substituir vinculos anteriores. Nomes semelhantes nao sao unidos automaticamente. Status comercial e informativo; nao cria lancamento automaticamente.
- Transacao revalida usuario ativo/papel, bloqueia imoveis em ordem deterministica e compara versao dos dados/curadoria/vinculos. Cadastros ativos nao recebem vinculos por este fluxo. Preserva XML, endereco privado, curadoria e publicacao dos imoveis; nao copia endereco, fotos ou descricao de uma unidade para o empreendimento.
- Usa schema 007 existente; sem migracao. Nenhuma alteracao no repositorio do site, API publica, publicacao real, push ou deploy. Cadastro novo fica sem unidades publicadas e sem conteudo ficticio. Slug interno exclusivo usa tipo e UUID, sem inferir URL do site.
- Usuario autorizou consulta ao Neon e teste com fixtures exclusivas. Testes aprovados: tres papeis, usuario inativo/ausente, dados privados ausentes da listagem, vinculo existente, revisao desatualizada, concorrencia, rollback e preservacao da origem/publicacao. Limpeza dos registros temporarios confirmada.
- Consulta agregada somente leitura: 2.221 imoveis externos, 1.188 com nome de condominio e 387 com nome de edificio. Contagens podem se sobrepor e nao representam empreendimentos unicos.
- Build aprovado. Edge autenticado confirmou salvamento real de vinculo em fixture, listagem de dados reais somente leitura, layout desktop/mobile sem overflow da pagina e redirecionamento de visitante anonimo ao login. Tabela possui rolagem horizontal em telas pequenas. Nenhum imovel real alterado.
- Servidor local em http://localhost:3006/catalog/developments. Ainda pendem aceite do usuario e revisao dos agrupamentos reais; CRUD editorial completo, galeria, publicacao e endpoints de empreendimentos nao fazem parte desta entrega de organizacao/vinculos. Esta etapa nao fecha toda a entrega 3.
# Limite de escopo reafirmado pelo usuario - 2026-09-21

- Trabalho restrito ao CRM. Qualquer necessidade de alterar codigo, layout, comportamento ou configuracao do site Inglaterra Premium deve ser explicada previamente e aprovada explicitamente pelo usuario. Autorizacoes anteriores nao permitem novas alteracoes no site.
- Excecao pontual autorizada nesta data: remover a barra de filtros manuais apresentada pelo usuario, preservando a busca por IA e a integracao existente. No site, apenas `components/search/BuscaImoveisClient.tsx` foi alterado: remocao da barra e de seus auxiliares exclusivos. Estado conversacional, endpoints, ordenacao, paginacao, limpeza e dados preservados. Sem commit, push ou deploy.
- Build do site aprovado sem conexao de banco; oito testes de estado da busca e teste existente `scripts/test-crm-conversation.ts` aprovados, com OpenAI/CRM simulados. Quatro testes de `tests/ai-route.test.ts` falham por mock ausente de `@/lib/crm-conversation`; rota e teste nao foram alterados nesta correcao. Nao corrigir esse teste sem ampliar a autorizacao.
- Novo teste de navegador foi inicialmente bloqueado por acrescentar arquivo ao site. Usuario entao autorizou explicitamente somente esse teste da correcao. Criado `scripts/test-search-interface.cjs`: componente real em ambiente isolado, respostas de API simuladas, sem credenciais. Edge desktop/mobile aprovou ausencia da barra, contexto acumulado da IA, ordenacao, paginacao e limpeza nos modos publico/previa CRM. Screenshots revisadas; harness nao reproduz o layout global/fontes do Next. Chamada real de IA e validacao em producao continuam pendentes de deploy autorizado.
# Vinculos em lote por nome XML - 2026-09-21

- Usuario autorizou vincular os imoveis aos condominios do XML e usar a conexao Neon configurada. Operacao administrativa pontual, sem nova importacao do feed, migracao, alteracao do site ou publicacao.
- Plano calculado sobre os dados ja importados, com prioridade para nomeCondominio e fallback nomeEdificio. Correspondencia conserva pontuacao/acentos e ignora somente caixa/espacos. Bairros e enderecos diferentes nao impedem vinculo, conforme decisao do usuario; nomes iguais em cidades/UF distintas ficam pendentes. Vinculos anteriores nunca substituidos.
- Aplicacao atomica condicionada ao SHA-256 do snapshot revisado, com bloqueios transacionais e comparacao de todas as colunas dos imoveis exceto condominio_id/updated_at. Gravacao em lote criou 493 condominios inativos e 1.148 vinculos; 33 vinculos existentes preservados. Fonte, curadoria, enderecos, bairros, lancamentos, imagens e publicacao preservados.
- Consulta posterior independente confirmou 1.181 vinculos e nenhum novo vinculo/cadastro proposto numa repeticao. Sete registros ficaram para revisao por cidades diferentes; 1.033 nao possuem nome de condominio/edificio no XML.
- Testes locais do planejador e TypeScript aprovados. Resultado real verificado no Neon. Relatorio solicitado entregue como arquivo externo; nenhum relatorio ou endereco privado foi registrado em tabelas/documentacao do CRM.
- Scripts administrativos: `scripts/link-xml-condominiums.ts` (padrao somente leitura; escrita exige --apply, --expected e --output exclusivo) e `scripts/test-condominium-batch.ts`. Consultas isoladas em `lib/queries/condominium-batch.ts`, sem rota ou server action para essa operacao.

## Galeria de areas comuns - em validacao - 2026-09-22

- Editor de condominio recebe selecao multipla, previa local, ordem, principal e remocao no mesmo Salvar alteracoes. Fotos pertencem ao condominio, nao sao copiadas para os imoveis vinculados. Nenhuma alteracao no site Premium.
- Migracao 015 preparada, ainda nao aplicada: proprietario exclusivo em catalog_images (imovel ou condominio), ordem e principal protegidas por constraints. Reutiliza estados de upload, validacao real de formato, WebP/miniaturas e Blob privado. API publica existente continua restrita a imagens dos imoveis publicados.
- Texto e galeria salvos atomicamente com versoes otimistas; fotos de outro proprietario, pendentes ou removidas sao recusadas. Autorizacao no servidor para os tres papeis de edicao. Publicacao, enderecos e vinculos nao mudam. Limpeza de arquivos removidos/abandonados limitada ao condominio nas novas acoes.
- Testes locais de rascunho e processamento de imagem aprovados. Teste Neon com fixtures e Blob simulado preparado em scripts/test-condominium-images.ts, aguardando autorizacao especifica para migracao e execucao. Nao considerar a entrega concluida antes dessa validacao e do teste de navegador; envio ao Blob real tambem permanece pendente.

## Composicao da galeria publica - em validacao - 2026-09-22

- A pedido do usuario, a API local passa a acrescentar as fotos ready do condominio vinculado depois das fotos do imovel, preservando a principal do imovel, o contrato media e o proxy existente. Sem duplicar arquivos e sem editar o site Premium.
- Fotos comuns herdam acesso de um imovel publicado na unidade, sem publicar o cadastro independente do condominio. Remocao de imagem, retirada de publicacao e desvinculo reavaliados pelo proxy. Sem campos privados novos na resposta.
- Testes locais de composicao, ordem, posicoes, principal, grupos vazios, privacidade e HTTP/cache aprovados. TypeScript aprovado. Testes SQL ampliados para listas/detalhes, condominios compartilhados, isolamento entre unidades, estados e revogacao; ainda nao executados por dependerem da migracao 015 e autorizacao Neon pendentes. Sem alteracao de dados reais, commit, push ou deploy.

## Validacao autorizada das galerias - 2026-09-22

- Usuario autorizou a migracao e os testes. Migracao 015 aplicada no Neon configurado do CRM; 001-014 ja estavam aplicadas. Nenhum dado de imovel, endereco, vinculo ou publicacao real foi editado.
- `test-condominium-images.ts --db` aprovado: tres papeis, isolamento entre proprietarios, staging privado, rollback conjunto, concorrencia, ordem/principal/remocao, limpeza restrita ao condominio de teste e regressao das imagens de imoveis. Blob simulado. Fixtures removidas e ausencia conferida.
- `test-catalog-api.ts --db` aprovado: ordem imovel/condominio no detalhe e listagem, principal preservada, condominio compartilhado, isolamento por unidade e bloqueios por desvinculo, inatividade, revisao pendente, fonte ausente, despublicacao e estado da imagem. Fixtures exclusivas removidas e ausencia conferida. Nenhum arquivo enviado ao Blob.
- `test-condominium-editor.ts --db --browser` aprovado no Edge: salvamento/reabertura de nome e descricao, selecao multipla local, principal, ordem, remocao e visitante redirecionado ao login. Screenshots 1440/390 revisadas, sem overflow. Selecao nao gravou imagens no banco; remocao da previa seguida de salvamento validada. Fixtures removidas.
- Servidor local atualizado em http://localhost:3008; porta anterior preservada. Build do codigo de aplicacao ja aprovado na etapa anterior, sem mudanca posterior; TypeScript e diff revisados apos ampliar o teste de navegador.
- Pendente de aceite em producao: envio real de fotos comuns ao Blob e navegacao da galeria integrada no site. Sem credencial Blob local, selecao mostra previa e o envio permanece indisponivel. Nenhuma alteracao no site Premium, commit, push ou deploy nesta autorizacao.
