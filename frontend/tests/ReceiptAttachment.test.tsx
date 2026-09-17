import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReceiptDetailPreview, ReceiptUploadField } from '../src/components/ReceiptAttachment';
import { autenticar, stubApi } from './helpers/api';

const UM_MB = 1024 * 1024;

function arquivoDe(nome: string, tipo: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], nome, { type: tipo });
}

// Envolve o campo no estado que o formulario mantem, para o teste exercitar o mesmo fluxo de
// selecao e limpeza que o TransactionForm usa.
function CampoControlado({ aoMudar }: { aoMudar?: (arquivo: File | null) => void }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  return (
    <ReceiptUploadField
      file={arquivo}
      error={erro}
      onChange={(novoArquivo, novoErro) => {
        setArquivo(novoArquivo);
        setErro(novoErro);
        aoMudar?.(novoArquivo);
      }}
    />
  );
}

describe('ReceiptUploadField', () => {
  it('aceita PDF e imagem dentro do limite', async () => {
    const usuario = userEvent.setup();
    const aoMudar = vi.fn();
    render(<CampoControlado aoMudar={aoMudar} />);

    await usuario.upload(
      screen.getByLabelText(/Comprovante/),
      arquivoDe('nota.pdf', 'application/pdf', 1024),
    );

    expect(aoMudar).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'nota.pdf' }));
    expect(screen.getByText(/Arquivo selecionado: nota\.pdf/)).toBeInTheDocument();
  });

  // Via fireEvent, e nao userEvent: o upload do userEvent respeita o atributo accept e nem entrega
  // o arquivo. O accept so filtra o seletor do sistema, entao a guarda que importa e a do
  // componente, alcancada por quem arrasta e solta ou escolhe "todos os arquivos".
  it('recusa um tipo fora da lista permitida', async () => {
    const aoMudar = vi.fn();
    render(<CampoControlado aoMudar={aoMudar} />);

    fireEvent.change(screen.getByLabelText(/Comprovante/), {
      target: { files: [arquivoDe('planilha.csv', 'text/csv', 1024)] },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Envie uma imagem ou PDF de até 5 MB',
    );
    expect(aoMudar).toHaveBeenLastCalledWith(null);
  });

  // O backend recusa acima de 5 MB. Barrar aqui evita subir o arquivo inteiro para receber um 400.
  it('recusa arquivo acima de 5 MB', async () => {
    const usuario = userEvent.setup();
    const aoMudar = vi.fn();
    render(<CampoControlado aoMudar={aoMudar} />);

    await usuario.upload(
      screen.getByLabelText(/Comprovante/),
      arquivoDe('grande.png', 'image/png', 6 * UM_MB),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Envie uma imagem ou PDF de até 5 MB',
    );
    expect(aoMudar).toHaveBeenLastCalledWith(null);
  });

  it('aceita exatamente 5 MB, o limite documentado', async () => {
    const usuario = userEvent.setup();
    const aoMudar = vi.fn();
    render(<CampoControlado aoMudar={aoMudar} />);

    await usuario.upload(
      screen.getByLabelText(/Comprovante/),
      arquivoDe('limite.png', 'image/png', 5 * UM_MB),
    );

    expect(aoMudar).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'limite.png' }));
  });
});

describe('ReceiptDetailPreview', () => {
  beforeEach(() => {
    autenticar();
  });

  const comprovante = { fileName: 'nota.png', fileType: 'image/png', size: '2048' };

  it('busca o arquivo no endpoint autenticado do lançamento', async () => {
    const api = stubApi({ '/comprovante': { body: {} } });
    render(<ReceiptDetailPreview transactionId="7" receipt={comprovante} />);

    await screen.findByRole('img', { name: /Pré-visualização de nota\.png/ });

    expect(api.chamadasPara('/lancamentos/7/comprovante')).toHaveLength(1);
  });

  it('avisa quando o comprovante não pode ser carregado', async () => {
    stubApi({ '/comprovante': { status: 404, body: { erro: 'Comprovante não encontrado' } } });
    render(<ReceiptDetailPreview transactionId="7" receipt={comprovante} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Comprovante não encontrado');
  });
});
