# Caixa Aberto

Sistema web de tesouraria e prestação de contas para pequenos grupos que administram recursos
coletivos. Entradas, saídas, comprovantes, saldos e transparência pública partem de uma única trilha
de lançamentos auditável.

## Arquitetura

O projeto é um monorepo npm:

```text
backend/   API REST em Node.js, TypeScript, Express, Prisma e PostgreSQL
frontend/  aplicação React + TypeScript com Vite e react-router
docs/      decisões, modelo de dados e contrato da API
```

O frontend cobre as telas do Sprint 1: autenticação, registro de entrada e de saída, listagem e
detalhe de lançamentos, extrato, resumo mensal, relatório por categoria e transparência pública.
Alguns caminhos temporários em inglês ainda serão migrados em tasks próprias para o contrato em
português de [`docs/API.md`](docs/API.md).

## Requisitos

- Node.js 24 LTS e npm 11
- Docker com Docker Compose, ou PostgreSQL 16 instalado localmente

## Configuração local

```bash
git clone https://github.com/franciscovmn/caixaAberto.git
cd caixaAberto
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm install
docker compose up -d postgres postgres-test
npm run prisma:migrate:deploy -w backend
npm run seed
```

O `npm install` executa `prisma generate` automaticamente pelo `postinstall` do backend. Para gerar
o client manualmente durante um diagnóstico, use `npm run prisma:generate -w backend`.

O `npm run seed` popula o banco de desenvolvimento com uma organização, categorias de entrada e de
saída e lançamentos nos dois últimos meses, o suficiente para extrato, resumo mensal e relatório por
categoria terem conteúdo. Sem ele não há usuário para entrar no sistema. Os logins criados são:

| E-mail              | Senha         | Papel        |
| ------------------- | ------------- | ------------ |
| `ana@exemplo.com`   | `senha123456` | `TESOUREIRO` |
| `bruno@exemplo.com` | `senha123456` | `CONSULTOR`  |

O seed pode ser executado quantas vezes for preciso: ele atualiza o que já existe em vez de
duplicar. Para recomeçar do zero, recrie o banco e rode as migrações de novo. Ele recusa rodar com
`NODE_ENV=test` ou contra um banco cujo nome identifique um ambiente de teste, para não interferir
no isolamento da suíte.

Inicie os aplicativos em terminais separados:

```bash
npm run dev:backend
npm run dev:frontend
```

A API responde em `http://localhost:3000/health`; o Vite usa `http://localhost:5173`.

## Banco e migrações

Crie uma migração após uma alteração deliberada do schema:

```bash
npm run prisma:migrate:dev -w backend -- --name descricao_da_mudanca
```

Aplique migrações versionadas sem gerar arquivos novos:

```bash
npm run prisma:migrate:deploy -w backend
```

O banco de teste fica na porta `5433`. O harness aplica as migrações automaticamente antes da suíte
e limpa as sete tabelas entre os testes. Para aplicar migrações nele manualmente:

```bash
DATABASE_URL="postgresql://caixa_aberto:caixa_aberto@localhost:5433/caixa_aberto_test?schema=public" \
  npm run prisma:migrate:deploy -w backend
```

O modelo, constraints, defaults e orientações para o futuro seed estão em
[`docs/DATA-MODEL.md`](docs/DATA-MODEL.md).

