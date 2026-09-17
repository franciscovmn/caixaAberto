import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import { ApiError, apiBlobRequest } from '../lib/httpClient';

const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024;
const INVALID_RECEIPT_MESSAGE = 'Envie uma imagem ou PDF de até 5 MB';
const ALLOWED_RECEIPT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

interface ReceiptPreviewProps {
  file: Blob;
  fileName: string;
  fileType: string;
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

function ReceiptPreview({ file, fileName, fileType }: ReceiptPreviewProps) {
  const objectUrl = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  if (fileType.startsWith('image/')) {
    return (
      <figure className="receipt-preview">
        <img src={objectUrl} alt={`Pré-visualização de ${fileName}`} />
        <figcaption>{fileName}</figcaption>
      </figure>
    );
  }

  return (
    <div className="receipt-preview">
      <object data={objectUrl} type={fileType} aria-label={`Pré-visualização de ${fileName}`}>
        <a href={objectUrl} target="_blank" rel="noreferrer">
          Abrir pré-visualização de {fileName}
        </a>
      </object>
      <small>{fileName}</small>
    </div>
  );
}

export function ReceiptUploadField({
  file,
  error,
  disabled = false,
  onChange,
}: ReceiptUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file && inputRef.current) {
      inputRef.current.value = '';
    }
  }, [file]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;

    if (!selectedFile) {
      onChange(null, null);
      return;
    }

    if (!isReceiptFileValid(selectedFile)) {
      event.target.value = '';
      onChange(null, INVALID_RECEIPT_MESSAGE);
      return;
    }

    onChange(selectedFile, null);
  }

  return (
    <label>
      Comprovante
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        onChange={handleChange}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
      />
      <small>Imagem ou PDF de até 5 MB.</small>
      {error && <small role="alert">{error}</small>}
      {file && (
        <>
          <small>
            Arquivo selecionado: {file.name} ({formatarTamanho(file.size)})
          </small>
          <ReceiptPreview file={file} fileName={file.name} fileType={file.type} />
        </>
      )}
    </label>
  );
}

export function ReceiptDetailPreview({ transactionId, receipt }: ReceiptDetailPreviewProps) {
  const [arquivo, setArquivo] = useState<Blob | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function carregarComprovante() {
      setCarregando(true);
      setErro(null);

      try {
        const blob = await apiBlobRequest(`/lancamentos/${transactionId}/comprovante`);
        if (!cancelado) setArquivo(blob);
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
    };
  }, [transactionId]);

  if (carregando) {
    return <span role="status">Carregando comprovante...</span>;
  }

  if (erro || !arquivo) {
    return <span role="alert">{erro ?? 'Comprovante não encontrado.'}</span>;
  }

  return (
    <div className="receipt-detail">
      <ReceiptPreview file={arquivo} fileName={receipt.fileName} fileType={receipt.fileType} />
      <small>
        {receipt.fileName} ({formatarTamanho(Number(receipt.size))})
      </small>
    </div>
  );
}
