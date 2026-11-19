import { supabase } from '../lib/supabase';
import { diagnose, parsePlan, parseSnapshot, validateRevision } from '../../supabase/functions/_shared/traffic';
import type { CampaignRow, ReportRow, Snapshot } from '../../supabase/functions/_shared/traffic';

type Workspace = { campaigns: CampaignRow[]; reports: ReportRow[] };
const demoKey = (id: string) => `creative-hub:traffic:v1:${id}`;

function demoWorkspace(clientId: string): Workspace {
  const stored = window.localStorage.getItem(demoKey(clientId));
  return stored ? JSON.parse(stored) : { campaigns: [], reports: [] };
}

async function invoke<T>(body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('traffic-intelligence', { body });
  if (!error && data) return data;
  if (error?.context instanceof Response) {
    const payload = await error.context.json().catch(() => null);
    if (typeof payload?.error === 'string') throw new Error(payload.error);
  }
  throw new Error('Não foi possível acessar o Traffic Intelligence. Tente novamente.');
}

async function listClientRows<T>(table: string, clientId: string, signal: AbortSignal) {
  const results: T[] = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from(table).select('*').eq('client_id', clientId)
      .order('created_at', { ascending: false }).order('id').range(offset, offset + pageSize - 1).abortSignal(signal);
    if (error) throw new Error('Não foi possível carregar o histórico deste cliente.');
    results.push(...data as T[]);
    if (data.length < pageSize) return results;
  }
}

export async function loadTraffic(clientId: string, demo: boolean, signal: AbortSignal): Promise<Workspace> {
  if (demo) return demoWorkspace(clientId);
  const [campaigns, reports] = await Promise.all([
    listClientRows<CampaignRow>('traffic_campaigns', clientId, signal),
    listClientRows<ReportRow>('traffic_reports', clientId, signal),
  ]);
  return { campaigns, reports };
}

export async function saveTrafficPlan(clientId: string, id: string, input: unknown, demo: boolean) {
  const plan = parsePlan(input);
  if (!demo) return (await invoke<{ campaign: CampaignRow }>({ action: 'plan', id, clientId, plan })).campaign;
  const workspace = demoWorkspace(clientId);
  const existing = workspace.campaigns.find((campaign) => campaign.id === id);
  if (existing) return existing;
  const campaign = { id, client_id: clientId, plan, created_at: new Date().toISOString() };
  window.localStorage.setItem(demoKey(clientId), JSON.stringify({ ...workspace, campaigns: [campaign, ...workspace.campaigns] }));
  return campaign;
}

export async function saveTrafficReport(campaign: CampaignRow, id: string, input: Snapshot, previousId: string | null, demo: boolean) {
  const snapshot = parseSnapshot(input, campaign.plan);
  const clientId = campaign.client_id;
  if (!demo) return (await invoke<{ report: ReportRow }>({
    action: 'analyze', id, clientId, campaignId: campaign.id, snapshot, previousId,
  })).report;
  const workspace = demoWorkspace(clientId);
  const existing = workspace.reports.find((row) => row.id === id);
  if (existing) return existing;
  const previous = previousId ? workspace.reports.find((row) => row.id === previousId && row.campaign_id === campaign.id) : undefined;
  if (previousId && !previous) throw new Error('Avaliação anterior indisponível.');
  if (previous) validateRevision(previous.snapshot, snapshot);
  const report = {
    id, client_id: clientId, campaign_id: campaign.id, previous_id: previousId, snapshot,
    diagnosis: diagnose(campaign.plan, snapshot, previous?.diagnosis), created_at: new Date().toISOString(), advice: null,
  };
  window.localStorage.setItem(demoKey(clientId), JSON.stringify({ ...workspace, reports: [report, ...workspace.reports] }));
  return report;
}

export async function adviseTraffic(report: ReportRow) {
  return (await invoke<{ report: ReportRow }>({
    action: 'advise', id: report.id, clientId: report.client_id, campaignId: report.campaign_id,
  })).report;
}

export async function deleteTrafficCampaign(campaign: CampaignRow, demo: boolean) {
  const { id, client_id: clientId } = campaign;
  if (!demo) {
    await invoke<{ deleted: true }>({ action: 'delete-campaign', id, clientId });
    return;
  }
  const workspace = demoWorkspace(clientId);
  window.localStorage.setItem(demoKey(clientId), JSON.stringify({
    campaigns: workspace.campaigns.filter((row) => row.id !== id),
    reports: workspace.reports.filter((row) => row.campaign_id !== id),
  }));
}
