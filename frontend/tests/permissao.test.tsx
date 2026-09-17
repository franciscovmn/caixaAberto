import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { RotaTesoureiro } from '../src/components/RotaTesoureiro';
import { TransactionsListPage } from '../src/pages/TransactionsListPage';
import { autenticar, stubApi } from './helpers/api';

const LISTAGEM = {
  '/categorias': { body: { dados: [] } },
  '/lancamentos': {
    body: {
      dados: [],
      paginacao: { pagina: 1, tamanhoPagina: 20, total: 0, totalPaginas: 0 },
    },
  },
};

function renderizarListagem() {
  return render(
    <MemoryRouter initialEntries={['/lancamentos']}>
      <Routes>
        <Route path="/lancamentos" element={<TransactionsListPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderizarRotaDeEscrita() {
  return render(
    <MemoryRouter initialEntries={['/lancamentos/entrada']}>
      <Routes>
        <Route path="/lancamentos" element={<h1>Lançamentos</h1>} />
        <Route element={<RotaTesoureiro />}>
          <Route path="/lancamentos/entrada" element={<h1>Registrar entrada</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

// Um CONSULTOR via e alcancava as telas de escrita, e a API aceitava a criacao.
// O servidor agora recusa com 403; a interface deixa de oferecer o caminho.
describe('permissão de escrita na interface', () => {
  it('esconde as ações de registro para CONSULTOR', async () => {
    autenticar('CONSULTOR');
    stubApi(LISTAGEM);
    renderizarListagem();

    await screen.findByRole('heading', { name: 'Lançamentos' });

    expect(screen.queryByRole('link', { name: 'Registrar entrada' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Registrar saída' })).not.toBeInTheDocument();
  });

  it('mostra as ações de registro para TESOUREIRO', async () => {
    autenticar('TESOUREIRO');
    stubApi(LISTAGEM);
    renderizarListagem();

    expect(await screen.findByRole('link', { name: 'Registrar entrada' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Registrar saída' })).toBeInTheDocument();
  });

  it('desvia CONSULTOR que abre a tela de registro pela URL', () => {
    autenticar('CONSULTOR');
    stubApi({});
    renderizarRotaDeEscrita();

    expect(screen.getByRole('heading', { name: 'Lançamentos' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Registrar entrada' })).not.toBeInTheDocument();
  });

  it('deixa TESOUREIRO abrir a tela de registro', () => {
    autenticar('TESOUREIRO');
    stubApi({});
    renderizarRotaDeEscrita();

    expect(screen.getByRole('heading', { name: 'Registrar entrada' })).toBeInTheDocument();
  });
});
