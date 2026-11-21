import { supabase } from '../lib/supabase';
import { analyzeTikTok } from '../../supabase/functions/_shared/tiktok';
import type { TikTokInput, TikTokReport } from '../../supabase/functions/_shared/tiktok';

type History = { id: string; handle: string; created_at: string };
const storageKey = (clientId: string) => `creative-hub:tiktok:v1:${clientId}`;
const demoReports = (clientId: string): TikTokReport[] => JSON.parse(localStorage.getItem(storageKey(clientId)) ?? '[]');

async function invoke(body: object) {
  const { data, error } = await supabase.functions.invoke<{ report: TikTokReport }>('tiktok-intelligence', { body });
  if (!error && data?.report) return data.report;
  if (error?.context instanceof Response) {
    const result = await error.context.json().catch(() => null);
    if (typeof result?.error === 'string') throw new Error(result.error);
  }
  throw new Error('Não foi possível concluir a operação. Tente novamente.');
}

export async function listTikTokReports(clientId: string, demo: boolean, signal: AbortSignal): Promise<History[]> {
  if (demo) return demoReports(clientId).map(({ id, input, created_at }) => ({ id, handle: input.handle, created_at }));
  const items: History[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.from('tiktok_reports').select('id,created_at,handle:input->>handle')
      .eq('client_id', clientId).order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(offset, offset + 99).abortSignal(signal);
    if (error) throw new Error('Não foi possível carregar o histórico.');
    items.push(...data as History[]);
    if (data.length < 100) return items;
  }
}

export async function loadTikTokReport(clientId: string, id: string, demo: boolean, signal: AbortSignal): Promise<TikTokReport> {
  if (demo) {
    const saved = demoReports(clientId).find((report) => report.id === id);
    if (saved) return saved;
  } else {
    const { data, error } = await supabase.from('tiktok_reports').select().eq('client_id', clientId).eq('id', id)
      .abortSignal(signal).maybeSingle<TikTokReport>();
    if (!error && data) return data;
  }
  throw new Error('Não foi possível abrir esta análise.');
}

export async function saveTikTokReport(clientId: string, id: string, input: TikTokInput, demo: boolean) {
  if (!demo) return invoke({ action: 'analyze', clientId, id, input });
  const metrics = analyzeTikTok(input);
  if (!metrics.periods[2].count) throw new Error('Inclua pelo menos um post orgânico elegível no período de 90 dias.');
  const history = demoReports(clientId);
  const existing = history.find((item) => item.id === id);
  if (existing) return existing;
  const report = { id, client_id: clientId, input, metrics, advice: null, created_at: new Date().toISOString() };
  localStorage.setItem(storageKey(clientId), JSON.stringify([report, ...history]));
  return report;
}

export function adviseTikTok(report: TikTokReport) {
  return invoke({ action: 'advise', clientId: report.client_id, id: report.id });
}

export async function deleteTikTokReport(clientId: string, id: string, demo: boolean) {
  if (demo) {
    localStorage.setItem(storageKey(clientId), JSON.stringify(demoReports(clientId).filter((report) => report.id !== id)));
    return;
  }
  const { error } = await supabase.from('tiktok_reports').delete().eq('client_id', clientId).eq('id', id);
  if (error) throw new Error('Não foi possível excluir esta análise.');
}
