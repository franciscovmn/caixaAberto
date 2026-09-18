import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mesAtual } from '../src/lib/data';
import { MonthlySummaryPage } from '../src/pages/MonthlySummaryPage';
import { autenticar, stubApi } from './helpers/api';

const RESUMO = {
  '/transactions/resumo/mensal': {
    body: {
      month: '2026-09',
      entries: '1960.00',
      exits: '2730.75',
      balance: '-770.75',
      previousMonth: {
        month: '2026-08',
        entries: '2090.50',
        exits: '320.00',
        balance: '1770.50',
      },
    },
  },
};

describe('MonthlySummaryPage', () => {
  it('apresenta entradas, saídas e saldo do mês', async () => {
    autenticar();
    stubApi(RESUMO);

    render(<MonthlySummaryPage />);

    const totais = await screen.findByRole('region', { name: /Resumo de/ });

    expect(totais).toHaveTextContent(/R\$\s*1\.960,00/);
    expect(totais).toHaveTextContent(/R\$\s*2\.730,75/);
    expect(totais).toHaveTextContent(/-R\$\s*770,75/);
  });

  // A comparacao com o mes anterior substituiu o bloco repetido de rotulos.
  it('mostra a variação percentual sobre o mês anterior', async () => {
    autenticar();
    stubApi(RESUMO);

    render(<MonthlySummaryPage />);

    const totais = await screen.findByRole('region', { name: /Resumo de/ });

    // Entradas caem de 2090,50 para 1960,00, cerca de 6,2% a menos.
    expect(totais).toHaveTextContent(/-6,2% vs\. agosto/);
    // Saidas sobem de 320,00 para 2730,75.
    expect(totais).toHaveTextContent(/\+753,4% vs\. agosto/);
  });

  it('não quebra quando o mês anterior não teve movimento', async () => {
    autenticar();
    stubApi({
      '/transactions/resumo/mensal': {
        body: {
          month: '2026-09',
          entries: '100.00',
          exits: '0',
          balance: '100.00',
          previousMonth: { month: '2026-08', entries: '0', exits: '0', balance: '0' },
        },
      },
    });

    render(<MonthlySummaryPage />);

    const totais = await screen.findByRole('region', { name: /Resumo de/ });

    expect(totais).toHaveTextContent(/Nada registrado em agosto/);
    expect(totais).toHaveTextContent(/Sem movimento em agosto/);
  });

  it('mostra o erro da API quando o resumo não carrega', async () => {
    autenticar();
    stubApi({
      '/transactions/resumo/mensal': { status: 500, body: { erro: 'Erro interno do servidor' } },
    });

    render(<MonthlySummaryPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Erro interno do servidor');
  });

  // O campo de competencia deixou de ser input[type="month"], que o Safari nao implementa,
  // e o teste segue a tela pelo gesto que o usuario faz: abrir e escolher.
  it('consulta outra competência quando o mês é trocado no seletor', async () => {
    const usuario = userEvent.setup();
    autenticar();
    const api = stubApi(RESUMO);

    render(<MonthlySummaryPage />);

    await screen.findByRole('region', { name: /Resumo de/ });

    await usuario.click(screen.getByLabelText('Mês'));
    const painel = screen.getByRole('dialog', { name: 'Escolher competência' });
    await usuario.click(within(painel).getByRole('button', { name: 'jan' }));

    const consultas = api.chamadasPara('/transactions/resumo/mensal');

    // A tela abre no mes corrente, entao o painel mostra o ano de hoje.
    const anoVigente = mesAtual().slice(0, 4);

    expect(consultas.at(-1)?.url).toContain(`mes=${anoVigente}-01`);
  });
});
