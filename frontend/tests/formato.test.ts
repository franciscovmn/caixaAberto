import { describe, expect, it } from 'vitest';

import {
  formatarCompetencia,
  formatarData,
  formatarMesCurto,
  formatarMoeda,
  formatarNomeDoMes,
  rotuloStatus,
  rotuloTipo,
  valorComSinal,
} from '../src/lib/formato';

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

describe('formatarData', () => {
  it('converte data do banco para o formato brasileiro', () => {
    expect(formatarData('2026-09-17')).toBe('17/09/2026');
  });

  // O detalhe devolve data e hora ISO; o recorte evita o fuso puxar o dia para tras.
  it('aceita data com hora e mantém o dia', () => {
    expect(formatarData('2026-09-17T00:00:00.000Z')).toBe('17/09/2026');
  });

  it('devolve o valor original quando não reconhece o formato', () => {
    expect(formatarData('17 de setembro')).toBe('17 de setembro');
  });
});

describe('rótulos de enum', () => {
  it('traduz tipo e status', () => {
    expect(rotuloTipo('ENTRADA')).toBe('Entrada');
    expect(rotuloTipo('SAIDA')).toBe('Saída');
    expect(rotuloStatus('ATIVO')).toBe('Ativo');
    expect(rotuloStatus('ESTORNADO')).toBe('Estornado');
  });
});

describe('valorComSinal', () => {
  it('prefixa entrada com mais e saída com menos', () => {
    expect(valorComSinal('ENTRADA', '1310.00')).toMatch(/^\+R\$\s*1\.310,00$/);
    expect(valorComSinal('SAIDA', '150.00')).toMatch(/^-R\$\s*150,00$/);
  });
});

describe('competência na tela', () => {
  // No campo de filtro a competencia fica numerica, para alinhar com o 01/09/2026
  // dos campos de data. Nos titulos ela aparece por extenso.
  it('mostra a competência curta no formato MM/AAAA', () => {
    expect(formatarMesCurto('2026-09')).toBe('09/2026');
  });

  it('escreve a competência por extenso em pt-BR', () => {
    expect(formatarCompetencia('2026-09')).toBe('setembro de 2026');
    expect(formatarNomeDoMes('2026-08')).toBe('agosto');
  });

  it('devolve o valor original quando a competência não é uma data', () => {
    expect(formatarCompetencia('competencia')).toBe('competencia');
  });
});
