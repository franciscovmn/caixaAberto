import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ResetPasswordPage } from '../src/pages/ResetPasswordPage';
import { stubApi } from './helpers/api';

function renderizar(endereco = '/redefinir-senha?token=token-recebido') {
  return render(
    <MemoryRouter initialEntries={[endereco]}>
      <Routes>
        <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function preencher(
  usuario: ReturnType<typeof userEvent.setup>,
  senha: string,
  confirmacao = senha,
) {
  await usuario.type(screen.getByLabelText('Nova senha'), senha);
  await usuario.type(screen.getByLabelText('Confirmar nova senha'), confirmacao);
  await usuario.click(screen.getByRole('button', { name: 'Definir nova senha' }));
}

// US02: o link traz o token; a tela so envia senha valida e confirmada.
describe('ResetPasswordPage', () => {
  it('redefine a senha com o token do link e leva ao login (US02)', async () => {
    const api = stubApi({
      '/auth/senha/redefinir': { body: { mensagem: 'Senha redefinida com sucesso.' } },
    });
    const usuario = userEvent.setup();
    renderizar();

    await preencher(usuario, 'nova-senha-123');

    expect(await screen.findByRole('status')).toHaveTextContent('Senha redefinida com sucesso.');
    expect(screen.getByRole('link', { name: 'Entrar com a nova senha' })).toHaveAttribute(
      'href',
      '/login',
    );
    const chamada = api.chamadasPara('/auth/senha/redefinir')[0]!;
    expect(chamada.body).toEqual({ token: 'token-recebido', novaSenha: 'nova-senha-123' });
    expect(chamada.headers).not.toHaveProperty('Authorization');
  });

  it('avisa quando o link chega sem token e oferece pedir outro', () => {
    stubApi({});
    renderizar('/redefinir-senha');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'O link de redefinição é inválido ou está incompleto.',
    );
    expect(screen.getByRole('link', { name: 'Solicitar um novo link' })).toHaveAttribute(
      'href',
      '/esqueci-senha',
    );
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument();
  });

  it('recusa senha curta sem chamar a API', async () => {
    const api = stubApi({});
    const usuario = userEvent.setup();
    renderizar();

    await preencher(usuario, 'curta');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A senha deve ter no mínimo 8 caracteres.',
    );
    expect(api.chamadas).toHaveLength(0);
  });

  it('recusa confirmação diferente sem chamar a API', async () => {
    const api = stubApi({});
    const usuario = userEvent.setup();
    renderizar();

    await preencher(usuario, 'nova-senha-123', 'outra-senha-123');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A confirmação da senha não confere.',
    );
    expect(api.chamadas).toHaveLength(0);
  });

  it('mostra a recusa da API para link expirado e mantém o formulário', async () => {
    stubApi({
      '/auth/senha/redefinir': {
        status: 400,
        body: { erro: 'Link de redefinição inválido ou expirado.' },
      },
    });
    const usuario = userEvent.setup();
    renderizar();

    await preencher(usuario, 'nova-senha-123');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Link de redefinição inválido ou expirado.',
    );
    expect(screen.getByRole('button', { name: 'Definir nova senha' })).toBeInTheDocument();
  });
});
