# CRM Inglaterra — Plano de Arquitetura e Implementação

**Sistema central de gestão de catálogo imobiliário do Grupo Inglaterra**
v1.0 · Ago/2026

\---

## 1\. Objetivo e escopo

Criar um sistema central, independente dos sites, para gerenciar o catálogo imobiliário do Grupo Inglaterra — imóveis, lançamentos e condomínios — servindo hoje o site **Inglaterra Premium** e futuramente o site da matriz (**imobiliariainglaterra.com.br**).

### Dentro do escopo

|Módulo|O que faz|
|-|-|
|**Catálogo**|Cadastro/edição de imóveis, lançamentos e condomínios, com galeria de imagens|
|**Importação XML**|Sincronização de imóveis a partir de XML de sistemas fornecedores, por adaptadores|
|**Curadoria**|Definir quais imóveis aparecem em qual site (filtro automático + override manual)|
|**Usuários**|Login, papéis (`admin` / `cadastro`), convites|
|**Configurações de contato**|E-mails que recebem leads, números de WhatsApp por unidade/contexto|
|**Dashboard**|Métricas de tráfego e comportamento agregadas dos sites|
|**API de leitura**|Endpoint público, somente leitura, consumido pelos sites|

### Fora do escopo (por ora)

Funil de vendas, contratos, comissões, gestão de proprietários, agenda de visitas. Se um dia entrarem, a arquitetura abaixo comporta — mas não vale construir antes de existir necessidade real.

\---

## 2\. Arquitetura

```
┌──────────────────────────────────────────────┐
│  CRM Inglaterra                              │
│  repo: crm-inglaterra                        │
│  deploy: Vercel (projeto próprio)            │
│  banco: Postgres/Neon (fonte única)          │
│                                              │
│  ┌────────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Catálogo   │  │ Usuários │  │ Config   │  │
│  └────────────┘  └──────────┘  └──────────┘  │
│  ┌────────────┐  ┌──────────────────────┐    │
│  │ Import XML │  │ Dashboard/Analytics  │    │
│  └────────────┘  └──────────────────────┘    │
└──────────┬───────────────────────────────────┘
           │  API REST — somente leitura
     ┌─────┴──────┐
     ▼            ▼
┌──────────┐  ┌──────────────────┐
│  Site    │  │  Site Matriz     │
│  Premium │  │  (futuro)        │
└──────────┘  └──────────────────┘
```

### Princípios estruturais

1. **Fonte única de verdade.** O banco do CRM é o único lugar onde o catálogo existe. Os sites não têm banco próprio de imóveis.
2. **Sites nunca escrevem.** A API exposta é read-only. Um site comprometido não consegue alterar nada.
3. **Sites não acessam o banco direto.** Só pela API — permite refatorar o schema sem quebrar os sites.
4. **Multi-unidade desde o dia um.** Todo registro sabe a qual unidade pertence. Retrofit disso depois é caro.

### Domínio oficial

O domínio oficial de acesso ao CRM é **https://admin.inglaterrapremium.com**.

### Stack

Mesma do site Premium, por consistência e porque já está validada: **Next.js 15 (App Router) + TypeScript + Tailwind + Postgres (Neon) + Vercel + Vercel Blob + Resend**.

Um Blob Store novo, próprio do CRM (privado, servido por rota proxy — mesmo padrão já validado em `/api/blob-image`).

### Importação de imóveis

A importação de imóveis deve aceitar XML de qualquer CRM ou sistema fornecedor, sem dependência estrutural da Kenlo ou de outro fornecedor específico.

A arquitetura de importação usa um **contrato interno normalizado** para o catálogo. Cada origem externa é tratada por um adaptador separado por fornecedor/formato, responsável por ler o XML da fonte e convertê-lo para esse contrato interno antes de persistir os dados. O primeiro adaptador deve atender à fonte XML utilizada atualmente; a Kenlo pode permanecer como referência de fonte inicial ou legada, mas não como acoplamento permanente do catálogo.

Com essa separação, a origem XML pode ser trocada sem remodelar o schema do catálogo, a API pública ou a interface administrativa.

\---

## 3\. Modelo de dados (esboço)

### Catálogo

```
imoveis
  id, codigo, origem ('xml' | 'manual'), origem\_fornecedor, origem\_id
  tipo, finalidade (venda/locacao), preco\_venda, preco\_locacao
  bairro\_id, endereco, latitude, longitude
  area, suites, quartos, banheiros, vagas
  titulo, descricao, galeria (jsonb)
  condominio\_id (nullable), lancamento\_id (nullable)
  elegivel\_filtro\_automatico, inclusao\_manual, ativo
  created\_at, updated\_at

unidades\_publicacao        ← chave da estratégia multi-marca
  imovel\_id, unidade ('premium' | 'matriz'), ativo

lancamentos / condominios
  id, nome, slug, sobre, bairro\_id, endereco, galeria (jsonb)
  origem, ativo, created\_at, updated\_at

bairros
  id, nome, slug, cidade, estado, descricao, faq (jsonb)
```

