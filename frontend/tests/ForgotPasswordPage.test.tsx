import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ForgotPasswordPage } from '../src/pages/ForgotPasswordPage';
import { stubApi } from './helpers/api';

const MENSAGEM_GENERICA =
  'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.';

function renderizar() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  );
}

// US02: a recuperacao fica fora da sessao e responde igual para e-mail cadastrado ou nao.
describe('ForgotPasswordPage', () => {
  it('envia o e-mail informado sem sessão e mostra a mensagem da API (US02)', async () => {
    const api = stubApi({ '/auth/senha/solicitar': { body: { mensagem: MENSAGEM_GENERICA } } });
    const usuario = userEvent.setup();
    renderizar();

    await usuario.type(screen.getByLabelText('E-mail'), '  ana@exemplo.com ');
    await usuario.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }));

    expect(await screen.findByRole('status')).toHaveTextContent(MENSAGEM_GENERICA);
    const chamada = api.chamadasPara('/auth/senha/solicitar')[0]!;
    expect(chamada.method).toBe('POST');
    expect(chamada.body).toEqual({ email: 'ana@exemplo.com' });
    expect(chamada.headers).not.toHaveProperty('Authorization');
  });

  it('não chama a API com e-mail inválido', async () => {
    const api = stubApi({});
    const usuario = userEvent.setup();
    renderizar();

    await usuario.type(screen.getByLabelText('E-mail'), 'ana-sem-arroba');
    await usuario.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Informe um e-mail válido.');
    expect(api.chamadas).toHaveLength(0);
  });

  it('mostra o erro da API quando a solicitação falha', async () => {
    stubApi({
      '/auth/senha/solicitar': { status: 429, body: { erro: 'Muitas tentativas. Aguarde.' } },
    });
    const usuario = userEvent.setup();
    renderizar();

    await usuario.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com');
    await usuario.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas tentativas. Aguarde.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
