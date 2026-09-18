import { screen, within } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';

type Usuario = ReturnType<typeof userEvent.setup>;

// Data e competencia deixaram de ser campo digitavel, entao o teste faz o gesto do
// usuario: abre o painel e escolhe. Devolve o valor em YYYY-MM-DD, que e o que sai
// para a API, para que a assercao nao precise repetir a data de hoje.
export async function escolherDia(
  usuario: Usuario,
  rotulo: RegExp | string,
  dia: number,
): Promise<string> {
  const campo = screen.getByLabelText(rotulo);

  await usuario.click(campo);

  const painel = screen.getByRole('dialog');

  await usuario.click(within(painel).getByRole('button', { name: new RegExp(`^${dia} de `) }));

  const [diaEscolhido, mes, ano] = campo.textContent!.trim().split('/');

  return `${ano}-${mes}-${diaEscolhido}`;
}
