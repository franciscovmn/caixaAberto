export function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

// Rejeita datas que casam com o formato mas nao existem, como 2026-09-31, que o Date
// normalizaria silenciosamente para o mes seguinte.
export function isExistingCivilDate(value: string): boolean {
  const date = toUtcDate(value);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function formatCivilDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// A aplicacao opera no fuso de Fortaleza, mas o servidor pode rodar em UTC, e entre 21h e
// meia-noite o dia pelo relogio UTC ja e o seguinte. Por isso o dia sai do fuso explicito.
const civilDateInApplicationTimeZone = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Fortaleza',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayCivilDate(now: Date = new Date()): Date {
  const parts = Object.fromEntries(
    civilDateInApplicationTimeZone.formatToParts(now).map((part) => [part.type, part.value]),
  );

  return toUtcDate(`${parts.year}-${parts.month}-${parts.day}`);
}
