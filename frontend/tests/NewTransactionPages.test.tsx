import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { NewInflowPage } from '../src/pages/NewInflowPage';
import { NewOutflowPage } from '../src/pages/NewOutflowPage';
import { autenticar, stubApi } from './helpers/api';

const CATEGORIAS = { '/categorias': { body: { dados: [{ id: '1', nome: 'Mensalidade' }] } } };

describe('telas de registro de lançamento', () => {
  it('a tela de entrada usa o rótulo de origem', async () => {
    autenticar();
    stubApi(CATEGORIAS);

    render(
      <MemoryRouter>
        <NewInflowPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Registrar entrada' })).toBeInTheDocument();
    expect(await screen.findByLabelText(/Origem/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Destinatário/)).not.toBeInTheDocument();
  });

  it('a tela de saída usa o rótulo de destinatário', async () => {
    autenticar();
    stubApi(CATEGORIAS);

    render(
      <MemoryRouter>
        <NewOutflowPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Registrar saída' })).toBeInTheDocument();
    expect(await screen.findByLabelText(/Destinatário/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Origem/)).not.toBeInTheDocument();
  });

  // O formulario tinha um h2 que repetia o titulo da pagina; virou nome acessivel.
  it('o formulário tem nome acessível sem duplicar o título da página', async () => {
    autenticar();
    stubApi(CATEGORIAS);

    render(
      <MemoryRouter>
        <NewInflowPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('form', { name: 'Registrar entrada financeira' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });

  it('oferece a volta para a listagem', () => {
    autenticar();
    stubApi(CATEGORIAS);

    render(
      <MemoryRouter>
        <NewOutflowPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Voltar para a listagem' })).toHaveAttribute(
      'href',
      '/lancamentos',
    );
  });
});
