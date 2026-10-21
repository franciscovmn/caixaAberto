import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ProtectedRoute } from '../src/components/ProtectedRoute';
import { apiRequest } from '../src/lib/httpClient';
import { autenticar, stubApi } from './helpers/api';

function vinculo(id: string, nome: string, papel: 'TESOUREIRO' | 'CONSULTOR') {
  return {
    vinculoId: id,
    papel,
    dataVinculo: '2026-01-01',
    organizacao: {
      id,
      nome,
      descricao: '',
      inicioGestao: '2026-01-01',
      fimGestao: '2026-12-31',
      linkPublico: null,
      transparenciaAtiva: false,
    },
  };
}

const DUAS_ORGANIZACOES = {
  body: {
    dados: [
      vinculo('1', 'Comissão de Formatura', 'TESOUREIRO'),
      vinculo('2', 'Atlética TSI', 'CONSULTOR'),
    ],
  },
};

// Tela de teste: so consulta a API ao montar, como as telas reais da area protegida.
function TelaQueConsulta() {
  useEffect(() => {
    void apiRequest('/lancamentos-teste').catch(() => undefined);
  }, []);

  return <h1>Lançamentos</h1>;
}

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/lancamentos']}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/lancamentos" element={<TelaQueConsulta />} />
          <Route path="/organizacao/nova" element={<h1>Criar organização</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

// US13: o usuario escolhe a organizacao de trabalho no cabecalho e as consultas seguem a escolha.
describe('seleção da organização de trabalho', () => {
  it('lista só as organizações do usuário e consulta a primeira (US13)', async () => {
    autenticar();
    const api = stubApi({ '/users/me/organizacoes': DUAS_ORGANIZACOES, '/lancamentos-teste': {} });
    renderizar();

    const seletor = await screen.findByRole('combobox', { name: 'Organização de trabalho' });
    expect(screen.getByRole('option', { name: 'Comissão de Formatura' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Atlética TSI' })).toBeInTheDocument();
    expect(seletor).toHaveValue('1');
    await screen.findByRole('heading', { name: 'Lançamentos' });
    expect(api.chamadasPara('/lancamentos-teste')[0]!.headers['X-Organization-Id']).toBe('1');
  });

  it('passa a consultar a organização escolhida no cabeçalho (US13)', async () => {
    autenticar();
    const api = stubApi({ '/users/me/organizacoes': DUAS_ORGANIZACOES, '/lancamentos-teste': {} });
    const usuario = userEvent.setup();
    renderizar();

    const seletor = await screen.findByRole('combobox', { name: 'Organização de trabalho' });
    await usuario.selectOptions(seletor, '2');

    expect(seletor).toHaveValue('2');
    expect(localStorage.getItem('caixaAberto.organizationId')).toBe('2');
    expect(localStorage.getItem('caixaAberto.papel')).toBe('CONSULTOR');
    const consultas = api.chamadasPara('/lancamentos-teste');
    expect(consultas.at(-1)!.headers['X-Organization-Id']).toBe('2');
  });

  it('mantém a organização escolhida antes ao abrir de novo', async () => {
    autenticar();
    localStorage.setItem('caixaAberto.organizationId', '2');
    stubApi({ '/users/me/organizacoes': DUAS_ORGANIZACOES, '/lancamentos-teste': {} });
    renderizar();

    expect(await screen.findByRole('combobox', { name: 'Organização de trabalho' })).toHaveValue(
      '2',
    );
  });

  it('leva para o cadastro de organização quando o usuário não tem vínculo', async () => {
    autenticar();
    stubApi({ '/users/me/organizacoes': { body: { dados: [] } } });
    renderizar();

    expect(await screen.findByRole('heading', { name: 'Criar organização' })).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Organização de trabalho' }),
    ).not.toBeInTheDocument();
  });

  it('mostra o erro quando as organizações não carregam', async () => {
    autenticar();
    stubApi({
      '/users/me/organizacoes': { status: 500, body: { erro: 'Erro interno do servidor' } },
    });
    renderizar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Erro interno do servidor');
  });
});
