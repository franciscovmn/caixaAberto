import { useEffect, useMemo, useState } from 'react';

import { ApiError, apiRequest } from '../lib/httpClient';
import { useTituloPagina } from '../lib/useTituloPagina';

interface PublicLinkResponse {
  token: string;
  ativo: boolean;
}

function montarUrlPublica(token: string): string {
  return `${window.location.origin}/transparencia/${token}`;
}

export function PublicLinkManagementPage() {
  useTituloPagina('Link público');

  const [link, setLink] = useState<PublicLinkResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [copiando, setCopiando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const urlPublica = useMemo(() => (link ? montarUrlPublica(link.token) : ''), [link]);

  // Sem esta leitura a tela abria sem saber do link existente, e o unico botao
  // disponivel era o que gera outro token, derrubando o endereco ja distribuido.
  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        const atual = await apiRequest<PublicLinkResponse | null>(
          '/organizacoes/atual/link-publico',
        );
        if (!cancelado) setLink(atual?.token ? atual : null);
      } catch (error) {
        if (!cancelado) {
          setErro(
            error instanceof ApiError
              ? error.message
              : 'Não foi possível carregar o link público atual',
          );
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    void carregar();

    return () => {
      cancelado = true;
    };
  }, []);

  async function gerarLink() {
    setProcessando(true);
    setErro(null);
    setMensagem(null);

    try {
      const resposta = await apiRequest<PublicLinkResponse>('/organizacoes/atual/link-publico', {
        method: 'POST',
      });
      setLink(resposta);
      setMensagem('Link público gerado e ativado.');
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : 'Não foi possível gerar o link público');
    } finally {
      setProcessando(false);
    }
  }

  async function alterarEstado(ativo: boolean) {
    setProcessando(true);
    setErro(null);
    setMensagem(null);

    try {
      const resposta = await apiRequest<PublicLinkResponse>('/organizacoes/atual/link-publico', {
        method: 'PATCH',
        body: { ativo },
      });
      setLink(resposta);
      setMensagem(ativo ? 'Link público ativado.' : 'Link público desativado.');
    } catch (error) {
      setErro(
        error instanceof ApiError ? error.message : 'Não foi possível alterar o link público',
      );
    } finally {
      setProcessando(false);
    }
  }

  async function copiarLink() {
    if (!urlPublica) {
      return;
    }

    setCopiando(true);
    setErro(null);
    setMensagem(null);

    try {
      await navigator.clipboard.writeText(urlPublica);
      setMensagem('Link público copiado.');
    } catch {
      setErro('Não foi possível copiar o link público.');
    } finally {
      setCopiando(false);
    }
  }

  return (
    <main>
      <div className="cabecalho-pagina">
        <div>
          <h1>Link público</h1>
          <p className="cabecalho-pagina__apoio">
            O endereço que qualquer pessoa pode abrir para acompanhar a prestação de contas, sem
            login e sem dados pessoais.
          </p>
        </div>
      </div>

      <section className="public-link-panel">
        <p>
          Situação:{' '}
          <span className="etiqueta">
            {carregando ? 'Carregando' : link ? (link.ativo ? 'Ativo' : 'Inativo') : 'Não gerado'}
          </span>
        </p>

        {link && (
          <label>
            Endereço público
            <input type="text" value={urlPublica} readOnly />
            <small>
              Gerar um novo link troca este endereço, e quem já recebeu o anterior deixa de
              conseguir abrir a prestação de contas.
            </small>
          </label>
        )}

        <div className="public-link-actions">
          <button type="button" onClick={gerarLink} disabled={processando || carregando}>
            {link ? 'Gerar novo link' : 'Gerar link público'}
          </button>

          <button
            type="button"
            data-variante="secundario"
            onClick={copiarLink}
            disabled={!link || copiando || carregando}
          >
            {copiando ? 'Copiando...' : 'Copiar'}
          </button>

          <button
            type="button"
            data-variante="secundario"
            onClick={() => alterarEstado(true)}
            disabled={!link || link.ativo || processando || carregando}
          >
            Ativar
          </button>

          <button
            type="button"
            data-variante="secundario"
            onClick={() => alterarEstado(false)}
            disabled={!link || !link.ativo || processando || carregando}
          >
            Desativar
          </button>
        </div>
      </section>

      {mensagem && <p role="status">{mensagem}</p>}
      {erro && <p role="alert">{erro}</p>}
    </main>
  );
}
