import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SeletorMes } from '../src/components/ui/SeletorMes';

function Hospedeiro({
  inicial = '2026-09',
  aoSelecionar,
}: {
  inicial?: string;
  aoSelecionar?: (mes: string) => void;
}) {
  const [mes, setMes] = useState(inicial);

  return (
    <SeletorMes
      valor={mes}
      aoSelecionar={(novo) => {
        setMes(novo);
        aoSelecionar?.(novo);
      }}
    />
  );
}

function painel() {
  return screen.getByRole('dialog', { name: 'Escolher competência' });
}

// O campo nasceu de um defeito: no Safari o input[type="month"] vira texto livre,
// entao o teste garante que a competencia so sai daqui em YYYY-MM.
describe('SeletorMes', () => {
  it('mostra a competência escolhida no formato curto', () => {
    render(<Hospedeiro />);

    expect(screen.getByLabelText('Mês')).toHaveTextContent('09/2026');
  });

  it('não é um campo de texto, então não aceita digitação', async () => {
    const usuario = userEvent.setup();
    render(<Hospedeiro />);

    const campo = screen.getByLabelText('Mês');

    expect(campo.tagName).toBe('BUTTON');

    await usuario.click(campo);
    await usuario.keyboard('2026-0a');

    expect(screen.getByLabelText('Mês')).toHaveTextContent('09/2026');
  });

  it('abre o painel com os doze meses do ano vigente', async () => {
    const usuario = userEvent.setup();
    render(<Hospedeiro />);

    await usuario.click(screen.getByLabelText('Mês'));

    expect(within(painel()).getByText('2026')).toBeInTheDocument();
    expect(within(painel()).getAllByRole('button', { pressed: false })).toHaveLength(11);
    expect(
      within(painel()).getByRole('button', { name: 'set', pressed: true }),
    ).toBeInTheDocument();
  });

  it('emite YYYY-MM ao escolher um mês e fecha o painel', async () => {
    const usuario = userEvent.setup();
    const aoSelecionar = vi.fn();
    render(<Hospedeiro aoSelecionar={aoSelecionar} />);

    await usuario.click(screen.getByLabelText('Mês'));
    await usuario.click(within(painel()).getByRole('button', { name: 'mar' }));

    expect(aoSelecionar).toHaveBeenCalledWith('2026-03');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Mês')).toHaveTextContent('03/2026');
  });

  it('troca de ano pelas setas sem sair do painel', async () => {
    const usuario = userEvent.setup();
    const aoSelecionar = vi.fn();
    render(<Hospedeiro aoSelecionar={aoSelecionar} />);

    await usuario.click(screen.getByLabelText('Mês'));
    await usuario.click(screen.getByRole('button', { name: 'Ano anterior' }));

    expect(within(painel()).getByText('2025')).toBeInTheDocument();

    await usuario.click(within(painel()).getByRole('button', { name: 'dez' }));

    expect(aoSelecionar).toHaveBeenCalledWith('2025-12');
  });

  it('fecha com Escape e devolve o foco ao campo', async () => {
    const usuario = userEvent.setup();
    render(<Hospedeiro />);

    const campo = screen.getByLabelText('Mês');

    await usuario.click(campo);
    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(campo).toHaveFocus();
  });
});
