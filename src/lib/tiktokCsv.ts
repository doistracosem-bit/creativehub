import { MAX_TIKTOK_POSTS } from '../../supabase/functions/_shared/tiktok.ts';
import type { TikTokPost } from '../../supabase/functions/_shared/tiktok';
import { rowsFromCsv } from './trafficCsv.ts';

const headers = {
  published: ['publicado em', 'data e hora', 'published at', 'publish time'],
  format: ['formato', 'format'],
  views: ['visualizacoes', 'views', 'video views'],
  likes: ['curtidas', 'likes'],
  comments: ['comentarios', 'comments'],
  shares: ['compartilhamentos', 'shares'],
  saves: ['salvamentos', 'saves', 'favorites'],
  boosted: ['impulsionado', 'boosted'],
  url: ['link', 'url'],
};
const normalize = (text: string) => text.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const TIKTOK_TEMPLATE = Object.values(headers).map((aliases) => aliases[0]).join(';') + '\r\n';
export const TIKTOK_CSV_LIMIT = 180_000;

export function parseTikTokCsv(input: string): TikTokPost[] {
  if (new TextEncoder().encode(input).length > TIKTOK_CSV_LIMIT) throw new Error('O CSV excede 180 KB.');
  const text = input.replace(/^\uFEFF/, '');
  for (const delimiter of [';', ',', '\t']) {
    let rows: string[][];
    try {
      rows = rowsFromCsv(text, delimiter);
    } catch {
      continue;
    }
    const [head, ...records] = rows;
    if (!head) break;
    const positions = new Map(Object.entries(headers).map(([field, aliases]) => [
      field, head.flatMap((label, index) => aliases.includes(normalize(label)) ? [index] : []),
    ]));
    if (['published', 'format', 'views', 'boosted'].some((field) => !positions.get(field)?.length)) continue;
    if ([...positions.values()].some((indexes) => indexes.length > 1)) throw new Error('Remova as colunas duplicadas do CSV.');
    if (!records.length || records.length > MAX_TIKTOK_POSTS) throw new Error(`Inclua de 1 a ${MAX_TIKTOK_POSTS} publicações.`);
    return records.map((row, index) => {
      try {
        if (row.length !== head.length) throw new Error('O número de campos difere do cabeçalho.');
        const value = (field: string) => row[positions.get(field)?.[0] ?? -1] ?? '';
        const number = (field: string, required = false) => {
          const raw = value(field);
          if (!required && !raw) return null;
          if (!/^\d+$/.test(raw)) throw new Error(`Informe um número inteiro em ${headers[field as keyof typeof headers][0]}.`);
          return Number(raw);
        };
        const boosted = normalize(value('boosted'));
        if (!['sim', 'nao', 'yes', 'no', 'true', 'false', '1', '0'].includes(boosted)) {
          throw new Error('Preencha impulsionado com sim ou não.');
        }
        const date = value('published');
        const brazilian = date.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2})(?::\d{2})?$/);
        const published = brazilian ? `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}T${brazilian[4]}`
          : date.replace(' ', 'T').replace(/^(.*T\d{2}:\d{2}):\d{2}$/, '$1');
        return {
          published, format: value('format'), views: number('views', true)!, likes: number('likes'),
          comments: number('comments'), shares: number('shares'), saves: number('saves'),
          boosted: ['sim', 'yes', 'true', '1'].includes(boosted), url: value('url') || null,
        };
      } catch (error) {
        throw new Error(`Registro ${index + 1} do CSV. ${(error as Error).message}`);
      }
    });
  }
  throw new Error('Use o modelo CSV com as colunas publicado em, formato, visualizações e impulsionado.');
}
