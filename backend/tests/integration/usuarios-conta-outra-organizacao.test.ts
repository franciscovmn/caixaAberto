import bcrypt from 'bcrypt';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/database/client.js';
import { createMembership, createOrganization, createUser } from '../factories/index.js';
import { createAuthorizationHeader } from '../helpers/auth.js';

const SENHA_ORIGINAL = 'senha-original-123';

async function criarMembro(
  role: 'TESOUREIRO' | 'CONSULTOR',
  organizationId?: bigint,
  email?: string,
) {
  const user = await createUser({
    ...(email ? { email } : {}),
    passwordHash: await bcrypt.hash(SENHA_ORIGINAL, 4),
  });
  const organization = organizationId ? { id: organizationId } : await createOrganization();
  await createMembership({ userId: user.id, organizationId: organization.id, role });

  return { user, organization, authorization: createAuthorizationHeader(user) };
}

function alterar(id: bigint, authorization: string, body: object) {
  return request(createApp())
    .put(`/users/${id.toString()}`)
    .set('Authorization', authorization)
    .send(body);
}

function entrar(email: string, password: string) {
  return request(createApp()).post('/auth/login').send({ email, password });
}

async function lerConta(id: bigint) {
  return prisma.user.findUniqueOrThrow({
    where: { id },
    select: { name: true, email: true, active: true },
  });
}

const ERRO_SENHA = { erro: 'A senha só pode ser alterada pelo próprio usuário' };
const ERRO_OUTRA_ORGANIZACAO = {
  erro: 'Os dados da conta de quem participa de outra organização só podem ser alterados pelo próprio usuário',
};

