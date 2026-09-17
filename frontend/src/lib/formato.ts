// Valores monetarios chegam da API como string decimal, para nao perder precisao.
// A formatacao acontece so na exibicao, em pt-BR.
export function formatarMoeda(valor: string): string {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return valor;
  }

  return numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// A API devolve tanto data pura (YYYY-MM-DD) quanto data e hora ISO, dependendo da rota.
// O recorte dos dez primeiros caracteres evita que o fuso do navegador puxe o dia para tras.
export function formatarData(valor: string): string {
  const somenteData = valor.slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(somenteData)) {
    return valor;
  }

  const [ano, mes, dia] = somenteData.split('-');

  return `${dia}/${mes}/${ano}`;
}

// Enums do banco nao sobem para a tela: viram rotulo em pt-BR na borda de exibicao.
export function rotuloTipo(tipo: 'ENTRADA' | 'SAIDA'): string {
  return tipo === 'ENTRADA' ? 'Entrada' : 'Saída';
}

export function rotuloStatus(status: 'ATIVO' | 'ESTORNADO'): string {
  return status === 'ATIVO' ? 'Ativo' : 'Estornado';
}

// Nas tabelas o tipo deixa de ser coluna de texto e passa a ser o sinal do valor.
export function valorComSinal(tipo: 'ENTRADA' | 'SAIDA', valor: string): string {
  return `${tipo === 'ENTRADA' ? '+' : '-'}${formatarMoeda(valor)}`;
}
