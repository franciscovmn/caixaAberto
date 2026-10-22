import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppHeader } from '../src/components/AppHeader';
import { autenticar } from './helpers/api';

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/lancamentos']}>
      <AppHeader comNavegacao />
      <Routes>
        <Route path="/lancamentos" element={<h1>Lançamentos</h1>} />
        <Route path="/extrato" element={<h1>Extrato</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppHeader', () => {
  it('mostra as três telas e marca a atual', () => {
    autenticar();
    renderizar();

    const navegacao = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(
      within(navegacao)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Lançamentos', 'Extrato', 'Organização']);
    expect(within(navegacao).getByRole('link', { name: 'Lançamentos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  // Resumo e Relatorio viraram a visao Resumo do extrato.
  it('leva ao extrato', async () => {
    autenticar();
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(screen.getByRole('link', { name: 'Extrato' }));

    expect(await screen.findByRole('heading', { name: 'Extrato' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Resumo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Relatório' })).not.toBeInTheDocument();
  });

  // Membros, categorias, dados e link publico ficam nas abas da area Organizacao.
  it('reúne a administração da organização num único link', () => {
    autenticar('CONSULTOR');
    renderizar();

    const navegacao = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(within(navegacao).getByRole('link', { name: 'Organização' })).toHaveAttribute(
      'href',
      '/organizacao',
    );
    expect(within(navegacao).queryByRole('link', { name: 'Membros' })).not.toBeInTheDocument();
    expect(within(navegacao).queryByRole('link', { name: 'Link público' })).not.toBeInTheDocument();
  });

  it('não sobrepõe a legenda às ações enquanto a área protegida carrega', () => {
    render(
      <MemoryRouter>
        <AppHeader acoes={<button type="button">Sair</button>} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
    expect(screen.queryByText('Prestação de contas')).not.toBeInTheDocument();
  });
});
