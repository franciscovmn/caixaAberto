import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { VisualizadorComprovante } from '../src/components/ui/VisualizadorComprovante';

function Hospedeiro({ tipo = 'image/png', nome = 'recibo.png' }: { tipo?: string; nome?: string }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setAberto(true)}>
        Ampliar
      </button>
      {aberto && (
        <VisualizadorComprovante
          url="blob:teste"
          nome={nome}
          tipo={tipo}
          apoio={`${nome} (412,5 KB)`}
          aoFechar={() => setAberto(false)}
        />
      )}
    </>
  );
}

function visualizador() {
  return screen.getByRole('dialog', { hidden: true });
}

function visualizadorFechado() {
  return screen.queryByRole('dialog', { hidden: true });
}

// A dor era conferir um comprovante pequeno demais na pagina de detalhe. O teste segue o
// caminho do usuario: ampliar, escolher o ajuste, baixar e fechar.
describe('VisualizadorComprovante', () => {
  // Fechado, o visualizador nao fica no documento: o nome do arquivo apareceria duas
  // vezes para o leitor de tela e para a busca da pagina.
  it('só existe quando o comprovante é ampliado', async () => {
    const usuario = userEvent.setup();
    render(<Hospedeiro />);

    expect(visualizadorFechado()).toBeNull();

    await usuario.click(screen.getByRole('button', { name: 'Ampliar' }));

    expect(visualizador()).toHaveAttribute('open');
  });

  it('mostra a imagem e alterna entre ajustar à tela e tamanho real', async () => {
    const usuario = userEvent.setup();
    render(<Hospedeiro />);

    await usuario.click(screen.getByRole('button', { name: 'Ampliar' }));

    const painel = visualizador();
    const corpo = painel.querySelector('.visualizador__corpo');

    expect(within(painel).getByAltText('Comprovante recibo.png')).toBeInTheDocument();
    expect(corpo).toHaveAttribute('data-ajuste', 'tela');
    expect(within(painel).getByRole('button', { name: 'Ajustar à tela' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await usuario.click(within(painel).getByRole('button', { name: 'Tamanho real' }));

    expect(corpo).toHaveAttribute('data-ajuste', 'real');
    expect(within(painel).getByRole('button', { name: 'Tamanho real' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('volta para o ajuste à tela ao reabrir', async () => {
    const usuario = userEvent.setup();
    render(<Hospedeiro />);

    await usuario.click(screen.getByRole('button', { name: 'Ampliar' }));
    await usuario.click(within(visualizador()).getByRole('button', { name: 'Tamanho real' }));
    await usuario.click(within(visualizador()).getByRole('button', { name: 'Fechar' }));
    await usuario.click(screen.getByRole('button', { name: 'Ampliar' }));

    expect(visualizador().querySelector('.visualizador__corpo')).toHaveAttribute(
      'data-ajuste',
      'tela',
    );
  });

  it('oferece o arquivo para baixar com o nome original', async () => {
    const usuario = userEvent.setup();
    render(<Hospedeiro />);

    await usuario.click(screen.getByRole('button', { name: 'Ampliar' }));

    const baixar = within(visualizador()).getByRole('link', { name: 'Baixar comprovante' });

    expect(baixar).toHaveAttribute('download', 'recibo.png');
    expect(baixar).toHaveAttribute('href', 'blob:teste');
  });

  // O visualizador de PDF do navegador ja tem o zoom dele, e dois controles competindo
  // confundiriam quem esta conferindo o comprovante.
  it('não oferece ajuste de tamanho para PDF', async () => {
    const usuario = userEvent.setup();
    render(<Hospedeiro tipo="application/pdf" nome="nota.pdf" />);

    await usuario.click(screen.getByRole('button', { name: 'Ampliar' }));

    const painel = visualizador();

    expect(within(painel).queryByRole('button', { name: 'Tamanho real' })).toBeNull();
    expect(within(painel).queryByRole('button', { name: 'Ajustar à tela' })).toBeNull();
    expect(within(painel).getByRole('link', { name: 'Baixar comprovante' })).toBeInTheDocument();
  });

  it('fecha pelo botão e pelo fundo escuro', async () => {
    const usuario = userEvent.setup();
    render(<Hospedeiro />);

    await usuario.click(screen.getByRole('button', { name: 'Ampliar' }));
    await usuario.click(within(visualizador()).getByRole('button', { name: 'Fechar' }));

    expect(visualizadorFechado()).toBeNull();

    await usuario.click(screen.getByRole('button', { name: 'Ampliar' }));
    await usuario.click(visualizador());

    expect(visualizadorFechado()).toBeNull();
  });
});
