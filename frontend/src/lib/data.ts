// O fuso da aplicacao e America/Fortaleza, e as datas dos lancamentos sao comparadas
// nele. Calcular o "hoje" com toISOString() usa UTC: a partir das 21h em Fortaleza a
// data UTC ja e a do dia seguinte, e os filtros abriam num dia, ou num mes, errado.
const FUSO_APLICACAO = 'America/Fortaleza';

const formatador = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_APLICACAO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Devolve YYYY-MM-DD no fuso da aplicacao, e nao no do navegador nem em UTC.
export function dataISOLocal(referencia: Date = new Date()): string {
  const partes = formatador.formatToParts(referencia);
  const buscar = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? '';

  return `${buscar('year')}-${buscar('month')}-${buscar('day')}`;
}

export function hojeISO(): string {
  return dataISOLocal();
}

export function mesAtual(): string {
  return dataISOLocal().slice(0, 7);
}

export function primeiroDiaDoMesAtual(): string {
  return `${mesAtual()}-01`;
}

const PADRAO_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

// A competencia chega da URL da pagina publica, que qualquer visitante pode editar,
// entao o formato e conferido antes de virar consulta na API.
export function mesEhValido(valor: string | null): valor is string {
  return typeof valor === 'string' && PADRAO_MES.test(valor);
}

export function anoDoMes(mes: string): number {
  const ano = Number(mes.split('-')[0]);

  return Number.isFinite(ano) && ano > 0 ? ano : Number(mesAtual().split('-')[0]);
}

export function montarMes(ano: number, mes: number): string {
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}`;
}
