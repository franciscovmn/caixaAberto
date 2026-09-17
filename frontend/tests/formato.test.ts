import { describe, expect, it } from 'vitest';

import { formatarMoeda } from '../src/lib/formato';

// O Intl separa o simbolo do numero com espaco nao separavel (U+00A0), e nao com espaco comum.
// Escrito explicitamente para a comparacao nao falhar por um caractere invisivel.
const ESPACO = ' ';

describe('formatarMoeda', () => {
  it('formata em reais, com separador de milhar e duas casas', () => {
    expect(formatarMoeda('2085.9')).toBe(`R$${ESPACO}2.085,90`);
    expect(formatarMoeda('320')).toBe(`R$${ESPACO}320,00`);
    expect(formatarMoeda('1310.00')).toBe(`R$${ESPACO}1.310,00`);
  });

  it('mantém o sinal de valores negativos, como o saldo de um mês no vermelho', () => {
    expect(formatarMoeda('-594.85')).toBe(`-R$${ESPACO}594,85`);
  });

  it('formata zero', () => {
    expect(formatarMoeda('0')).toBe(`R$${ESPACO}0,00`);
  });

  // A API manda decimal como string para nao perder precisao. Se um dia mandar algo que nao e
  // numero, a tela mostra o que veio em vez de "NaN".
  it('devolve o valor original quando não é um número', () => {
    expect(formatarMoeda('indisponível')).toBe('indisponível');
  });
});
