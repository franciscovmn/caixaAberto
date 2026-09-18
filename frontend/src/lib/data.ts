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

const PADRAO_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function dataEhValida(valor: string | null): valor is string {
  if (typeof valor !== 'string' || !PADRAO_DATA.test(valor)) return false;

  const { ano, mes, dia } = partesData(valor);
  const data = new Date(ano, mes - 1, dia);

  // 31/02 passa no formato mas nao existe: o Date normaliza para marco e a
  // comparacao devolve o dia trocado.
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
}

export function partesData(valor: string): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = valor.split('-').map(Number);

  return { ano: ano ?? 0, mes: mes ?? 0, dia: dia ?? 0 };
}

export function montarData(ano: number, mes: number, dia: number): string {
  return `${montarMes(ano, mes)}-${String(dia).padStart(2, '0')}`;
}

// Toda a aritmetica de calendario passa por aqui, com Date local e nunca toISOString,
// que puxaria o dia para tras no fuso da aplicacao.
export function deslocarDias(valor: string, passo: number): string {
  const { ano, mes, dia } = partesData(valor);
  const data = new Date(ano, mes - 1, dia + passo);

  return montarData(data.getFullYear(), data.getMonth() + 1, data.getDate());
}

export function deslocarMeses(valor: string, passo: number): string {
  const { ano, mes } = partesMes(valor);
  const data = new Date(ano, mes - 1 + passo, 1);

  return montarMes(data.getFullYear(), data.getMonth() + 1);
}

export function partesMes(valor: string): { ano: number; mes: number } {
  const [ano, mes] = valor.split('-').map(Number);

  return { ano: ano ?? 0, mes: mes ?? 0 };
}

export function diasDoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

// Domingo e 0, como na primeira coluna do calendario.
export function diaDaSemanaInicial(ano: number, mes: number): number {
  return new Date(ano, mes - 1, 1).getDay();
}
