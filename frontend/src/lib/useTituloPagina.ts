import { useEffect } from 'react';

// Cada rota assume o titulo da aba; sem isso toda tela do SPA fica "Caixa Aberto".
export function useTituloPagina(titulo: string): void {
  useEffect(() => {
    document.title = `${titulo} · Caixa Aberto`;

    return () => {
      document.title = 'Caixa Aberto';
    };
  }, [titulo]);
}
