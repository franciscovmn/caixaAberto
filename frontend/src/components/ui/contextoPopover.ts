import { createContext, useContext } from 'react';

export const ContextoPopover = createContext<() => void>(() => {});

// O conteudo do painel fecha o campo por aqui, em vez de receber a funcao por
// propriedade: assim o painel continua sendo um filho comum e nada e chamado
// durante a renderizacao do campo.
export function useFecharPopover() {
  return useContext(ContextoPopover);
}
