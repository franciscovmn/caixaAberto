# Caixa Aberto

Sistema web de tesouraria e prestação de contas para pequenos grupos que administram recursos
coletivos. Entradas, saídas, comprovantes, saldos e transparência pública partem de uma única trilha
de lançamentos auditável.

## Arquitetura

O projeto é um monorepo npm:

```text
backend/   API REST em Node.js, TypeScript, Express, Prisma e PostgreSQL
frontend/  esqueleto React + TypeScript criado com a estrutura do Vite
docs/      decisões, modelo de dados e contrato da API
```

Nesta etapa, o frontend ainda é um esqueleto sem telas de produto. O backend já contém uma primeira
implementação de autenticação, escrita de lançamentos, resumo mensal e transparência pública; os
caminhos temporários em inglês serão migrados em tasks próprias para o contrato em português de
[`docs/API.md`](docs/API.md).

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

## Fluxo de contribuição

O projeto usa Conventional Commits, uma branch por task e pull request obrigatório para `main` com
um revisor. Consulte [`CONTRIBUTING.md`](CONTRIBUTING.md) antes de enviar mudanças.

O branch padrão é `main` e recebe mudanças somente por pull request com uma aprovação e o job
`quality` da CI verde. Crie cada branch a partir da `main` atualizada; os exemplos completos estão
em [`CONTRIBUTING.md`](CONTRIBUTING.md).
