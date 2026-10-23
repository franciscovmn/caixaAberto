import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { useOrganizationContext } from '../contexts/useOrganizacao';
import { ApiError, apiRequest } from '../lib/httpClient';

interface ExclusaoOrganizacaoProps {
  id: string;
  nome: string;
}

// A exclusao nao tem volta pela tela e tira o acesso de todos os membros, entao o botao so libera
// depois que o nome da organizacao e digitado, como prova de que a pessoa sabe qual esta excluindo.
export function ExclusaoOrganizacao({ id, nome }: ExclusaoOrganizacaoProps) {
  const tituloId = useId();
  const navigate = useNavigate();
  const { atualizarOrganizacoes } = useOrganizationContext();
  const [confirmacao, setConfirmacao] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const confere = confirmacao.trim() === nome.trim();

  async function excluir(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confere) return;

    setExcluindo(true);
    setErro(null);

    try {
      await apiRequest<void>(`/organizacoes/${id}`, { method: 'DELETE' });
      // A lista relida ja nao traz a excluida. Sem nenhuma, a area protegida leva ao cadastro.
      await atualizarOrganizacoes();
      navigate('/lancamentos', { replace: true });
    } catch (error) {
      setErro(
        error instanceof ApiError ? error.message : 'Não foi possível excluir a organização.',
      );
      setExcluindo(false);
    }
  }

  return (
    <section className="zona-exclusao" aria-labelledby={tituloId}>
      <h2 id={tituloId}>Excluir organização</h2>
      <p>
        Os membros perdem o acesso e o link público sai do ar. Lançamentos, categorias e
        comprovantes continuam guardados como trilha de auditoria, mas a organização não volta pela
        tela.
      </p>

      <form onSubmit={excluir} noValidate className="formulario-coluna">
        <label>
          <span>
            Digite <strong>{nome}</strong> para confirmar
          </span>
          <input
            type="text"
            value={confirmacao}
            onChange={(event) => setConfirmacao(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            disabled={excluindo}
          />
        </label>

        {erro && <p role="alert">{erro}</p>}

        <button type="submit" data-variante="perigo" disabled={!confere || excluindo}>
          {excluindo ? 'Excluindo...' : 'Excluir organização'}
        </button>
      </form>
    </section>
  );
}
