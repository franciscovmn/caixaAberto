import bcrypt from 'bcrypt';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/database/client.js';
import { createMembership, createOrganization, createUser } from '../factories/index.js';
import { createAuthorizationHeader } from '../helpers/auth.js';

async function criarMembroAtivo(role: 'TESOUREIRO' | 'CONSULTOR' = 'TESOUREIRO') {
  const user = await createUser();
  const organization = await createOrganization();
  await createMembership({ userId: user.id, organizationId: organization.id, role });

  return { user, organization, authorization: createAuthorizationHeader(user) };
}

// O logout apenas respondia uma mensagem e a conta desativada seguia com acesso:
// em ambos os casos o token assinado continuava sendo aceito ate expirar.
describe('encerramento de sessão', () => {
  it('recusa o token depois do logout', async () => {
    const { authorization } = await criarMembroAtivo();
    const app = createApp();

    const antes = await request(app).get('/lancamentos').set('Authorization', authorization);
    expect(antes.status).toBe(200);

    const logout = await request(app).post('/auth/logout').set('Authorization', authorization);
    expect(logout.status).toBe(204);

    const depois = await request(app).get('/lancamentos').set('Authorization', authorization);
    expect(depois.status).toBe(401);
    expect(depois.body).toMatchObject({ erro: 'Token inválido ou expirado.' });
  });

  it('exige autenticação para encerrar a sessão', async () => {
    const response = await request(createApp()).post('/auth/logout');

    expect(response.status).toBe(401);
  });

  it('guarda apenas o hash do token revogado', async () => {
    const { user, authorization } = await criarMembroAtivo();
    const token = authorization.replace('Bearer ', '');

    await request(createApp()).post('/auth/logout').set('Authorization', authorization);

    const registro = await prisma.revokedToken.findFirst({ where: { userId: user.id } });

    expect(registro).not.toBeNull();
    expect(registro?.tokenHash).toHaveLength(64);
    expect(registro?.tokenHash).not.toContain(token);
  });

  it('corta o acesso de token já emitido quando a conta é desativada', async () => {
    const { user, authorization } = await criarMembroAtivo();
    const app = createApp();

    const antes = await request(app).get('/lancamentos').set('Authorization', authorization);
    expect(antes.status).toBe(200);

    await prisma.user.update({ where: { id: user.id }, data: { active: false } });

    const depois = await request(app).get('/lancamentos').set('Authorization', authorization);
    expect(depois.status).toBe(403);
    expect(depois.body).toMatchObject({ erro: 'Usuário inativo' });
  });

  it('não derruba a sessão nova aberta logo depois do logout', async () => {
    const senha = 'SenhaForte@123';
    const passwordHash = await bcrypt.hash(senha, 10);
    const user = await createUser({ passwordHash });
    const organization = await createOrganization();
    await createMembership({
      userId: user.id,
      organizationId: organization.id,
      role: 'TESOUREIRO',
    });
    const app = createApp();

    const primeiro = await request(app)
      .post('/auth/login')
      .send({ email: user.email, password: senha });
    await request(app).post('/auth/logout').set('Authorization', `Bearer ${primeiro.body.token}`);

    const segundo = await request(app)
      .post('/auth/login')
      .send({ email: user.email, password: senha });

    expect(segundo.body.token).not.toBe(primeiro.body.token);

    const resposta = await request(app)
      .get('/lancamentos')
      .set('Authorization', `Bearer ${segundo.body.token}`);

    expect(resposta.status).toBe(200);
  });

  it('usa a chave erro no contrato de login, como o restante da API', async () => {
    const response = await request(createApp())
      .post('/auth/login')
      .send({ email: 'inexistente@exemplo.com', password: 'senhaQualquer123' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ erro: 'E-mail ou senha inválidos' });
    expect(response.body).not.toHaveProperty('error');
  });
});
