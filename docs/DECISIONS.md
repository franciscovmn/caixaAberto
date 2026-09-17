# Decisões técnicas

Este arquivo registra escolhas necessárias quando o enunciado não determina uma única solução.

## 2026-09-11: Identificadores e nomes físicos

- Identificadores TypeScript e modelos Prisma usam inglês.
- Rotas, propriedades públicas da API, mensagens e nomes físicos do banco seguem português.
- As tabelas são mapeadas exatamente para os nomes do DER (`USUARIO`, `ORGANIZACAO`,
  `MEMBRO`, `CATEGORIA`, `LANCAMENTO`, `COMPROVANTE` e `META`).

Motivo: manter o código consistente com a orientação inicial sem alterar o contrato de domínio ou o
DER compartilhado pela equipe.

## 2026-09-11: Prisma 7 e acesso ao PostgreSQL

Foi adotado Prisma 7.10.0, versão estável consultada durante a inicialização. Nessa versão, conexões
diretas exigem um driver adapter. Por isso, `@prisma/adapter-pg`, `pg` e `dotenv` foram adicionados
além dos pacotes citados nominalmente no enunciado. Eles são infraestrutura obrigatória para o
Prisma 7 acessar o PostgreSQL e carregar a configuração local.

O TypeScript foi fixado em 5.9.3 porque é a versão estável compatível com a faixa declarada pelo
`typescript-eslint` usado no projeto. `tsx`, plugins ESLint para React e o plugin React do Vite são
dependências de desenvolvimento necessárias aos scripts e ao esqueleto solicitado.

## 2026-09-11: Valores enumerados como `VARCHAR`

`papel`, `tipo` e `status` permanecem `VARCHAR(20)`, conforme o DER. A migração adiciona `CHECK`
constraints para os conjuntos permitidos em vez de criar enums nativos do PostgreSQL, que mudariam
o tipo físico solicitado. O Prisma representa esses campos como `String`; constantes TypeScript
fornecem tipagem nos limites da aplicação.

## 2026-09-11: Defaults e campos opcionais

- Apenas `ORGANIZACAO.transparencia_ativa` recebe default no banco (`false`), porque este é o único
  default definido pelo modelo fornecido.
- Campos de criação, status e indicadores de atividade devem ser fornecidos pelo caso de uso que
  grava a entidade ou pelo futuro seed.
- `LANCAMENTO.origem` e `LANCAMENTO.destinatario` são opcionais no banco, pois cada um se aplica a
  apenas um tipo de lançamento. A validação condicional pertence aos serviços de escrita do Murilo.
- `COMPROVANTE.lancamento_id` é único. O contrato usa comprovante no singular e define um único
  anexo por lançamento; uma substituição futura deve atualizar esse vínculo de forma explícita.

## 2026-09-11: Integridade referencial e datas

- Todas as exclusões de entidades relacionadas usam `RESTRICT`; registros financeiros e seus
  vínculos não são removidos em cascata.
- Datas civis usam `DATE`. Os timestamps seguem `TIMESTAMP(6)` sem fuso, exatamente como o DER, e a
  aplicação opera com `America/Fortaleza`.
- IDs `BIGINT` são enviados como strings em JSON para evitar perda de precisão no JavaScript.

## 2026-09-11: Contexto usado nos testes de integração

Em `NODE_ENV=test`, o cabeçalho `X-Test-Context` aceita JSON com IDs em string e papel válido, por
exemplo:

```json
{ "usuarioId": "1", "organizacaoId": "2", "papel": "TESOUREIRO" }
```

Fora de teste, o cabeçalho é ignorado. O middleware JWT do Murilo preencherá o mesmo contrato em
produção.

## 2026-09-11: Contratos provisórios dos demais integrantes

Os caminhos e formatos não especificados para autenticação, resumo mensal e transparência pública
foram documentados em `docs/API.md` como provisórios, sem implementação. A opção mais simples foi
registrada para permitir alinhamento antes das respectivas tasks.

## 2026-09-11: Ativação de transparência sem token

O contrato retorna `409` quando alguém tenta ativar a transparência antes de gerar o token. A
alternativa de gerar um token implicitamente no `PATCH` duplicaria a responsabilidade do `POST` e
tornaria a rotação acidental. Esta regra será confirmada na Fase 4 antes da implementação.

## 2026-09-14: Convenções públicas e contexto autenticado

A equipe ratificou três convenções para a API:

- rotas, propriedades públicas e mensagens usam português; identificadores internos do TypeScript
  e do Prisma permanecem em inglês;
- erros seguem `{ erro, campos? }` e passam pelo `AppError` e pelo `errorHandler` compartilhado;
- organização e papel são resolvidos no servidor a partir do usuário autenticado e do vínculo ativo
  em `MEMBRO`, formando `req.contexto`.

Quando existir mais de um vínculo ativo, `X-Organization-Id` seleciona uma organização que pertença
ao usuário. O identificador não é aceito livremente no corpo ou na query dos casos de uso
autenticados. Os routers temporários em inglês permanecem disponíveis até uma migração específica,
sem mudança de lógica neste ciclo de infraestrutura.

## 2026-09-14: Fundação do frontend

O esqueleto do frontend não tinha roteamento nem cliente HTTP. Para a US19, foi adotado
react-router-dom 7.18.3 para as rotas e um wrapper próprio sobre fetch em src/lib/httpClient.ts,
sem bibliotecas adicionais de requisição. Um login mínimo foi criado para permitir testar as telas
autenticadas nesta etapa; o contrato completo de autenticação e a listagem de organizações do
usuário pertencem à US01/US13 e não são implementados aqui. A US17 (GET /categorias) já existe e é usada para popular o seletor de categoria
nos formulários e no filtro de lançamentos.

## 2026-09-17: Testes de componente no frontend

O frontend não tinha testes: `npm test` rodava com `--passWithNoTests` e nenhum arquivo. Quatro
defeitos chegaram à `main` por esse caminho, todos de validação de formulário e todos com lint,
typecheck, build e CI verdes: valor com vírgula recusado pela API, descrição vazia aceita pelo
formulário, descrição só com espaços aceita, e lançamento duplicado quando o upload do comprovante
falhava. Cada um só apareceu quando alguém abriu a tela e conferiu o banco depois.

Foram adicionados `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`
e `jsdom` como dependências de desenvolvimento do frontend. São o conjunto padrão para exercitar
componentes React pela interface, e não trazem runtime para produção.

Os testes substituem o `fetch` global em vez de trocar o módulo `httpClient`. A diferença importa: o
corpo da requisição é observado como ele sai do navegador, então um valor que o formulário deixa de
normalizar aparece no teste do mesmo jeito que apareceria no servidor. Com um mock do módulo, a
asserção seria sobre o argumento passado ao wrapper, e o defeito da vírgula teria passado.

Cada teste foi conferido contra o código anterior à correção: os quatro falham sem a correção
correspondente e passam com ela.
