import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';

describe('estrutura HTTP da API', () => {
  it('informa que o serviço está saudável', async () => {
    const response = await request(createApp()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('retorna erros no contrato público sem stack trace', async () => {
    const response = await request(createApp()).get('/rota-inexistente');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ erro: 'Rota não encontrada' });
    expect(response.text).not.toContain('stack');
  });

  it('disponibiliza o contexto autenticado informado no cabeçalho de teste', async () => {
    const context = JSON.stringify({
      usuarioId: '11',
      organizacaoId: '22',
      papel: 'TESOUREIRO',
    });

    const response = await request(createApp())
      .get('/test/contexto')
      .set('X-Test-Context', context);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      usuarioId: '11',
      organizacaoId: '22',
      papel: 'TESOUREIRO',
    });
  });

  it('rejeita contexto de teste malformado no contrato padrão de erros', async () => {
    const response = await request(createApp())
      .get('/test/contexto')
      .set('X-Test-Context', '{"papel":"INVALIDO"}');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ erro: 'Contexto de teste inválido' });
  });

  it('retorna erro de autenticação no contrato público da API', async () => {
    const response = await request(createApp()).get('/users');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ erro: 'Token de autenticação não fornecido.' });
  });

  it('retorna token inválido no contrato público da API', async () => {
    const response = await request(createApp())
      .get('/users')
      .set('Authorization', 'Bearer token-invalido');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ erro: 'Token inválido ou expirado.' });
  });
});

describe('estrutura da suíte de testes', () => {
  // O vitest.config.ts fixa TZ para que a suíte rode sob fuso negativo. Sob UTC, formatar uma data
  // pelo horário local e formatar em UTC produzem o mesmo resultado, então uma regressão de fuso
  // ficaria verde. Se o TZ deixar de ser aplicado, a proteção some em silêncio e só este teste avisa.
  it('a suíte roda sob fuso negativo, senão regressões de data passam despercebidas', () => {
    const meiaNoiteUtc = new Date('2026-09-02T00:00:00.000Z');

    expect(meiaNoiteUtc.getTimezoneOffset()).toBeGreaterThan(0);
    expect(meiaNoiteUtc.getDate()).not.toBe(meiaNoiteUtc.getUTCDate());
  });
});

describe('corpo malformado', () => {
  // O SyntaxError do express.json() caia no fallback do tratador e virava 500.
  it('responde 400 quando o corpo não é JSON válido', async () => {
    const response = await request(createApp())
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "ana@exemplo.com", quebrado');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ erro: 'Corpo da requisição não é um JSON válido' });
  });
});