## Qualidade e testes

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
```

A suíte cobre os dois lados. O frontend usa Vitest com Testing Library e ambiente `jsdom`, e
exercita os componentes pela interface: os testes preenchem o formulário, clicam e conferem o que
sai na requisição. Eles não precisam de banco nem da API no ar:

```bash
npm test --workspace @caixa-aberto/frontend
```

Os testes de integração do backend usam Vitest e Supertest. Antes de executar a suíte, crie o
ambiente local:

```bash
cp backend/.env.example backend/.env
```

O caminho principal usa o serviço isolado do Docker Compose:

```bash
docker compose up -d postgres-test
npm test
```

Como alternativa, use uma instalação local do PostgreSQL 16 configurada na porta `5433`. Ela deve
ter o usuário `caixa_aberto`, senha `caixa_aberto` e banco `caixa_aberto_test`, correspondendo à
`DATABASE_URL_TEST` de `.env.example`. Com o serviço local já iniciado e o usuário criado, o banco
pode ser criado por:

```bash
createdb -h localhost -p 5433 -U caixa_aberto caixa_aberto_test
npm test
```

O setup copia `DATABASE_URL_TEST` para `DATABASE_URL` apenas no processo de teste. A suíte falha
antes de executar migrações ou limpeza se a variável estiver ausente, for inválida ou se o nome do
banco não identificar explicitamente um ambiente de teste.

Pendência de integração: Gabriel, responsável por DevOps no time, deve validar o caminho principal
com `docker compose up -d postgres-test` em um ambiente com Docker disponível.

## Publicação

A aplicação é publicada no Render a partir do blueprint em [`render.yaml`](render.yaml), que cria
três recursos: um Postgres gerenciado, a API em Docker e o frontend como site estático.

No painel do Render, escolha **New > Blueprint**, conecte este repositório e aponte para a branch
`main`. O Render vai pedir dois valores que ainda não existem nesse momento, porque cada um depende
da URL do outro serviço. Preencha qualquer coisa, conclua a criação e corrija em seguida:

1. Depois que os dois serviços aparecerem, anote as URLs atribuídas.
2. Em `caixa-aberto-api`, ajuste `CORS_ORIGIN` para a URL do site estático.
3. Em `caixa-aberto-web`, ajuste `VITE_API_URL` para a URL da API.
4. Faça um novo deploy dos dois. O `VITE_API_URL` é lido no momento do build, então o frontend só
   passa a apontar para a API depois de reconstruído.

As duas URLs devem começar com `https://` e não terminar em barra.

As migrações são aplicadas na subida do container, pelo `backend/docker-entrypoint.sh`. Não há passo
manual. O primeiro deploy cria o schema em um banco vazio.

O banco sobe sem nenhum usuário, e sem usuário não há como entrar. Rode o seed uma vez contra o banco
publicado, usando a connection string externa que o Render mostra na página do Postgres:

```bash
DATABASE_URL="<connection string externa do Render>" npm run seed
```

### O que muda em produção

Os comprovantes são guardados no próprio Postgres, e não em disco. O plano gratuito não tem volume
persistente, então um arquivo gravado no sistema de arquivos desaparece no deploy seguinte. O
blueprint define `STORAGE_DRIVER=database`, que grava o conteúdo em `COMPROVANTE_ARQUIVO`. Em
desenvolvimento o padrão continua sendo `local`. O motivo está em
[`docs/DECISIONS.md`](docs/DECISIONS.md).

### Limites do plano gratuito

- A API hiberna após 15 minutos sem acesso, e a primeira requisição depois disso leva cerca de 50
  segundos. Antes de uma apresentação, abra a URL da API uma vez e espere ela responder.
- O site estático não hiberna, então a tela de login carrega na hora mesmo com a API dormindo. O
  primeiro login é que vai esperar.
- O Postgres gratuito do Render expira depois de 30 dias e é removido. Para manter a aplicação no ar
  além disso, é preciso migrar para um banco pago ou recriar o serviço.

## Fluxo de contribuição

O projeto usa Conventional Commits, uma branch por task e pull request obrigatório para `main` com
um revisor. Consulte [`CONTRIBUTING.md`](CONTRIBUTING.md) antes de enviar mudanças.

O branch padrão é `main` e recebe mudanças somente por pull request com uma aprovação e o job
`quality` da CI verde. Crie cada branch a partir da `main` atualizada; os exemplos completos estão
em [`CONTRIBUTING.md`](CONTRIBUTING.md).
