import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { EditTransactionPage } from '../src/pages/EditTransactionPage';
import { autenticar, stubApi } from './helpers/api';

const DETALHE = {
  id: '10',
  date: '2026-09-14T00:00:00.000Z',
  type: 'SAIDA',
  amount: '480.75',
  description: 'Aluguel de painéis',
  source: null,
  recipient: 'Decorações Silva',
  status: 'ATIVO',
  category: { id: '5', name: 'Decoração', type: 'SAIDA' },
};

const CATEGORIAS = {
  body: {
    dados: [
      { id: '5', nome: 'Decoração', tipo: 'SAIDA' },
      { id: '6', nome: 'Material', tipo: 'SAIDA' },
    ],
  },
};

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/lancamentos/10/editar']}>
      <Routes>
        <Route path="/lancamentos/:id/editar" element={<EditTransactionPage />} />
        <Route path="/lancamentos/:id" element={<h1>Detalhe do lançamento</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function abrirFormulario() {
  autenticar();
  stubApi({ '/transactions/10': { body: DETALHE }, '/categorias': CATEGORIAS });
  renderizar();
  await screen.findByRole('option', { name: 'Material (Saída)' });
}

// US20: corrigir os dados permitidos sem trocar organizacao nem responsavel.
describe('EditTransactionPage', () => {
  it('abre com os dados atuais do lançamento', async () => {
    await abrirFormulario();

    expect(screen.getByLabelText('Categoria')).toHaveValue('5');
    expect(screen.getByLabelText('Valor (R$)')).toHaveValue('480.75');
    expect(screen.getByLabelText('Destinatário')).toHaveValue('Decorações Silva');
    expect(screen.getByLabelText('Descrição')).toHaveValue('Aluguel de painéis');
  });

  it('salva descrição e categoria corrigidas e volta ao detalhe (US20)', async () => {
    await abrirFormulario();
    const usuario = userEvent.setup();
    const api = stubApi({ '/transactions/10': { body: DETALHE }, '/categorias': CATEGORIAS });

    await usuario.selectOptions(screen.getByLabelText('Categoria'), '6');
    await usuario.clear(screen.getByLabelText('Descrição'));
    await usuario.type(screen.getByLabelText('Descrição'), 'Aluguel de painéis do evento');
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(
      await screen.findByRole('heading', { name: 'Detalhe do lançamento' }),
    ).toBeInTheDocument();
    const envio = api.chamadasPara('/transactions/10').find((c) => c.method === 'PUT');
    expect(envio?.body).toEqual({
      categoryId: '6',
      amount: '480.75',
      date: '2026-09-14',
      description: 'Aluguel de painéis do evento',
      recipient: 'Decorações Silva',
    });
  });

  it('envia a origem em vez do destinatário para entrada', async () => {
    autenticar();
    const entrada = {
      ...DETALHE,
      type: 'ENTRADA',
      source: 'João',
      recipient: null,
      category: { id: '1', name: 'Mensalidade', type: 'ENTRADA' },
    };
    stubApi({
      '/transactions/10': { body: entrada },
      '/categorias': { body: { dados: [{ id: '1', nome: 'Mensalidade', tipo: 'ENTRADA' }] } },
    });
    const usuario = userEvent.setup();
    renderizar();
    await screen.findByRole('option', { name: 'Mensalidade (Entrada)' });
    const api = stubApi({ '/transactions/10': { body: entrada } });

    fireEvent.change(screen.getByLabelText('Valor (R$)'), { target: { value: '150,50' } });
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await screen.findByRole('heading', { name: 'Detalhe do lançamento' });
    const envio = api.chamadasPara('/transactions/10').find((c) => c.method === 'PUT');
    expect(envio?.body).toMatchObject({ amount: '150.50', source: 'João' });
    expect(envio?.body).not.toHaveProperty('recipient');
  });

  it('não envia com valor zero ou descrição vazia', async () => {
    await abrirFormulario();
    const usuario = userEvent.setup();
    const api = stubApi({ '/transactions/10': { body: DETALHE } });

    fireEvent.change(screen.getByLabelText('Valor (R$)'), { target: { value: '0' } });
    await usuario.clear(screen.getByLabelText('Descrição'));
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText('Informe um valor maior que zero.')).toBeInTheDocument();
    expect(screen.getByText('Informe a descrição do lançamento.')).toBeInTheDocument();
    expect(api.chamadasPara('/transactions/10').filter((c) => c.method === 'PUT')).toHaveLength(0);
  });

  it('mostra a recusa da API e mantém o que foi digitado', async () => {
    await abrirFormulario();
    const usuario = userEvent.setup();
    stubApi({
      '/transactions/10': { status: 400, body: { erro: 'Categoria inativa não pode ser usada.' } },
      '/categorias': CATEGORIAS,
    });

    await usuario.clear(screen.getByLabelText('Descrição'));
    await usuario.type(screen.getByLabelText('Descrição'), 'Descrição nova');
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Categoria inativa não pode ser usada.',
    );
    expect(screen.getByLabelText('Descrição')).toHaveValue('Descrição nova');
  });

  it('bloqueia a correção de lançamento estornado e orienta registrar outro (US20)', async () => {
    autenticar();
    stubApi({ '/transactions/10': { body: { ...DETALHE, status: 'ESTORNADO' } } });
    renderizar();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este lançamento foi estornado e não pode ser editado. Registre um novo lançamento com os dados corretos.',
    );
    expect(screen.queryByRole('button', { name: 'Salvar alterações' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para o detalhe' })).toHaveAttribute(
      'href',
      '/lancamentos/10',
    );
  });

  it('mostra o erro quando o lançamento não carrega', async () => {
    autenticar();
    stubApi({ '/transactions/10': { status: 404, body: { erro: 'Lançamento não encontrado.' } } });
    renderizar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Lançamento não encontrado.');
    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute('href', '/lancamentos/10');
  });
});
