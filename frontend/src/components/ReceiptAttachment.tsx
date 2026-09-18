import { useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import { ApiError, apiBlobRequest } from '../lib/httpClient';
import { VisualizadorComprovante } from './ui/VisualizadorComprovante';

const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024;
const INVALID_RECEIPT_MESSAGE = 'Envie uma imagem ou PDF de até 5 MB';
const ALLOWED_RECEIPT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

interface ReceiptPreviewProps {
  url: string;
  fileName: string;
  fileType: string;
  apoio: string;
  legenda?: boolean;
}

interface ReceiptUploadFieldProps {
  file: File | null;
  error: string | null;
  disabled?: boolean;
  onChange: (file: File | null, error: string | null) => void;
}

interface ReceiptDetail {
  fileName: string;
  fileType: string;
  size: string;
}

interface ReceiptDetailPreviewProps {
  transactionId: string;
  receipt: ReceiptDetail;
}

function isReceiptFileValid(file: File): boolean {
  return ALLOWED_RECEIPT_TYPES.has(file.type) && file.size <= MAX_RECEIPT_SIZE_BYTES;
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB`;
  }

  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
  })} MB`;
}

// A URL do arquivo chega pronta de quem tem o blob: criar aqui, e revogar na limpeza do
// efeito, derrubava a propria URL que a tela estava usando, e a imagem dentro do
// visualizador nascia quebrada enquanto a miniatura ja carregada continuava na tela.
function ReceiptPreview({ url, fileName, fileType, apoio, legenda = false }: ReceiptPreviewProps) {
  const [ampliado, setAmpliado] = useState(false);
  const ehImagem = fileType.startsWith('image/');

  return (
    <div className="receipt-detail">
      {ehImagem ? (
        <figure className="receipt-preview">
          {/* A miniatura tambem abre o visualizador: e o gesto que se espera de uma
              imagem pequena, antes de procurar o botao. */}
          <button
            type="button"
            className="receipt-preview__gatilho"
            onClick={() => setAmpliado(true)}
          >
            <img src={url} alt={`Pré-visualização de ${fileName}`} />
          </button>
        </figure>
      ) : (
        <div className="receipt-preview">
          <object data={url} type={fileType} aria-label={`Pré-visualização de ${fileName}`}>
            <a href={url} target="_blank" rel="noreferrer">
              Abrir pré-visualização de {fileName}
            </a>
          </object>
        </div>
      )}

      <div className="receipt-preview__acoes">
        <button
          type="button"
          className="receipt-preview__ampliar"
          onClick={() => setAmpliado(true)}
        >
          <IconeLupa />
          Ampliar
        </button>
        {legenda && <small>{apoio}</small>}
      </div>

      {ampliado && (
        <VisualizadorComprovante
          url={url}
          nome={fileName}
          tipo={fileType}
          apoio={apoio}
          aoFechar={() => setAmpliado(false)}
        />
      )}
    </div>
  );
}

function IconeLupa() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 14 14M7 5v4M5 7h4" />
    </svg>
  );
}

export function ReceiptUploadField({
  file,
  error,
  disabled = false,
  onChange,
}: ReceiptUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const campoId = useId();
  const rotuloId = useId();
  const [urlPrevia, setUrlPrevia] = useState('');

  // A URL nasce e morre no proprio evento de escolha do arquivo, que e quando se sabe
  // que o anterior nao serve mais. Fazer isso num efeito revogaria a URL em uso.
  function trocarPrevia(escolhido: File | null) {
    setUrlPrevia((atual) => {
      if (atual) URL.revokeObjectURL(atual);

      return escolhido ? URL.createObjectURL(escolhido) : '';
    });
  }

  useEffect(() => {
    if (!file && inputRef.current) {
      inputRef.current.value = '';
    }
  }, [file]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;

    if (!selectedFile) {
      trocarPrevia(null);
      onChange(null, null);
      return;
    }

    if (!isReceiptFileValid(selectedFile)) {
      event.target.value = '';
      trocarPrevia(null);
      onChange(null, INVALID_RECEIPT_MESSAGE);
      return;
    }

    trocarPrevia(selectedFile);
    onChange(selectedFile, null);
  }

  // O controle nativo de arquivo e desenhado por cada navegador, com botao, texto e
  // altura proprios. O input continua sendo o campo, so que fora da vista, e quem
  // aparece e um botao do proprio sistema visual, igual em qualquer navegador.
  return (
    <div className="campo-arquivo" data-desabilitado={disabled || undefined}>
      <span className="campo-arquivo__rotulo" id={rotuloId}>
        Comprovante
      </span>

      <input
        ref={inputRef}
        id={campoId}
        className="apenas-leitor"
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        onChange={handleChange}
        disabled={disabled}
        aria-labelledby={rotuloId}
        aria-invalid={error ? true : undefined}
      />

      <div className="campo-arquivo__controle">
        <label className="campo-arquivo__botao" htmlFor={campoId}>
          Escolher arquivo
        </label>
        <span className="campo-arquivo__nome" data-vazio={!file || undefined}>
          {file ? `${file.name} (${formatarTamanho(file.size)})` : 'Nenhum arquivo escolhido'}
        </span>
      </div>

      <small>Imagem ou PDF de até 5 MB.</small>
      {error && <small role="alert">{error}</small>}
      {file && urlPrevia && (
        <ReceiptPreview
          url={urlPrevia}
          fileName={file.name}
          fileType={file.type}
          apoio={`${file.name} (${formatarTamanho(file.size)})`}
        />
      )}
    </div>
  );
}

export function ReceiptDetailPreview({ transactionId, receipt }: ReceiptDetailPreviewProps) {
  const [urlArquivo, setUrlArquivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    let urlCriada = '';

    async function carregarComprovante() {
      setCarregando(true);
      setErro(null);

      try {
        const blob = await apiBlobRequest(`/lancamentos/${transactionId}/comprovante`);

        if (!cancelado) {
          // A URL e criada depois que o arquivo chega, e so esta execucao do efeito a
          // revoga: assim a limpeza nunca derruba a URL que a tela esta exibindo.
          urlCriada = URL.createObjectURL(blob);
          setUrlArquivo(urlCriada);
        }
      } catch (error) {
        if (!cancelado) {
          setErro(
            error instanceof ApiError ? error.message : 'Não foi possível carregar o comprovante',
          );
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    void carregarComprovante();

    return () => {
      cancelado = true;
      if (urlCriada) URL.revokeObjectURL(urlCriada);
    };
  }, [transactionId]);

  if (carregando) {
    return <span role="status">Carregando comprovante...</span>;
  }

  if (erro || !urlArquivo) {
    return <span role="alert">{erro ?? 'Comprovante não encontrado.'}</span>;
  }

  return (
    <ReceiptPreview
      url={urlArquivo}
      fileName={receipt.fileName}
      fileType={receipt.fileType}
      apoio={`${receipt.fileName} (${formatarTamanho(Number(receipt.size))})`}
      legenda
    />
  );
}
