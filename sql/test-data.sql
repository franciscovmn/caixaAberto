-- TRUNCATE TABLE "COMPROVANTE", "LANCAMENTO", "META", "CATEGORIA", "MEMBRO", "USUARIO", "ORGANIZACAO" RESTART IDENTITY CASCADE;

-- ROLLBACK

-- COMMIT 

-- =========================================================
-- USUÁRIOS
-- =========================================================

INSERT INTO "USUARIO"
    (id, nome, email, senha, ativo, data_criacao)
VALUES
    -- senha: 123456
    (1, 'Murilo Maciel', 'murilo@ifpb.edu.br',
     '$2a$10$H3L9I8CxavAuuH1h5uX.M.wkQlbL9U0.6GD3VkL1pcrG5STSTUkPe',
     true, CURRENT_TIMESTAMP),

    -- senha: 123456
    (2, 'Francisco Viana', 'francisco@ifpb.edu.br',
     '$2a$10$H3L9I8CxavAuuH1h5uX.M.wkQlbL9U0.6GD3VkL1pcrG5STSTUkPe',
     true, CURRENT_TIMESTAMP),

    -- senha: 123456
    (3, 'Felipe Oliveira', 'felipe@ifpb.edu.br',
     '$2a$10$H3L9I8CxavAuuH1h5uX.M.wkQlbL9U0.6GD3VkL1pcrG5STSTUkPe',
     true, CURRENT_TIMESTAMP);


-- =========================================================
-- ORGANIZAÇÃO
-- =========================================================

INSERT INTO "ORGANIZACAO"
    (id, nome, descricao, inicio_gestao, fim_gestao,
     link_publico, transparencia_ativa)
VALUES
    (1,
     'Associação Acadêmica IFPB',
     'Organização acadêmica destinada à realização de atividades, eventos e projetos estudantis.',
     '2026-01-01',
     '2027-12-31',
     'associacao-academica-ifpb',
     true);


-- =========================================================
-- MEMBROS
-- =========================================================

INSERT INTO "MEMBRO"
    (id, usuario_id, organizacao_id, papel, data_vinculo, ativo)
VALUES
    (1, 1, 1, 'TESOUREIRO',  '2026-01-01', true),
    (2, 2, 1, 'TESOUREIRO', '2026-01-02', true),
    (3, 3, 1, 'CONSULTOR', '2026-01-02', true);


-- =========================================================
-- CATEGORIAS
-- =========================================================

-- ENTRADAS

INSERT INTO "CATEGORIA"
    (id, organizacao_id, nome, descricao, tipo, ativa)
VALUES
    (1,
     1,
     'Doações',
     'Valores recebidos por meio de doações.',
     'ENTRADA',
     true),

    (2,
     1,
     'Eventos',
     'Valores recebidos na realização de eventos.',
     'ENTRADA',
     true);


-- SAÍDAS

INSERT INTO "CATEGORIA"
    (id, organizacao_id, nome, descricao, tipo, ativa)
VALUES
    (3,
     1,
     'Alimentação',
     'Despesas relacionadas à alimentação.',
     'SAIDA',
     true),

    (4,
     1,
     'Material',
     'Compra de materiais e equipamentos.',
     'SAIDA',
     true),

    (5,
     1,
     'Transporte',
     'Despesas relacionadas ao transporte.',
     'SAIDA',
     true);


-- =========================================================
-- LANÇAMENTOS
-- =========================================================

-- ENTRADA 1

INSERT INTO "LANCAMENTO"
    (id,
     organizacao_id,
     usuario_id,
     categoria_id,
     valor,
     data,
     tipo,
     descricao,
     origem,
     destinatario,
     status,
     data_criacao,
     data_estorno)
VALUES
    (1,
     1,
     1,
     1,
     1500.00,
     '2026-09-01',
     'ENTRADA',
     'Doação para manutenção das atividades.',
     'Empresa Parceira LTDA',
     NULL,
     'ATIVO',
     CURRENT_TIMESTAMP,
     NULL);


-- ENTRADA 2

INSERT INTO "LANCAMENTO"
    (id,
     organizacao_id,
     usuario_id,
     categoria_id,
     valor,
     data,
     tipo,
     descricao,
     origem,
     destinatario,
     status,
     data_criacao,
     data_estorno)
VALUES
    (2,
     1,
     2,
     2,
     850.00,
     '2026-09-03',
     'ENTRADA',
     'Receita obtida com inscrições para evento acadêmico.',
     'Inscrições do evento',
     NULL,
     'ATIVO',
     CURRENT_TIMESTAMP,
     NULL);


-- SAÍDA 1

INSERT INTO "LANCAMENTO"
    (id,
     organizacao_id,
     usuario_id,
     categoria_id,
     valor,
     data,
     tipo,
     descricao,
     origem,
     destinatario,
     status,
     data_criacao,
     data_estorno)
VALUES
    (3,
     1,
     1,
     3,
     320.50,
     '2026-09-04',
     'SAIDA',
     'Compra de alimentação para evento.',
     NULL,
     'Cantina Universitária',
     'ATIVO',
     CURRENT_TIMESTAMP,
     NULL);


-- SAÍDA 2

INSERT INTO "LANCAMENTO"
    (id,
     organizacao_id,
     usuario_id,
     categoria_id,
     valor,
     data,
     tipo,
     descricao,
     origem,
     destinatario,
     status,
     data_criacao,
     data_estorno)
VALUES
    (4,
     1,
     3,
     4,
     780.00,
     '2026-09-05',
     'SAIDA',
     'Compra de materiais para atividades acadêmicas.',
     NULL,
     'Papelaria Central',
     'ATIVO',
     CURRENT_TIMESTAMP,
     NULL);


-- SAÍDA 3

INSERT INTO "LANCAMENTO"
    (id,
     organizacao_id,
     usuario_id,
     categoria_id,
     valor,
     data,
     tipo,
     descricao,
     origem,
     destinatario,
     status,
     data_criacao,
     data_estorno)
VALUES
    (5,
     1,
     2,
     5,
     150.00,
     '2026-09-06',
     'SAIDA',
     'Despesas com transporte para atividade externa.',
     NULL,
     'Transporte João Pessoa',
     'ATIVO',
     CURRENT_TIMESTAMP,
     NULL);


-- =========================================================
-- METAS
-- =========================================================

INSERT INTO "META"
    (id, organizacao_id, descricao, valor_alvo, prazo, data_criacao)
VALUES
    (1,
     1,
     'Arrecadar recursos para o evento acadêmico',
     5000.00,
     '2026-12-15',
     CURRENT_TIMESTAMP),

    (2,
     1,
     'Compra de novos equipamentos',
     3000.00,
     '2027-03-30',
     CURRENT_TIMESTAMP);

SELECT * FROM "CATEGORIA";
SELECT * FROM "COMPROVANTE";
SELECT * FROM "LANCAMENTO";
SELECT * FROM "MEMBRO";
SELECT * FROM "META";
SELECT * FROM "ORGANIZACAO";
SELECT * FROM "USUARIO";