import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/database/client.js';
import { createMembership, createOrganization, createUser } from '../factories/index.js';
import { createAuthorizationHeader } from '../helpers/auth.js';

describe('link público da organização', () => {
  it('Cenário 1 - gerar e ativar', async () => {
    const user = await createUser();
    const organization = await createOrganization();
    await createMembership({ userId: user.id, organizationId: organization.id });

    const response = await request(createApp())
      .post('/organizacoes/atual/link-publico')
      .set('Authorization', createAuthorizationHeader(user));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      ativo: true,
    });

    const persistedOrganization = await prisma.organization.findUniqueOrThrow({
      where: { id: organization.id },
    });

    expect(persistedOrganization.publicLink).toBe(response.body.token);
    expect(persistedOrganization.transparencyActive).toBe(true);
  });

  it('Cenário 2 - desativar', async () => {
    const user = await createUser();
    const organization = await createOrganization({
      publicLink: 'token-ativo',
      transparencyActive: true,
    });
    await createMembership({ userId: user.id, organizationId: organization.id });

    const response = await request(createApp())
      .patch('/organizacoes/atual/link-publico')
      .set('Authorization', createAuthorizationHeader(user))
      .send({ ativo: false });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ token: 'token-ativo', ativo: false });

    const persistedOrganization = await prisma.organization.findUniqueOrThrow({
      where: { id: organization.id },
    });

    expect(persistedOrganization.publicLink).toBe('token-ativo');
    expect(persistedOrganization.transparencyActive).toBe(false);
  });

  it('Cenário 3 - usuário sem permissão', async () => {
    const user = await createUser();
    const organization = await createOrganization({
      publicLink: 'token-consultor',
      transparencyActive: true,
    });
    await createMembership({
      userId: user.id,
      organizationId: organization.id,
      role: 'CONSULTOR',
    });

    const authorization = createAuthorizationHeader(user);
    const postResponse = await request(createApp())
      .post('/organizacoes/atual/link-publico')
      .set('Authorization', authorization);
    const patchResponse = await request(createApp())
      .patch('/organizacoes/atual/link-publico')
      .set('Authorization', authorization)
      .send({ ativo: false });

    expect(postResponse.status).toBe(403);
    expect(patchResponse.status).toBe(403);
    expect(postResponse.body).toEqual({ erro: 'Acesso permitido apenas para TESOUREIRO' });
    expect(patchResponse.body).toEqual({ erro: 'Acesso permitido apenas para TESOUREIRO' });

    const persistedOrganization = await prisma.organization.findUniqueOrThrow({
      where: { id: organization.id },
    });

    expect(persistedOrganization.publicLink).toBe('token-consultor');
    expect(persistedOrganization.transparencyActive).toBe(true);
  });

  it('regenera o token e invalida o endereço anterior', async () => {
    const user = await createUser();
    const organization = await createOrganization({
      publicLink: 'token-anterior',
      transparencyActive: true,
    });
    await createMembership({ userId: user.id, organizationId: organization.id });

    const response = await request(createApp())
      .post('/organizacoes/atual/link-publico')
      .set('Authorization', createAuthorizationHeader(user));

    expect(response.status).toBe(200);
    expect(response.body.token).not.toBe('token-anterior');
    expect(response.body.ativo).toBe(true);

    const previousLinkResponse = await request(createApp()).get('/transparency/token-anterior');
    const currentLinkResponse = await request(createApp()).get(
      `/transparency/${response.body.token}`,
    );

    expect(previousLinkResponse.status).toBe(404);
    expect(currentLinkResponse.status).toBe(200);
  });

  it.each([true, false])(
    'responde 409 ao alterar ativo para %s sem token gerado',
    async (active) => {
      const user = await createUser();
      const organization = await createOrganization();
      await createMembership({ userId: user.id, organizationId: organization.id });

      const response = await request(createApp())
        .patch('/organizacoes/atual/link-publico')
        .set('Authorization', createAuthorizationHeader(user))
        .send({ ativo: active });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ erro: 'Link público ainda não foi gerado' });

      const persistedOrganization = await prisma.organization.findUniqueOrThrow({
        where: { id: organization.id },
      });
      expect(persistedOrganization.publicLink).toBeNull();
      expect(persistedOrganization.transparencyActive).toBe(false);
    },
  );

  it('reativa um token existente sem gerar outro', async () => {
    const user = await createUser();
    const organization = await createOrganization({
      publicLink: 'token-para-reativar',
      transparencyActive: false,
    });
    await createMembership({ userId: user.id, organizationId: organization.id });

    const response = await request(createApp())
      .patch('/organizacoes/atual/link-publico')
      .set('Authorization', createAuthorizationHeader(user))
      .send({ ativo: true });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ token: 'token-para-reativar', ativo: true });

    const persistedOrganization = await prisma.organization.findUniqueOrThrow({
      where: { id: organization.id },
    });
    expect(persistedOrganization.publicLink).toBe('token-para-reativar');
    expect(persistedOrganization.transparencyActive).toBe(true);
  });

  it('rejeita ativo de tipo errado com mensagem em português', async () => {
    const user = await createUser();
    const organization = await createOrganization({ publicLink: 'token-existente' });
    await createMembership({ userId: user.id, organizationId: organization.id });

    const response = await request(createApp())
      .patch('/organizacoes/atual/link-publico')
      .set('Authorization', createAuthorizationHeader(user))
      .send({ ativo: 'false' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      erro: 'Dados inválidos',
      campos: {
        ativo: 'Entrada inválida: esperava um valor booleano, recebeu um texto',
      },
    });
  });

  it('rejeita campo adicional no body com mensagem em português', async () => {
    const user = await createUser();
    const organization = await createOrganization({ publicLink: 'token-existente' });
    await createMembership({ userId: user.id, organizationId: organization.id });

    const response = await request(createApp())
      .patch('/organizacoes/atual/link-publico')
      .set('Authorization', createAuthorizationHeader(user))
      .send({ ativo: false, organizacaoId: organization.id.toString() });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      erro: 'Dados inválidos',
      campos: { requisicao: 'Chave inválida: "organizacaoId"' },
    });
  });

  it('rejeita requisição sem token de autenticação', async () => {
    const response = await request(createApp()).post('/organizacoes/atual/link-publico');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ erro: 'Token de autenticação não fornecido.' });
  });

  it('altera apenas a organização selecionada pelo contexto', async () => {
    const user = await createUser();
    const selectedOrganization = await createOrganization();
    const untouchedOrganization = await createOrganization({
      publicLink: 'token-segunda-organizacao',
      transparencyActive: false,
    });
    await createMembership({
      userId: user.id,
      organizationId: selectedOrganization.id,
    });
    await createMembership({
      userId: user.id,
      organizationId: untouchedOrganization.id,
    });

    const response = await request(createApp())
      .post('/organizacoes/atual/link-publico')
      .set('Authorization', createAuthorizationHeader(user))
      .set('X-Organization-Id', selectedOrganization.id.toString());

    expect(response.status).toBe(200);

    const [persistedSelected, persistedUntouched] = await Promise.all([
      prisma.organization.findUniqueOrThrow({ where: { id: selectedOrganization.id } }),
      prisma.organization.findUniqueOrThrow({ where: { id: untouchedOrganization.id } }),
    ]);

    expect(persistedSelected.publicLink).toBe(response.body.token);
    expect(persistedSelected.transparencyActive).toBe(true);
    expect(persistedUntouched.publicLink).toBe('token-segunda-organizacao');
    expect(persistedUntouched.transparencyActive).toBe(false);
  });

  it('bloqueia a rota pública assim que o link é desativado', async () => {
    const user = await createUser();
    const organization = await createOrganization();
    await createMembership({ userId: user.id, organizationId: organization.id });
    const authorization = createAuthorizationHeader(user);

    const generationResponse = await request(createApp())
      .post('/organizacoes/atual/link-publico')
      .set('Authorization', authorization);
    const token = generationResponse.body.token;

    const activeResponse = await request(createApp()).get(`/transparency/${token}`);
    const deactivationResponse = await request(createApp())
      .patch('/organizacoes/atual/link-publico')
      .set('Authorization', authorization)
      .send({ ativo: false });
    const inactiveResponse = await request(createApp()).get(`/transparency/${token}`);

    expect(generationResponse.status).toBe(200);
    expect(activeResponse.status).toBe(200);
    expect(deactivationResponse.status).toBe(200);
    expect(inactiveResponse.status).toBe(404);
  });

  // Sem leitura, a tela so descobria o link gerando outro, o que invalidava o
  // endereco ja distribuido a quem acompanha a prestacao de contas.
  it('Cenário 6 - consultar o link vigente sem regenerá-lo', async () => {
    const user = await createUser();
    const organization = await createOrganization({
      publicLink: 'token-existente',
      transparencyActive: true,
    });
    await createMembership({ userId: user.id, organizationId: organization.id });

    const response = await request(createApp())
      .get('/organizacoes/atual/link-publico')
      .set('Authorization', createAuthorizationHeader(user));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ token: 'token-existente', ativo: true });

    const persistedOrganization = await prisma.organization.findUniqueOrThrow({
      where: { id: organization.id },
    });

    expect(persistedOrganization.publicLink).toBe('token-existente');
  });

  it('Cenário 7 - consultar quando ainda não há link devolve nulo', async () => {
    const user = await createUser();
    const organization = await createOrganization();
    await createMembership({ userId: user.id, organizationId: organization.id });

    const response = await request(createApp())
      .get('/organizacoes/atual/link-publico')
      .set('Authorization', createAuthorizationHeader(user));

    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
  });

  it('Cenário 8 - consulta do link exige papel TESOUREIRO', async () => {
    const user = await createUser();
    const organization = await createOrganization({
      publicLink: 'token-existente',
      transparencyActive: true,
    });
    await createMembership({
      userId: user.id,
      organizationId: organization.id,
      role: 'CONSULTOR',
    });

    const response = await request(createApp())
      .get('/organizacoes/atual/link-publico')
      .set('Authorization', createAuthorizationHeader(user));

    expect(response.status).toBe(403);
  });
});
