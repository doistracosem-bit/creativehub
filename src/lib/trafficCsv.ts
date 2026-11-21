import { MAX_CREATIVES, MAX_CSV_BYTES, VALUES } from '../../supabase/functions/_shared/traffic.ts';
import type { Creative } from '../../supabase/functions/_shared/traffic';

const columns = {
  name: ['criativo', 'nome do anuncio', 'ad name', 'name'],
  group: ['conjunto', 'nome do conjunto de anuncios', 'ad set name'],
  format: ['formato', 'format'],
  angle: ['angulo', 'angle'],
  spend: ['gasto', 'valor gasto', 'valor gasto (brl)', 'amount spent', 'amount spent (brl)', 'spend'],
  impressions: ['impressoes', 'impressions'],
  clicks: ['cliques', 'cliques no link', 'link clicks', 'clicks'],
  entries: ['entradas', 'conversas', 'conversas por mensagem iniciadas', 'leads', 'adicoes ao carrinho', 'entries'],
  qualified: ['qualificados', 'leads qualificados', 'checkouts iniciados', 'qualified'],
  open: ['em aberto', 'negociacoes abertas', 'checkouts em aberto', 'open'],
  sales: ['vendas', 'compras', 'purchases', 'sales'],
  revenue: ['receita', 'receita atribuida', 'valor de conversao de compras', 'purchase conversion value', 'revenue'],
} as const;

export const CSV_TEMPLATE = 'criativo;gasto;vendas;impressoes;cliques;entradas;qualificados;em aberto;receita;conjunto;formato;angulo';

const normalize = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function rowsFromCsv(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let closed = false;
  const finishCell = () => {
    row.push(cell.trim());
    cell = '';
    closed = false;
  };
  for (let position = 0; position < text.length; position += 1) {
    const char = text[position];
    if (quoted) {
      if (char === '"' && text[position + 1] === '"') {
        cell += '"';
        position += 1;
      } else if (char === '"') {
        quoted = false;
        closed = true;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === delimiter) {
      finishCell();
    } else if (char === '\n' || char === '\r') {
      finishCell();
      if (row.some(Boolean)) rows.push(row);
      row = [];
      if (char === '\r' && text[position + 1] === '\n') position += 1;
    } else if (char === '"' && !cell && !closed) {
      quoted = true;
    } else if (closed || char === '"') {
      if (char !== ' ' || !closed) throw new Error('Aspas inválidas no CSV.');
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error('Há um campo entre aspas sem fechamento no CSV.');
  finishCell();
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function csvNumber(text: string) {
  const value = text.replace(/^R\$\s*/i, '').trim();
  if (!value || value === '—' || value === '-') return null;
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (/^\d+(?:,\d+)?$/.test(value) || /^\d{1,3}(?:\.\d{3})+,\d+$/.test(value)) {
    return Number(value.replaceAll('.', '').replace(',', '.'));
  }
  throw new Error('Número inválido. Use ponto ou vírgula decimal e retire separadores de milhar.');
}

export function parseTrafficCsv(input: string): Creative[] {
  if (new TextEncoder().encode(input).byteLength > MAX_CSV_BYTES) throw new Error('O CSV excede 96 KB.');
  const text = input.replace(/^\uFEFF/, '');
  const required = ['name', 'spend', 'sales'] as const;
  for (const delimiter of [';', ',', '\t']) {
    let rows;
    try {
      rows = rowsFromCsv(text, delimiter);
    } catch {
      continue;
    }
    const [header, ...items] = rows;
    if (!header) break;
    const positions = Object.fromEntries(Object.entries(columns).map(([key, aliases]) => {
      const matches = header.map((cell, index) => ({ cell, index })).filter(({ cell }) => (aliases as readonly string[]).includes(normalize(cell)));
      return [key, matches.length > 1 ? -2 : matches[0]?.index ?? -1];
    }));
    if (required.some((key) => positions[key] === -1)) continue;
    if (Object.values(positions).includes(-2)) throw new Error('O CSV contém duas colunas equivalentes. Mantenha apenas uma de cada métrica.');
    if (!items.length || items.length > MAX_CREATIVES) throw new Error(`Inclua de 1 a ${MAX_CREATIVES} criativos no CSV.`);
    return items.map((row, index) => {
      const value = (key: string) => row[positions[key]] ?? '';
      try {
        if (row.length !== header.length) throw new Error('O número de colunas difere do cabeçalho.');
        const fields = Object.fromEntries(VALUES.map((key) => [key, csvNumber(value(key))]));
        if (!value('name') || fields.spend === null || fields.sales === null) throw new Error('Preencha criativo, gasto e vendas.');
        return { ...fields, name: value('name'), group: value('group'), format: value('format'), angle: value('angle') } as Creative;
      } catch (error) {
        throw new Error(`Registro ${index + 1} do CSV. ${(error as Error).message}`);
      }
    });
  }
  throw new Error('CSV ilegível. Use o modelo com as colunas criativo, gasto e vendas.');
}
