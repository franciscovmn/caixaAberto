import { afterEach, describe, expect, it, vi } from 'vitest';

import { dataISOLocal, hojeISO, mesAtual, primeiroDiaDoMesAtual } from '../src/lib/data';

afterEach(() => {
  vi.useRealTimers();
});

// O fuso da aplicacao e America/Fortaleza, UTC-3. Com toISOString() a data virava a do
// dia seguinte a partir das 21h, e os filtros abriam no dia, ou no mes, errado.
describe('datas no fuso da aplicação', () => {
  it('mantém o dia local depois das 21h, quando o UTC já virou', () => {
    const noite = new Date('2026-09-17T22:30:00-03:00');

    expect(noite.toISOString().slice(0, 10)).toBe('2026-09-18');
    expect(dataISOLocal(noite)).toBe('2026-09-17');
  });

  it('mantém o mês local na virada do mês', () => {
    const viradaDoMes = new Date('2026-09-30T21:15:00-03:00');

    expect(viradaDoMes.toISOString().slice(0, 7)).toBe('2026-10');
    expect(dataISOLocal(viradaDoMes).slice(0, 7)).toBe('2026-09');
  });

  it('calcula hoje, mês atual e primeiro dia a partir do mesmo instante', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T23:50:00-03:00'));

    expect(hojeISO()).toBe('2026-09-30');
    expect(mesAtual()).toBe('2026-09');
    expect(primeiroDiaDoMesAtual()).toBe('2026-09-01');
  });

  it('não depende do fuso do navegador', () => {
    const meioDia = new Date('2026-09-17T12:00:00-03:00');

    expect(dataISOLocal(meioDia)).toBe('2026-09-17');
  });
});
