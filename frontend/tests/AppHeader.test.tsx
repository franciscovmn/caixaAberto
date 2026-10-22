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

// No celular a navegacao fica recolhida atras do botao Menu; o CSS esconde a lista pelo
// data-aberto, que e o estado conferido aqui, ja que o jsdom nao aplica media query.
describe('AppHeader', () => {
  it('abre e fecha o menu pelo botão', async () => {
    autenticar();
    const usuario = userEvent.setup();
    renderizar();

    const botao = screen.getByRole('button', { name: 'Menu' });
    const navegacao = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(navegacao).toHaveAttribute('data-aberto', 'false');

    await usuario.click(botao);

    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveAttribute('aria-expanded', 'true');
    expect(navegacao).toHaveAttribute('data-aberto', 'true');
  });

  it('fecha o menu ao escolher uma tela', async () => {
    autenticar();
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(screen.getByRole('button', { name: 'Menu' }));
    await usuario.click(screen.getByRole('link', { name: 'Extrato' }));

    expect(await screen.findByRole('heading', { name: 'Extrato' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toHaveAttribute(
      'data-aberto',
      'false',
    );
  });

  it('fecha o menu com Esc e devolve o foco ao botão', async () => {
    autenticar();
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(screen.getByRole('button', { name: 'Menu' }));
    await usuario.keyboard('{Escape}');

    const botao = screen.getByRole('button', { name: 'Menu' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(botao).toHaveFocus();
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
