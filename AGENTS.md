# AGENTS.md — CRM Inglaterra

Este arquivo é lido pelo Codex antes de qualquer tarefa neste repositório. As instruções aqui têm prioridade sobre suposições que você faria por conta própria.

## Leia primeiro, sempre

Antes de começar qualquer tarefa, leia nesta ordem:

1. `docs/crm-inglaterra-plano-arquitetura.md` — arquitetura, modelo de dados, segurança, fases de implementação
2. O(s) arquivo(s) de referência visual da pasta `design/` relevante(s) para a tarefa do momento

Essas fontes já contêm as decisões de arquitetura, segurança e estrutura do projeto. Não redecida stack, banco, rotas ou modelo de dados por conta própria — seu papel é executar o que já está documentado.

## O que é este projeto

Sistema central de gestão de catálogo imobiliário do Grupo Inglaterra (Londrina/PR). Gerencia imóveis, lançamentos e condomínios, e serve esses dados aos sites do grupo através de uma API somente-leitura.

**Este CRM é a fonte única de verdade do catálogo.** Os sites não têm banco próprio de imóveis — eles consomem a API deste sistema.

Hoje serve o site Inglaterra Premium. Futuramente poderá servir o site da matriz (imobiliariainglaterra.com.br) — por isso todo registro do catálogo precisa saber a qual unidade pertence, desde o início.

## Stack

* Next.js 15 (App Router), TypeScript, Tailwind CSS
* Banco: Postgres (Neon) — banco próprio do CRM, separado do site
* Deploy: Vercel (auto-deploy a partir do GitHub)
* Armazenamento de imagens: Vercel Blob (privado, servido por rota proxy)
* E-mail transacional: Resend
* Origem de dados externa: XML da Kenlo (somente leitura do XML — nenhuma outra integração com a Kenlo)

## Deploy — regra crítica

O deploy de produção acontece **exclusivamente via push no GitHub** (branch `main`), conectado por webhook ao projeto Vercel correto.

**NUNCA rode:**

* `vercel --prod`
* `vercel deploy`
* `vercel link`
* `vercel env add` para produção

Se precisar verificar variáveis de ambiente ou configuração de projeto, peça ao usuário para confirmar no painel web da Vercel. Não gere nem edite configuração de projeto Vercel via CLI.

Se `.vercel/project.json` não existir, **não rode `vercel link` para criá-lo** — isso pode vincular a um projeto/organização errado sem aviso. Se o arquivo for necessário para alguma tarefa legítima, pergunte ao usuário qual `projectId`/`orgId` usar.

*Contexto: essa regra existe porque um projeto Vercel duplicado foi criado acidentalmente por CLI em outro projeto do grupo, causando horas de diagnóstico e configuração perdida.*

## Segurança — não negociável

* **Nenhum segredo no repositório.** `.env\*` sempre no `.gitignore`. `.env.example` sem valores reais.
* **Nunca exponha chaves de API, tokens ou strings de conexão** em código, logs persistentes ou mensagens de commit.
* **Autorização é verificada no servidor**, sempre. Esconder um botão no front-end não é controle de acesso — cada rota e cada server action valida o papel do usuário independentemente do que a interface mostra.
* **A API pública é somente `GET`.** Nenhum método de escrita exposto aos sites, em nenhuma circunstância.
* **Upload de imagem** valida tipo real do arquivo (magic bytes), não só extensão. Nome do arquivo é gerado pelo sistema, nunca o nome enviado pelo usuário.
* **Configurações de contato** (e-mails de destino de leads, WhatsApp) só podem ser alteradas por `admin`, com log de auditoria de toda mudança.
* Se uma tarefa exigir credencial de terceiro (GitHub, Vercel, Neon), **peça ao usuário** — não reutilize credenciais encontradas no ambiente nem assuma que uma autenticação existente é a correta.

## Papéis de usuário

|Papel|Permissões|
|-|-|
|`admin`|Tudo: catálogo, usuários, configurações de contato, dashboard|
|`cadastro`|Somente cadastrar/editar imóveis, lançamentos e condomínios|

Autenticação por **magic code** (código de 6 dígitos por e-mail, sem senha). Códigos guardados como hash, expiração de 10 minutos, rate limiting por e-mail e por IP.

Apenas e-mails do domínio `@imobiliariainglaterra.com.br` têm acesso ao sistema.

## Regras de execução

* **Um objetivo por tarefa.** Não expanda escopo além do que foi pedido nesta tarefa específica.
* Se um dado necessário não existir no banco ou nos documentos, **pergunte antes de inventar ou improvisar**.
* Nunca invente valores de configuração (preços mínimos, listas de bairros, e-mails, números de telefone) — se não estiver documentado, pergunte.
* Ao terminar, resuma: o que foi feito, o que ficou conectado a dados reais vs. o que continua placeholder, e qualquer decisão que você precisou tomar no caminho.
* **Critério de aceite não é `npm run build` passar.** Uma fase só está concluída quando o comportamento foi verificado de verdade — com dado real, no ambiente correto. Se não foi possível verificar, diga explicitamente o que ficou por validar.

## Convenções de código

* Componentes reutilizáveis em `components/`, nunca duplicados entre páginas
* Consultas ao banco isoladas em `lib/queries/`
* Server actions e rotas de API validam papel do usuário antes de qualquer operação
* Erros de operação aparecem para o usuário com mensagem clara — nunca falham silenciosamente

