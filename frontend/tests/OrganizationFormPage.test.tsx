import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { OrganizationProvider } from '../src/contexts/OrganizationContext';
import { OrganizationFormPage } from '../src/pages/OrganizationFormPage';
import { autenticar, stubApi } from './helpers/api';

const ORGANIZACAO = {
  id: '1',
  nome: 'Comissão de Formatura',
  descricao: 'Turma de TSI 2026',
  inicioGestao: '2026-01-01',
  fimGestao: '2026-12-31',
  linkPublico: null,
  transparenciaAtiva: false,
};

const VINCULOS = {
  body: {
    dados: [
      { vinculoId: '1', papel: 'TESOUREIRO', dataVinculo: '2026-01-01', organizacao: ORGANIZACAO },
    ],
  },
};

function renderizar(endereco: '/organizacao/nova' | '/organizacao/editar') {
  return render(
    <MemoryRouter initialEntries={[endereco]}>
      <OrganizationProvider>
        <Routes>
          <Route path="/organizacao/nova" element={<OrganizationFormPage modo="criar" />} />
          <Route path="/organizacao/editar" element={<OrganizationFormPage modo="editar" />} />
          <Route path="/lancamentos" element={<h1>Lançamentos</h1>} />
        </Routes>
      </OrganizationProvider>
    </MemoryRouter>,
  );
}

// O campo de data da gestao e um input date: o valor muda direto, no formato YYYY-MM-DD.
function informarPeriodo(inicio: string, fim: string) {
  fireEvent.change(screen.getByLabelText('Início da gestão'), { target: { value: inicio } });
  fireEvent.change(screen.getByLabelText('Fim da gestão'), { target: { value: fim } });
}

describe('OrganizationFormPage', () => {
  // US07: quem ainda nao tem organizacao cadastra a sua e passa a trabalhar nela.
  it('cadastra a organização e abre os lançamentos (US07)', async () => {
    autenticar();
    const api = stubApi({
      '/users/me/organizacoes': { body: { dados: [] } },
      '/organizacoes': { status: 201, body: { organizacao: { ...ORGANIZACAO, id: '7' } } },
    });
    const usuario = userEvent.setup();
    renderizar('/organizacao/nova');

    await usuario.type(screen.getByLabelText('Nome'), 'Atlética TSI');
    await usuario.type(screen.getByLabelText('Descrição'), 'Atlética do curso');
    informarPeriodo('2026-09-01', '2027-08-31');
    await usuario.click(screen.getByRole('button', { name: 'Criar organização' }));

    expect(await screen.findByRole('heading', { name: 'Lançamentos' })).toBeInTheDocument();
    const envio = api.chamadas.find((c) => c.method === 'POST');
    expect(envio?.url).toMatch(/\/organizacoes$/);
    expect(envio?.body).toEqual({
      nome: 'Atlética TSI',
      descricao: 'Atlética do curso',
      inicioGestao: '2026-09-01',
      fimGestao: '2027-08-31',
    });
  });

  it('recusa fim da gestão antes do início sem chamar a API (US07)', async () => {
    autenticar();
    const api = stubApi({ '/users/me/organizacoes': { body: { dados: [] } } });
    const usuario = userEvent.setup();
    renderizar('/organizacao/nova');

    await usuario.type(screen.getByLabelText('Nome'), 'Atlética TSI');
    await usuario.type(screen.getByLabelText('Descrição'), 'Atlética do curso');
    informarPeriodo('2026-09-01', '2026-08-31');
    await usuario.click(screen.getByRole('button', { name: 'Criar organização' }));

    expect(
      await screen.findByText('A data final deve ser igual ou posterior à data inicial.'),
    ).toBeInTheDocument();
    expect(api.chamadas.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  it('pede os campos obrigatórios antes de enviar', async () => {
    autenticar();
    const api = stubApi({ '/users/me/organizacoes': { body: { dados: [] } } });
    const usuario = userEvent.setup();
    renderizar('/organizacao/nova');

    await usuario.click(screen.getByRole('button', { name: 'Criar organização' }));

    expect(await screen.findByText('Informe o nome da organização.')).toBeInTheDocument();
    expect(screen.getByText('Informe a descrição da organização.')).toBeInTheDocument();
    expect(screen.getByText('Informe o início da gestão.')).toBeInTheDocument();
    expect(screen.getByText('Informe o fim da gestão.')).toBeInTheDocument();
    expect(api.chamadas.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  // US08: alterar nome e periodo da organizacao selecionada.
  it('abre com os dados da organização selecionada e salva as alterações (US08)', async () => {
    autenticar();
    const api = stubApi({
      '/users/me/organizacoes': VINCULOS,
      '/organizacoes/1': { body: { ...ORGANIZACAO, nome: 'Comissão de Formatura 2026' } },
    });
    const usuario = userEvent.setup();
    renderizar('/organizacao/editar');

    const nome = await screen.findByDisplayValue('Comissão de Formatura');
    expect(screen.getByLabelText('Fim da gestão')).toHaveValue('2026-12-31');

    await usuario.clear(nome);
    await usuario.type(nome, 'Comissão de Formatura 2026');
    informarPeriodo('2026-02-01', '2027-01-31');
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByRole('heading', { name: 'Lançamentos' })).toBeInTheDocument();
    const envio = api.chamadasPara('/organizacoes/1').find((c) => c.method === 'PUT');
    expect(envio?.body).toEqual({
      nome: 'Comissão de Formatura 2026',
      descricao: 'Turma de TSI 2026',
      inicioGestao: '2026-02-01',
      fimGestao: '2027-01-31',
    });
  });

  it('mostra a recusa da API ao alterar (US08)', async () => {
    autenticar();
    stubApi({
      '/users/me/organizacoes': VINCULOS,
      '/organizacoes/1': {
        status: 403,
        body: { erro: 'Apenas tesoureiros podem alterar a organização.' },
      },
    });
    const usuario = userEvent.setup();
    renderizar('/organizacao/editar');

    await screen.findByDisplayValue('Comissão de Formatura');
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Apenas tesoureiros podem alterar a organização.',
    );
    expect(screen.queryByRole('heading', { name: 'Lançamentos' })).not.toBeInTheDocument();
  });
});
