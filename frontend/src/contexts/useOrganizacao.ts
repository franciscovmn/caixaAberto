import { createContext, useContext } from 'react';

import type { OrganizacaoDoUsuario } from '../lib/organizacoes';

export interface OrganizationContextValue {
  organizacoes: OrganizacaoDoUsuario[];
  organizacaoSelecionada: OrganizacaoDoUsuario | null;
  organizacaoId: string | null;
  carregando: boolean;
  erro: string | null;
  selecionarOrganizacao: (organizacaoId: string) => void;
  atualizarOrganizacoes: (organizacaoPreferidaId?: string) => Promise<void>;
}

// O contexto e os hooks ficam fora do arquivo do provider: um modulo .tsx que exporta algo alem de
// componentes perde o recarregamento rapido do Vite.
export const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export function useOrganizationContext(): OrganizationContextValue {
  const context = useContext(OrganizationContext);

  if (!context) {
    throw new Error('useOrganizationContext deve ser usado dentro de OrganizationProvider');
  }

  return context;
}

// Para quem so mostra o nome da organizacao e tambem e testado fora do shell protegido, como o
// extrato impresso: sem o provider, devolve null em vez de lancar.
export function useOrganizacaoAtual(): OrganizacaoDoUsuario | null {
  return useContext(OrganizationContext)?.organizacaoSelecionada ?? null;
}
