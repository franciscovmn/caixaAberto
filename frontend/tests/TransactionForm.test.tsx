import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { TransactionForm } from '../src/components/TransactionForm';
import { autenticar, stubApi } from './helpers/api';

const CATEGORIAS = {
  '/categorias': { body: { dados: [{ id: '1', nome: 'Mensalidade', tipo: 'ENTRADA' }] } },
};

const LANCAMENTO_CRIADO = {
  '/transactions': { status: 201, body: { id: '7', type: 'ENTRADA' } },
};

function renderizar() {
  return render(
    <MemoryRouter>
      <TransactionForm tipo="ENTRADA" />
    </MemoryRouter>,
  );
}

async function preencher(
  usuario: ReturnType<typeof userEvent.setup>,
  campos: { valor?: string; descricao?: string } = {},
) {
  await screen.findByRole('option', { name: /Mensalidade/ });

  await usuario.selectOptions(screen.getByLabelText(/Categoria/), '1');
  await usuario.type(screen.getByLabelText(/Valor/), campos.valor ?? '150.00');
  await usuario.type(screen.getByLabelText(/Data/), '2026-09-16');

  if (campos.descricao) {
    await usuario.type(screen.getByLabelText(/Descrição/), campos.descricao);
  }
}

function salvar(usuario: ReturnType<typeof userEvent.setup>) {
  return usuario.click(screen.getByRole('button', { name: /Salvar lançamento/ }));
}

describe('TransactionForm', () => {
  beforeEach(() => {
    autenticar();
  });

  it('normaliza a vírgula do valor antes de enviar, como o usuário digita em pt-BR', async () => {
    const api = stubApi({ ...CATEGORIAS, ...LANCAMENTO_CRIADO });
    const usuario = userEvent.setup();
    renderizar();

    await preencher(usuario, { valor: '150,50', descricao: 'Mensalidade de setembro' });
    await salvar(usuario);

    await waitFor(() => expect(api.chamadasPara('/transactions')).toHaveLength(1));

    const enviado = api.chamadasPara('/transactions')[0]!.body as { amount: string };
    expect(enviado.amount).toBe('150.50');
  });

  it('não envia nada quando a descrição está vazia', async () => {
    const api = stubApi({ ...CATEGORIAS, ...LANCAMENTO_CRIADO });
    const usuario = userEvent.setup();
    renderizar();

    await preencher(usuario);
    await salvar(usuario);

    expect(await screen.findByText('Informe a descrição do lançamento.')).toBeInTheDocument();
    expect(api.chamadasPara('/transactions')).toHaveLength(0);
  });

  it('não envia nada quando a descrição tem apenas espaços', async () => {
    const api = stubApi({ ...CATEGORIAS, ...LANCAMENTO_CRIADO });
    const usuario = userEvent.setup();
    renderizar();

    await preencher(usuario, { descricao: '   ' });
    await salvar(usuario);

    expect(await screen.findByText('Informe a descrição do lançamento.')).toBeInTheDocument();
    expect(api.chamadasPara('/transactions')).toHaveLength(0);
  });

  it('recusa valor zero ou negativo', async () => {
    const api = stubApi({ ...CATEGORIAS, ...LANCAMENTO_CRIADO });
    const usuario = userEvent.setup();
    renderizar();

    await preencher(usuario, { valor: '0', descricao: 'Valor invalido' });
    await salvar(usuario);

    expect(await screen.findByText('Informe um valor maior que zero.')).toBeInTheDocument();
    expect(api.chamadasPara('/transactions')).toHaveLength(0);
  });

  it('não cria um segundo lançamento quando o comprovante é recusado', async () => {
    const api = stubApi({
      ...CATEGORIAS,
      ...LANCAMENTO_CRIADO,
      '/comprovante': { status: 400, body: { erro: 'Envie uma imagem ou PDF de até 5 MB' } },
    });
    const usuario = userEvent.setup();
    renderizar();

    await preencher(usuario, { descricao: 'Entrada com comprovante recusado' });

    const arquivo = new File(['conteudo'], 'comprovante.pdf', { type: 'application/pdf' });
    await usuario.upload(screen.getByLabelText(/Comprovante/), arquivo);

    await salvar(usuario);

    expect(
      await screen.findByText(/Lançamento salvo, mas o comprovante não foi anexado/),
    ).toBeInTheDocument();

    // O lancamento ja foi gravado, entao o formulario precisa esvaziar: e a limpeza que impede um
    // segundo clique de duplicar o registro.
    await waitFor(() => expect(screen.getByLabelText(/Descrição/)).toHaveValue(''));

    await salvar(usuario);

    expect(api.chamadasPara('/transactions')).toHaveLength(1);
  });

  it('envia o lançamento completo no caminho feliz', async () => {
    const api = stubApi({ ...CATEGORIAS, ...LANCAMENTO_CRIADO });
    const usuario = userEvent.setup();
    renderizar();

    await preencher(usuario, { valor: '310.00', descricao: 'Mensalidade de outubro' });
    await usuario.type(screen.getByLabelText(/Origem/), 'Turma 2026');
    await salvar(usuario);

    await waitFor(() => expect(api.chamadasPara('/transactions')).toHaveLength(1));

    expect(api.chamadasPara('/transactions')[0]!.body).toMatchObject({
      categoryId: '1',
      amount: '310.00',
      date: '2026-09-16',
      description: 'Mensalidade de outubro',
      tipo: 'ENTRADA',
      source: 'Turma 2026',
    });
  });
});
