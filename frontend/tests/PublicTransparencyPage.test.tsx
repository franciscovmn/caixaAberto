import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { PublicTransparencyPage } from '../src/pages/PublicTransparencyPage';
import { stubApi } from './helpers/api';

const TRANSPARENCIA = {
  '/transparency/': {
    body: {
      organization: {
        name: 'Comissão de Formatura',
        description: 'Prestação de contas da comissão.',
      },
      month: '2026-09',
      totals: { entries: '1960.00', exits: '2730.75', balance: '-770.75' },
      byCategory: [
        { type: 'ENTRADA', category: 'Mensalidade', total: '1320.00', count: 2 },
        { type: 'SAIDA', category: 'Buffet', total: '2200.00', count: 1 },
      ],
      privacy: { personalFieldsHidden: true },
    },
  },
};

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/transparencia/token-publico?mes=2026-09']}>
      <Routes>
        <Route path="/transparencia/:link" element={<PublicTransparencyPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// E a unica tela que pessoas de fora abrem, e sem autenticacao.
describe('PublicTransparencyPage', () => {
  it('apresenta a organização e os totais do mês sem exigir sessão', async () => {
    stubApi(TRANSPARENCIA);

    renderizar();

    expect(
      await screen.findByRole('heading', { name: 'Comissão de Formatura' }),
    ).toBeInTheDocument();

    const totais = screen.getByRole('region', { name: /Totais de/ });
    expect(totais).toHaveTextContent(/R\$\s*1\.960,00/);
    expect(totais).toHaveTextContent(/R\$\s*2\.730,75/);
    expect(totais).toHaveTextContent(/-R\$\s*770,75/);
  });

  it('traduz o tipo da categoria em vez de expor o enum', async () => {
    stubApi(TRANSPARENCIA);

    renderizar();

    const tabela = await screen.findByRole('region', { name: 'Movimentações por categoria' });

    expect(within(tabela).getByText('Entrada')).toBeInTheDocument();
    expect(within(tabela).getByText('Saída')).toBeInTheDocument();
    expect(within(tabela).queryByText('ENTRADA')).not.toBeInTheDocument();
    expect(within(tabela).queryByText('SAIDA')).not.toBeInTheDocument();
  });

  it('exibe a nota de privacidade quando a API indica campos ocultos', async () => {
    stubApi(TRANSPARENCIA);

    renderizar();

    expect(await screen.findByText(/Nenhum dado pessoal/)).toHaveTextContent(/LGPD/);
  });

  it('explica o que houve quando o link não está mais ativo', async () => {
    stubApi({
      '/transparency/': {
        status: 404,
        body: { erro: 'Página de transparência não encontrada ou desativada.' },
      },
    });

    renderizar();

    expect(await screen.findByText('Prestação de contas indisponível')).toBeInTheDocument();
    expect(screen.getByText(/link não está mais ativo/)).toBeInTheDocument();
  });

  it('trata mês sem movimentação', async () => {
    stubApi({
      '/transparency/': {
        body: {
          organization: { name: 'Comissão de Formatura', description: 'Prestação de contas.' },
          month: '2025-01',
          totals: { entries: '0', exits: '0', balance: '0' },
          byCategory: [],
          privacy: { personalFieldsHidden: true },
        },
      },
    });

    renderizar();

    expect(await screen.findByText('Sem movimentações neste mês')).toBeInTheDocument();
  });
});
