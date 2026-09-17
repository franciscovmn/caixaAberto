import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { createMembership, createOrganization, createUser } from '../factories/index.js';
import { createAuthorizationHeader } from '../helpers/auth.js';

async function criarMembro(role: 'TESOUREIRO' | 'CONSULTOR', organizationId?: bigint) {
  const user = await createUser();
  const organization = organizationId ? { id: organizationId } : await createOrganization();
  await createMembership({ userId: user.id, organizationId: organization.id, role });

  return { user, organization, authorization: createAuthorizationHeader(user) };
}

// As rotas de /users so exigiam token: qualquer sessao autenticada listava o sistema
// inteiro e alterava nome, e-mail, senha e situacao de qualquer conta.
describe('permissão nas rotas de usuário', () => {
  it('lista apenas membros da organização de quem consulta', async () => {
    const tesoureiro = await criarMembro('TESOUREIRO');
    const colega = await criarMembro('CONSULTOR', tesoureiro.organization.id);
    const forasteiro = await criarMembro('TESOUREIRO');

    const response = await request(createApp())
      .get('/users')
      .set('Authorization', tesoureiro.authorization);

    expect(response.status).toBe(200);

    const ids = (response.body as Array<{ id: string }>).map((item) => item.id);
    expect(ids).toEqual(
      expect.arrayContaining([tesoureiro.user.id.toString(), colega.user.id.toString()]),
    );
    expect(ids).not.toContain(forasteiro.user.id.toString());
  });

  it('recusa criação de usuário para CONSULTOR', async () => {
    const { authorization } = await criarMembro('CONSULTOR');

    const response = await request(createApp())
      .post('/users')
      .set('Authorization', authorization)
      .send({ name: 'Novo', email: `novo-${Date.now()}@exemplo.com`, password: 'senha123456' });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ erro: 'Acesso permitido apenas para TESOUREIRO' });
  });

  it('recusa alteração de conta alheia para CONSULTOR', async () => {
    const tesoureiro = await criarMembro('TESOUREIRO');
    const consultor = await criarMembro('CONSULTOR', tesoureiro.organization.id);

    const response = await request(createApp())
      .put(`/users/${tesoureiro.user.id}`)
      .set('Authorization', consultor.authorization)
      .send({ password: 'senhaTrocadaIndevidamente' });

    expect(response.status).toBe(403);
  });

  it('recusa exclusão de usuário para CONSULTOR', async () => {
    const tesoureiro = await criarMembro('TESOUREIRO');
    const consultor = await criarMembro('CONSULTOR', tesoureiro.organization.id);

    const response = await request(createApp())
      .delete(`/users/${tesoureiro.user.id}`)
      .set('Authorization', consultor.authorization);

    expect(response.status).toBe(403);
  });

  it('responde 404 quando o TESOUREIRO altera conta de outra organização', async () => {
    const tesoureiro = await criarMembro('TESOUREIRO');
    const forasteiro = await criarMembro('CONSULTOR');

    const response = await request(createApp())
      .put(`/users/${forasteiro.user.id}`)
      .set('Authorization', tesoureiro.authorization)
      .send({ name: 'Alterado de fora' });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ erro: 'Usuário não encontrado' });
  });

  it('responde 404 ao consultar usuário de outra organização', async () => {
    const tesoureiro = await criarMembro('TESOUREIRO');
    const forasteiro = await criarMembro('CONSULTOR');

    const response = await request(createApp())
      .get(`/users/${forasteiro.user.id}`)
      .set('Authorization', tesoureiro.authorization);

    expect(response.status).toBe(404);
  });

  it('permite ao TESOUREIRO alterar conta da própria organização', async () => {
    const tesoureiro = await criarMembro('TESOUREIRO');
    const colega = await criarMembro('CONSULTOR', tesoureiro.organization.id);

    const response = await request(createApp())
      .put(`/users/${colega.user.id}`)
      .set('Authorization', tesoureiro.authorization)
      .send({ name: 'Nome ajustado pela tesouraria' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ name: 'Nome ajustado pela tesouraria' });
  });

  it('não deixa visitante anônimo criar conta pelo cadastro', async () => {
    const response = await request(createApp())
      .post('/auth/register')
      .send({
        name: 'Invasor',
        email: `invasor-${Date.now()}@exemplo.com`,
        password: 'senha123456',
      });

    expect(response.status).toBe(401);
  });

  it('recusa cadastro para CONSULTOR autenticado', async () => {
    const { authorization } = await criarMembro('CONSULTOR');

    const response = await request(createApp())
      .post('/auth/register')
      .set('Authorization', authorization)
      .send({
        name: 'Invasor',
        email: `invasor-${Date.now()}@exemplo.com`,
        password: 'senha123456',
      });

    expect(response.status).toBe(403);
  });
});