// Vincular pelo e-mail e depois trocar a senha pelo PUT /users/:id deixava um tesoureiro entrar
// como o tesoureiro de outra organizacao, porque a conta e global e o PUT so conferia o vinculo.
describe('alteração de conta de quem participa de outra organização', () => {
  it('não deixa o tesoureiro tomar a conta de quem ele acabou de vincular', async () => {
    const atacante = await criarMembro('TESOUREIRO');
    const vitima = await criarMembro('TESOUREIRO', undefined, 'vitima@outra.org');

    const vinculo = await request(createApp())
      .post(`/organizacoes/${atacante.organization.id}/membros`)
      .set('Authorization', atacante.authorization)
      .send({ email: 'vitima@outra.org' });
    expect(vinculo.status).toBe(201);

    const troca = await alterar(vitima.user.id, atacante.authorization, {
      password: 'senha-do-atacante',
    });

    expect(troca.status).toBe(403);
    expect(troca.body).toEqual(ERRO_SENHA);
    expect((await entrar('vitima@outra.org', 'senha-do-atacante')).status).toBe(401);
    expect((await entrar('vitima@outra.org', SENHA_ORIGINAL)).status).toBe(200);
  });

  it('recusa a troca de senha de outro membro, mesmo que ele só participe desta organização', async () => {
    const tesoureiro = await criarMembro('TESOUREIRO');
    const colega = await criarMembro('CONSULTOR', tesoureiro.organization.id, 'colega@org.org');

    const response = await alterar(colega.user.id, tesoureiro.authorization, {
      password: 'senha-escolhida-por-outro',
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual(ERRO_SENHA);
    expect((await entrar('colega@org.org', SENHA_ORIGINAL)).status).toBe(200);
  });

  it('deixa o tesoureiro trocar a própria senha', async () => {
    const tesoureiro = await criarMembro('TESOUREIRO', undefined, 'tesoureiro@org.org');

    const response = await alterar(tesoureiro.user.id, tesoureiro.authorization, {
      password: 'senha-nova-456',
    });

    expect(response.status).toBe(200);
    expect((await entrar('tesoureiro@org.org', 'senha-nova-456')).status).toBe(200);
    expect((await entrar('tesoureiro@org.org', SENHA_ORIGINAL)).status).toBe(401);
  });

  it('recusa inativar quem tem vínculo ativo em outra organização', async () => {
    const tesoureiro = await criarMembro('TESOUREIRO');
    const vitima = await criarMembro('TESOUREIRO', undefined, 'vitima@outra.org');
    await createMembership({
      userId: vitima.user.id,
      organizationId: tesoureiro.organization.id,
      role: 'CONSULTOR',
    });

    const response = await alterar(vitima.user.id, tesoureiro.authorization, { active: false });

    expect(response.status).toBe(403);
    expect(response.body).toEqual(ERRO_OUTRA_ORGANIZACAO);
    expect((await lerConta(vitima.user.id)).active).toBe(true);
    expect((await entrar('vitima@outra.org', SENHA_ORIGINAL)).status).toBe(200);
  });

  it('recusa alterar nome e e-mail de quem tem vínculo ativo em outra organização', async () => {
    const tesoureiro = await criarMembro('TESOUREIRO');
    const vitima = await criarMembro('TESOUREIRO', undefined, 'vitima@outra.org');
    await createMembership({
      userId: vitima.user.id,
      organizationId: tesoureiro.organization.id,
      role: 'CONSULTOR',
    });

    const response = await alterar(vitima.user.id, tesoureiro.authorization, {
      name: 'Nome trocado',
      email: 'controlado@atacante.org',
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual(ERRO_OUTRA_ORGANIZACAO);
    expect(await lerConta(vitima.user.id)).toMatchObject({
      name: vitima.user.name,
      email: 'vitima@outra.org',
    });
  });

  it('continua alterando nome, e-mail e situação de quem só participa desta organização', async () => {
    const tesoureiro = await criarMembro('TESOUREIRO');
    const colega = await criarMembro('CONSULTOR', tesoureiro.organization.id);

    const response = await alterar(colega.user.id, tesoureiro.authorization, {
      name: 'Nome corrigido',
      email: 'corrigido@org.org',
      active: false,
    });

    expect(response.status).toBe(200);
    expect(await lerConta(colega.user.id)).toEqual({
      name: 'Nome corrigido',
      email: 'corrigido@org.org',
      active: false,
    });
  });

  it('não considera vínculo já desativado em outra organização', async () => {
    const tesoureiro = await criarMembro('TESOUREIRO');
    const colega = await criarMembro('CONSULTOR', tesoureiro.organization.id);
    const antiga = await createOrganization();
    await createMembership({
      userId: colega.user.id,
      organizationId: antiga.id,
      role: 'TESOUREIRO',
      active: false,
    });

    const response = await alterar(colega.user.id, tesoureiro.authorization, {
      name: 'Nome corrigido',
    });

    expect(response.status).toBe(200);
    expect((await lerConta(colega.user.id)).name).toBe('Nome corrigido');
  });

  it('não deixa o usuário inativar a própria conta', async () => {
    const tesoureiro = await criarMembro('TESOUREIRO');

    const response = await alterar(tesoureiro.user.id, tesoureiro.authorization, {
      active: false,
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ erro: 'O usuário não pode inativar a própria conta' });
    expect((await lerConta(tesoureiro.user.id)).active).toBe(true);
  });

  it('mantém recuperável a conta que um tesoureiro inativa', async () => {
    const tesoureiroA = await criarMembro('TESOUREIRO');
    const tesoureiroB = await criarMembro('TESOUREIRO');
    const maria = await criarMembro('CONSULTOR', tesoureiroA.organization.id, 'maria@a.org');

    expect(
      (await alterar(maria.user.id, tesoureiroA.authorization, { active: false })).status,
    ).toBe(200);

    // Inativa, ela nao entra em outra organizacao, onde ficaria sem ninguem para reativa-la.
    const vinculo = await request(createApp())
      .post(`/organizacoes/${tesoureiroB.organization.id}/membros`)
      .set('Authorization', tesoureiroB.authorization)
      .send({ email: 'maria@a.org' });
    expect(vinculo.status).toBe(409);

    expect((await alterar(maria.user.id, tesoureiroA.authorization, { active: true })).status).toBe(
      200,
    );
    expect((await entrar('maria@a.org', SENHA_ORIGINAL)).status).toBe(200);
  });

  it('não revela vínculo em outra organização quando nenhum dado da conta muda', async () => {
    const tesoureiro = await criarMembro('TESOUREIRO');
    const colega = await criarMembro('TESOUREIRO');
    await createMembership({
      userId: colega.user.id,
      organizationId: tesoureiro.organization.id,
      role: 'CONSULTOR',
    });

    const response = await alterar(colega.user.id, tesoureiro.authorization, {});

    expect(response.status).toBe(200);
    expect(await lerConta(colega.user.id)).toMatchObject({
      name: colega.user.name,
      email: colega.user.email,
      active: true,
    });
  });

  it('deixa quem participa de duas organizações alterar os próprios dados', async () => {
    const tesoureiro = await criarMembro('TESOUREIRO', undefined, 'duas@org.org');
    const segunda = await createOrganization();
    await createMembership({
      userId: tesoureiro.user.id,
      organizationId: segunda.id,
      role: 'CONSULTOR',
    });

    const response = await alterar(tesoureiro.user.id, tesoureiro.authorization, {
      email: 'novo-email@org.org',
    }).set('X-Organization-Id', tesoureiro.organization.id.toString());

    expect(response.status).toBe(200);
    expect((await lerConta(tesoureiro.user.id)).email).toBe('novo-email@org.org');
  });
});