**Por que `unidades\_publicacao` é tabela separada e não um campo:** um mesmo imóvel pode aparecer nos dois sites, com critérios diferentes de elegibilidade em cada um. Campo único forçaria escolher um só.

### Operacional

```
usuarios            id, email, role ('admin'|'cadastro'), unidade\_escopo, ativo
codigos\_login       email, code\_hash, expires\_at, used\_at
configuracoes\_contato
  id, unidade, contexto ('geral'|'bts'|'lancamento'|'imovel')
  emails\_destino (array), whatsapp (text), ativo
eventos\_analytics   id, site\_origem, tipo\_evento, imovel\_id, payload, created\_at
sincronizacoes\_log  id, iniciada\_em, total\_xml, entraram, sairam, erros
```

\---

## 4\. Segurança

Esta seção não é opcional — o CRM passa a ser o ponto onde um comprometimento afeta **todos** os sites de uma vez.

### Autenticação

Manter o modelo já validado: **magic code por e-mail**, sem senha. Não há senha para vazar, phishing fica mais difícil, e já provou funcionar em produção.

Reforços recomendados sobre o que já existe:

* Código de 6 dígitos, expiração de 10 minutos, **hash** no banco (nunca em texto)
* **Rate limiting** por e-mail e por IP na solicitação de código (ex: 5 tentativas / 15 min) — sem isso, um atacante pode inundar a caixa de um usuário legítimo
* Invalidar códigos anteriores ao gerar um novo
* Sessão em cookie `httpOnly`, `Secure`, `SameSite=Lax`, assinada com segredo forte, expiração de 7 dias
* Registro de auditoria: quem logou, quando, de qual IP

### Autorização

Dois papéis, conforme definido:

|Papel|Pode|
|-|-|
|`admin`|Tudo: catálogo, usuários, configurações de contato, dashboard|
|`cadastro`|Somente cadastrar/editar imóveis, lançamentos e condomínios|

**Verificação no servidor, sempre.** Esconder um botão no front-end não é controle de acesso — cada rota e cada ação precisa validar o papel do lado do servidor, independentemente do que a interface mostra.

### API pública de leitura

* **Somente `GET`.** Nenhum método de escrita exposto.
* **Rate limiting por IP** — protege contra scraping massivo e abuso.
* **Sem dado sensível na resposta.** A API devolve o que é público no site; nunca dados de usuário, configurações internas ou registros inativos.
* **CORS restrito** aos domínios dos dois sites, não `\*`.
* **Cache agressivo** (CDN + `Cache-Control`) — reduz carga e superfície de abuso simultaneamente.

### Upload de imagens

* Validar **tipo real do arquivo** (magic bytes), não só a extensão — extensão é trivial de forjar
* Limite de tamanho (sugestão: 10 MB por imagem)
* Blob Store **privado** + rota proxy, padrão já validado
* Nome de arquivo gerado pelo sistema, nunca o nome enviado pelo usuário

### Configurações de contato — atenção específica

Este módulo é mais delicado do que parece. Se o CRM define para quais e-mails os leads são enviados, então **quem controla esse campo controla para onde vão os contatos comerciais da empresa**. Um acesso indevido poderia desviar leads silenciosamente.

Proteções:

* Alteração restrita a `admin`
* Log de auditoria de toda mudança (valor anterior, novo valor, quem, quando)
* Validação estrita de formato de e-mail e telefone (evita injeção em cabeçalho de e-mail)
* Notificação automática ao admin principal quando uma configuração de destino for alterada

### Segredos

Nenhum segredo no repositório, em nenhuma hipótese. `.env\*` sempre no `.gitignore`, `.env.example` sem valores reais.

**Regra de deploy** (mesma já documentada no `AGENTS.md` do site): produção só por push no `main` com webhook. Nunca `vercel --prod`, `vercel link` ou `vercel env add` via CLI — foi exatamente isso que gerou o projeto duplicado no site Premium.

### LGPD — ponto que precisa de decisão

Enquanto o CRM gerencia só catálogo e configurações, não há dado pessoal relevante. **Mas no momento em que um formulário do site captura nome/e-mail/telefone de um interessado, isso muda.**

Duas opções:

|Opção|Implicação|
|-|-|
|**Leads só encaminhados por e-mail**, sem armazenar no CRM|Muito mais simples juridicamente. O CRM só define o destinatário.|
|**Leads armazenados no CRM**|Exige política de privacidade, base legal para tratamento, política de retenção, controle de acesso reforçado, e capacidade de excluir dados a pedido do titular|

Recomendação para a primeira versão: **não armazenar leads**. Só encaminhar. Se depois houver necessidade de histórico, aí sim tratar isso como um módulo próprio, com as obrigações que ele traz.

\---

## 5\. Dashboard — o que medir

Métricas escolhidas pelo critério "que decisão isso sustenta", não por serem fáceis de coletar.

### Grupo 1 — Demanda vs. oferta (prioridade máxima)

Estas são as que geram ação comercial direta:

