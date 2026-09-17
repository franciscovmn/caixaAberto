import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PublicLinkManagementPage } from '../src/pages/PublicLinkManagementPage';
import { autenticar, stubApi } from './helpers/api';

// A tela abria sem conhecer o link existente, e o unico botao habilitado era o que
// gera outro token, derrubando o endereco ja distribuido.
describe('PublicLinkManagementPage', () => {
  it('mostra o link vigente ao abrir, sem gerar outro', async () => {
    autenticar();
    const api = stubApi({
      '/organizacoes/atual/link-publico': { body: { token: 'token-vigente', ativo: true } },
    });

    render(<PublicLinkManagementPage />);

    const campo = await screen.findByLabelText(/Endereço público/);
    expect(campo).toHaveValue(`${window.location.origin}/transparencia/token-vigente`);

    expect(api.chamadasPara('/organizacoes/atual/link-publico')).toHaveLength(1);
    expect(api.chamadasPara('/organizacoes/atual/link-publico')[0]!.method).toBe('GET');
  });

  it('habilita desativar sem exigir a geração de um link novo', async () => {
    autenticar();
    stubApi({
      '/organizacoes/atual/link-publico': { body: { token: 'token-vigente', ativo: true } },
    });

    render(<PublicLinkManagementPage />);

    await screen.findByLabelText(/Endereço público/);

    expect(screen.getByRole('button', { name: 'Desativar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Ativar' })).toBeDisabled();
  });

  it('trata organização ainda sem link', async () => {
    autenticar();
    stubApi({ '/organizacoes/atual/link-publico': { body: null } });

    render(<PublicLinkManagementPage />);

    expect(await screen.findByRole('button', { name: 'Gerar link público' })).toBeEnabled();
    expect(screen.queryByLabelText(/Endereço público/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desativar' })).toBeDisabled();
  });

  it('gera o link quando ainda não existe e passa a exibi-lo', async () => {
    autenticar();
    const api = stubApi({
      '/organizacoes/atual/link-publico': { body: null },
    });
    const usuario = userEvent.setup();

    render(<PublicLinkManagementPage />);

    await screen.findByRole('button', { name: 'Gerar link público' });

    // A partir daqui a rota passa a responder com o link recem gerado.
    stubApi({
      '/organizacoes/atual/link-publico': { body: { token: 'token-novo', ativo: true } },
    });

    await usuario.click(screen.getByRole('button', { name: 'Gerar link público' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Link público gerado e ativado.');
    expect(screen.getByLabelText(/Endereço público/)).toHaveValue(
      `${window.location.origin}/transparencia/token-novo`,
    );
    expect(api).toBeDefined();
  });

  it('desativa a transparência sem trocar o endereço', async () => {
    autenticar();
    stubApi({
      '/organizacoes/atual/link-publico': { body: { token: 'token-vigente', ativo: true } },
    });
    const usuario = userEvent.setup();

    render(<PublicLinkManagementPage />);

    await screen.findByLabelText(/Endereço público/);

    const api = stubApi({
      '/organizacoes/atual/link-publico': { body: { token: 'token-vigente', ativo: false } },
    });

    await usuario.click(screen.getByRole('button', { name: 'Desativar' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Link público desativado.');
    expect(screen.getByLabelText(/Endereço público/)).toHaveValue(
      `${window.location.origin}/transparencia/token-vigente`,
    );
    expect(api.chamadasPara('/organizacoes/atual/link-publico')[0]!.method).toBe('PATCH');
  });

  it('avisa quando a leitura do link falha', async () => {
    autenticar();
    stubApi({
      '/organizacoes/atual/link-publico': {
        status: 500,
        body: { erro: 'Erro interno do servidor' },
      },
    });

    render(<PublicLinkManagementPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Erro interno do servidor');
  });
});
