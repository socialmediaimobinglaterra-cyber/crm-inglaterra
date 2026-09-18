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
