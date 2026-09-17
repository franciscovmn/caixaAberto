import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import {
  createCategory,
  createMembership,
  createOrganization,
  createUser,
} from '../factories/index.js';
import { createAuthorizationHeader } from '../helpers/auth.js';

async function criarCenario(role: 'TESOUREIRO' | 'CONSULTOR') {
  const user = await createUser();
  const organization = await createOrganization();
  await createMembership({ userId: user.id, organizationId: organization.id, role });
  const categoria = await createCategory({
    organizationId: organization.id,
    name: 'Mensalidade',
    type: 'ENTRADA',
  });

  return { organization, categoria, authorization: createAuthorizationHeader(user) };
}

function corpoValido(categoryId: bigint) {
  return {
    categoryId: categoryId.toString(),
    amount: '150.00',
    date: '2026-09-17',
    description: 'Mensalidade de setembro',
    tipo: 'ENTRADA',
  };
}

// O papel era verificado no anexo de comprovante e na listagem, mas nao na criacao do
// lancamento, entao um CONSULTOR conseguia gravar movimentacao no caixa.
describe('permissão de escrita em lançamentos', () => {
  it('recusa criação de lançamento para CONSULTOR', async () => {
    const { categoria, authorization } = await criarCenario('CONSULTOR');

    const response = await request(createApp())
      .post('/transactions')
      .set('Authorization', authorization)
      .send(corpoValido(categoria.id));

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ erro: 'Acesso permitido apenas para TESOUREIRO' });
  });

  it('permite criação de lançamento para TESOUREIRO', async () => {
    const { categoria, authorization } = await criarCenario('TESOUREIRO');

    const response = await request(createApp())
      .post('/transactions')
      .set('Authorization', authorization)
      .send(corpoValido(categoria.id));

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ type: 'ENTRADA', status: 'ATIVO' });
  });

  it('devolve o papel do vínculo no contexto atual', async () => {
    const { organization, authorization } = await criarCenario('CONSULTOR');

    const response = await request(createApp())
      .get('/organizacoes/atual/contexto')
      .set('Authorization', authorization);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      organizacaoId: organization.id.toString(),
      papel: 'CONSULTOR',
    });
  });

  it('exige autenticação para ler o contexto atual', async () => {
    const response = await request(createApp()).get('/organizacoes/atual/contexto');

    expect(response.status).toBe(401);
  });
});