* **Buscas sem resultado**, agrupadas por bairro/faixa de preço — cada uma é demanda real não atendida. Direciona captação.
* **Bairros mais buscados vs. estoque disponível por bairro** — mostra onde falta produto.
* **Faixas de preço mais buscadas vs. distribuição real do estoque**
* **Imóveis com muitas visualizações e nenhum contato** — sinal de preço fora do mercado, fotos ruins ou descrição fraca.

### Grupo 2 — Funil

* Visualização de ficha → clique em contato/WhatsApp (taxa de conversão)
* Conversão por bairro, por faixa de preço, por tipo de imóvel
* Uso da busca por linguagem natural vs. filtros manuais
* Origem do acesso à ficha: busca, navegação por bairro, link direto

### Grupo 3 — Tráfego (contexto)

* Visitantes, sessões, páginas mais vistas
* Mobile vs. desktop
* Origem de tráfego (orgânico, direto, social, pago)

### Recorte por unidade

Todo gráfico precisa poder filtrar por site de origem (Premium / Matriz), já que o CRM serve os dois.

\---

## 6\. Fases de implementação

Cada fase termina em algo verificável. Mesma disciplina do projeto atual: **um objetivo por prompt, critério de aceite explícito, revisão antes de avançar.**

### Fase 0 — Preparação

* Criar repositório `crm-inglaterra` (privado)
* Criar projeto na Vercel, no time correto (`team\_ckWhkvtHxIIHcJnafLmZiKle`), conectado ao GitHub por webhook
* Criar banco Neon próprio do CRM
* Criar Blob Store próprio
* Escrever `AGENTS.md` do CRM, incluindo a regra de deploy

### Fase 1 — Fundação

Scaffold Next.js + autenticação (magic code) + papéis `admin`/`cadastro` + convites + rate limiting + auditoria de login.
**Aceite:** login real funcionando, usuário `cadastro` bloqueado nas telas de admin, tentativa de força bruta barrada pelo rate limit.

### Fase 2 — Schema e Importação XML

Schema completo + implementação da sincronização de fonte externa por XML, usando contrato interno normalizado e adaptadores por fornecedor/formato, incluindo `unidades\_publicacao`.
**Aceite:** sincronização XML rodando no CRM a partir da fonte atual, imóveis no banco, log de sincronização correto, registros `origem='manual'` protegidos e possibilidade de trocar a origem sem remodelar catálogo, API ou interface.

### Fase 3 — Catálogo

CRUD de imóveis, lançamentos e condomínios, com upload de imagens (miniaturas, Blob privado + proxy) e tela de curadoria (filtro automático + override manual, por unidade).
**Aceite:** cadastrar um imóvel manual completo com imagens; marcar um imóvel fora do filtro como incluído e ver o estado refletido corretamente.

### Fase 4 — API de leitura

Endpoints `GET` para imóveis, lançamentos, condomínios e bairros, com filtro por unidade, paginação, rate limiting, CORS restrito e cache.
**Aceite:** consumir a API de fora e receber apenas dados públicos da unidade solicitada; tentativa de `POST`/`PUT` recusada; rate limit ativo.

### Fase 5 — Migração do site Premium

Trocar as consultas diretas ao banco por chamadas à API do CRM. **Só depois de validado**, remover `/admin/lancamentos`, `/admin/curadoria` e o `kenlo-sync.ts` do site.
**Aceite:** site funcionando integralmente pela API, com paridade de conteúdo; só então a remoção.

### Fase 6 — Configurações de contato

Gestão de e-mails de destino e números de WhatsApp por unidade e contexto, com auditoria de alterações. Sites passam a consumir isso pela API.
**Aceite:** alterar um e-mail de destino no CRM e ver o formulário do site enviando para o novo endereço, sem deploy.

### Fase 7 — Dashboard

Coleta unificada de eventos dos sites + telas de visualização dos três grupos de métricas, com filtro por unidade e período.
**Aceite:** dashboard mostrando dados reais acumulados, incluindo buscas sem resultado agrupadas.

### Fase 8 — Site da matriz

Fora do escopo deste plano — quando chegar a hora, a API já estará pronta para servi-lo.

\---

## 7\. Ordem de execução — ponto crítico

**Não remover nada do site Premium antes da Fase 5 estar validada.**

O `/admin` atual é a única ferramenta de gestão existente hoje. Removê-lo antes do CRM estar operacional deixaria o site sem qualquer forma de curadoria, dependente exclusivamente do filtro automático da fonte externa atual — justamente durante a transição para a nova arquitetura de importação XML.

Sequência segura: **construir → apontar → validar → remover.**

\---

## 8\. Decisões ainda em aberto

* \[ ] Nome final do sistema e do repositório
* \[x] Domínio de acesso do CRM: `https://admin.inglaterrapremium.com`
* \[ ] Confirmar: leads armazenados ou apenas encaminhados? (ver seção LGPD)
* \[ ] O site da matriz existe hoje em qual plataforma? Migra junto ou só consome a API?
* \[ ] Estrutura visual — a definir a partir das imagens de referência já disponíveis
* \[ ] Política de retenção de eventos de analytics (quanto tempo guardar)

\---

*Documento de planejamento. Nenhuma implementação deve começar antes da validação deste plano e da definição dos itens da seção 8.*

