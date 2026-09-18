import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// jsdom nao implementa a URL de objeto que a pre-visualizacao do comprovante usa. Sem isso o
// componente quebra na montagem e o teste falharia por limitacao do ambiente, nao por defeito.
URL.createObjectURL = () => 'blob:teste';
URL.revokeObjectURL = () => {};

// O jsdom 30 ainda nao implementa showModal e close do dialog, que o visualizador de
// comprovante usa justamente para nao reimplementar foco preso e Escape na mao. O stub
// liga e desliga o atributo open e emite o evento close, que e o que o componente observa.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function abrir(this: HTMLDialogElement) {
    this.open = true;
  };

  HTMLDialogElement.prototype.close = function fechar(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}

// Cada teste comeca sem sessao e sem resposta de API herdada do anterior. A limpeza fica aqui, e
// nao em cada arquivo, para que um teste novo nao passe por engano reaproveitando estado.
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});
