import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { TransactionDetailPage } from '../src/pages/TransactionDetailPage';
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
  user: { id: '1', name: 'Ana Tesoureira', email: 'ana@exemplo.com' },
  receipt: null,
};

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/lancamentos/10']}>
      <Routes>
        <Route path="/lancamentos/:id" element={<TransactionDetailPage />} />
        <Route path="/lancamentos" element={<h1>Lançamentos</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TransactionDetailPage', () => {
  it('apresenta o lançamento com valor sinalizado e data em pt-BR', async () => {
    autenticar();
    stubApi({ '/transactions/10': { body: DETALHE } });

    renderizar();

    expect(await screen.findByRole('heading', { name: 'Aluguel de painéis' })).toBeInTheDocument();

    const valor = screen.getByRole('region', { name: 'Valor do lançamento' });
    expect(valor).toHaveTextContent(/-R\$\s*480,75/);

    expect(screen.getAllByText('14/09/2026').length).toBeGreaterThan(0);
  });

  // O enum do banco nao sobe para a tela.
  it('mostra o status como rótulo em português', async () => {
    autenticar();
    stubApi({ '/transactions/10': { body: DETALHE } });

    renderizar();

    expect(await screen.findByText('Ativo')).toBeInTheDocument();
    expect(screen.queryByText('ATIVO')).not.toBeInTheDocument();
  });

  it('usa o rótulo de destinatário para saída', async () => {
    autenticar();
    stubApi({ '/transactions/10': { body: DETALHE } });

    renderizar();

    expect(await screen.findByText('Destinatário')).toBeInTheDocument();
    expect(screen.getByText('Decorações Silva')).toBeInTheDocument();
    expect(screen.queryByText('Origem')).not.toBeInTheDocument();
  });

  it('usa o rótulo de origem para entrada e indica campo não informado', async () => {
    autenticar();
    stubApi({
      '/transactions/10': {
        body: { ...DETALHE, type: 'ENTRADA', recipient: null, source: null },
      },
    });

    renderizar();

    expect(await screen.findByText('Origem')).toBeInTheDocument();
    expect(screen.getByText('Não informado')).toBeInTheDocument();
  });

  it('avisa quando o lançamento foi estornado', async () => {
    autenticar();
    stubApi({ '/transactions/10': { body: { ...DETALHE, status: 'ESTORNADO' } } });

    renderizar();

    expect(await screen.findByRole('alert')).toHaveTextContent(/estornado/i);
    expect(screen.getAllByText('Estornado')).toHaveLength(2);
  });

  it('mostra o erro da API e oferece a volta para a listagem', async () => {
    autenticar();
    stubApi({ '/transactions/10': { status: 404, body: { erro: 'Lançamento não encontrado.' } } });

    renderizar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Lançamento não encontrado.');
    expect(screen.getByRole('link', { name: 'Voltar para a listagem' })).toBeInTheDocument();
  });
});
