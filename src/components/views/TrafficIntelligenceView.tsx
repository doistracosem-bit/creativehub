import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowRight, ClipboardList, History, Layers3, LineChart } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { loadTraffic, saveTrafficPlan, saveTrafficReport, adviseTraffic } from '../../services/trafficService';
import { SOURCES } from '../../../supabase/functions/_shared/traffic';
import type { CampaignRow, Plan, ReportRow, Snapshot } from '../../../supabase/functions/_shared/traffic';
import { AnalysisForm, Field, Notice, PlanForm } from './traffic/TrafficForms';
import { CampaignPlan, formatDate, TrafficReport } from './traffic/TrafficReport';

const views = [
  { id: 'overview', label: 'Visão geral', icon: Layers3 },
  { id: 'plan', label: 'Planejar', icon: ClipboardList },
  { id: 'analyze', label: 'Analisar', icon: LineChart },
] as const;
type View = (typeof views)[number]['id'];
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Tente novamente.';

export default function TrafficIntelligenceView() {
  const { clients, isMockMode } = useApp();
  const [clientId, setClientId] = useState('');
  const activeClient = clients.find((client) => client.id === clientId) ?? clients[0];

  return (
    <div className="space-y-5 pb-6 [&_button:focus-visible]:outline [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-accent-glow">
      <header className="relative isolate overflow-hidden rounded-bento bg-marinho px-4 py-5 text-white shadow-suave sm:px-7 sm:py-7">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_rgba(106,200,255,0.28),_transparent_64%)]" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 hidden size-10 place-items-center rounded-xl bg-white/15 sm:grid"><Activity size={21} aria-hidden="true" /></div>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">Traffic Intelligence AI</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/85">Planeje campanhas, compare criativos e avalie os próximos passos com base nas evidências.</p>
          </div>
          {activeClient && <div className="min-w-0 lg:w-64 [&_.rotulo]:text-white/90">
            <Field label="Cliente">
              <select className="campo min-h-11" value={activeClient.id} onChange={(e) => setClientId(e.target.value)}>
                {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </Field>
          </div>}
        </div>
      </header>

      {activeClient ? <ClientTraffic key={activeClient.id} clientId={activeClient.id} demo={isMockMode} /> :
        <div className="cartao p-5 text-sm text-text-muted">Cadastre um cliente na área Clientes para criar o primeiro planejamento.</div>}
    </div>
  );
}

function ClientTraffic({ clientId, demo }: { clientId: string; demo: boolean }) {
  const [view, setView] = useState<View>('overview');
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [reportId, setReportId] = useState('');
  const [revision, setRevision] = useState<ReportRow>();
  const [load, setLoad] = useState({ busy: true, error: '', version: 0 });
  const [advice, setAdvice] = useState({ id: '', busy: false, error: '' });
  const section = useRef<HTMLDivElement>(null);
  const campaign = campaigns.find((row) => row.id === campaignId) ?? campaigns[0];
  const campaignReports = reports.filter((row) => row.campaign_id === campaign?.id);
  const report = campaignReports.find((row) => row.id === reportId) ?? campaignReports[0];
  const showCampaignPicker = view === 'analyze' || campaigns.length > 1 || !report;
  const showHistoryPicker = view === 'overview' && campaignReports.length > 1;

  useEffect(() => {
    const controller = new AbortController();
    void loadTraffic(clientId, demo, controller.signal).then((workspace) => {
      if (controller.signal.aborted) return;
      setCampaigns(workspace.campaigns);
      setReports(workspace.reports);
      setLoad((state) => ({ ...state, busy: false }));
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) setLoad((state) => ({ ...state, busy: false, error: errorMessage(failure) }));
    });
    return () => controller.abort();
  }, [clientId, demo, load.version]);

  function open(next: View, fromContent = false) {
    setRevision(undefined);
    setView(next);
    if (fromContent) section.current?.scrollIntoView({ block: 'start' });
  }

  async function savePlan(plan: Plan, id: string) {
    const saved = await saveTrafficPlan(clientId, id, plan, demo);
    setCampaigns((rows) => [saved, ...rows.filter((row) => row.id !== saved.id)]);
    setCampaignId(saved.id);
    setReportId('');
    open('overview', true);
  }

  async function saveReport(selected: CampaignRow, snapshot: Snapshot, id: string, previousId: string | null) {
    const saved = await saveTrafficReport(selected, id, snapshot, previousId, demo);
    setReports((rows) => [saved, ...rows.filter((row) => row.id !== saved.id)]);
    setCampaignId(selected.id);
    setReportId(saved.id);
    open('overview', true);
  }

  async function requestAdvice(selected: ReportRow) {
    if (advice.busy) return;
    setAdvice({ id: selected.id, busy: true, error: '' });
    try {
      const saved = await adviseTraffic(selected);
      setReports((rows) => rows.map((row) => row.id === saved.id ? saved : row));
      setAdvice({ id: selected.id, busy: false, error: '' });
    } catch (failure) {
      setAdvice({ id: selected.id, busy: false, error: errorMessage(failure) });
    }
  }

  return (
    <div ref={section} className="scroll-mt-4 space-y-4">
      <nav aria-label="Seções de Traffic Intelligence" className="grid grid-cols-3 gap-1 rounded-2xl border border-border-subtle bg-surface p-1 shadow-suave sm:w-fit sm:gap-2">
        {views.map(({ id, label, icon: Icon }) => (
          <button type="button" key={id} aria-current={view === id ? 'page' : undefined} onClick={() => open(id)}
            className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-1 text-xs font-bold transition-colors sm:px-4 sm:text-sm ${view === id ? 'bg-marinho text-white' : 'text-text-muted hover:bg-gelo hover:text-marinho'}`}>
            <Icon size={16} aria-hidden="true" className="hidden shrink-0 min-[365px]:block" />
            {label}
          </button>
        ))}
      </nav>

      {load.busy ? <p className="cartao p-5 text-sm text-text-muted" role="status">Carregando campanhas e avaliações…</p> : load.error ? (
        <div className="space-y-3"><Notice>{load.error}</Notice><button className="btn-secundario min-h-11" onClick={() => setLoad({ busy: true, error: '', version: load.version + 1 })}>Recarregar</button></div>
      ) : view === 'plan' ? <PlanForm save={savePlan} /> : (
        <>
          {campaign ? (showCampaignPicker || showHistoryPicker) && (
            <div className="cartao grid items-end gap-3 p-4 sm:grid-cols-2 sm:p-5">
              {showCampaignPicker && <Field label="Campanha">
                <select className="campo min-h-11" value={campaign.id} onChange={(e) => { setCampaignId(e.target.value); setRevision(undefined); setReportId(''); }}>
                  {campaigns.map((row) => <option value={row.id} key={row.id}>{row.plan.name}</option>)}
                </select>
              </Field>}
              {showHistoryPicker && <Field label="Histórico de avaliações">
                <select className="campo min-h-11" value={report?.id} onChange={(e) => setReportId(e.target.value)}>
                  {campaignReports.map((row, index) => (
                    <option value={row.id} key={row.id}>{campaignReports.length - index}. {formatDate(row.snapshot.start)} a {formatDate(row.snapshot.end)} · {SOURCES[row.snapshot.source]}</option>
                  ))}
                </select>
              </Field>}
            </div>
          ) : (
            <section className="cartao p-4 sm:p-6">
              <ClipboardList aria-hidden="true" size={24} className="mb-3 text-marinho" />
              <h2 className="text-lg font-extrabold">Comece pelo plano da campanha</h2>
              <p className="my-2 text-sm text-text-muted">Salve o primeiro planejamento deste cliente para registrar análises e acompanhar as reavaliações.</p>
              <button className="btn-primario mt-2 min-h-11" onClick={() => open('plan', true)}>Planejar campanha <ArrowRight size={16} /></button>
            </section>
          )}

          {view === 'analyze' && campaign && <AnalysisForm key={revision?.id ?? campaign.id} campaign={campaign} revision={revision} demo={demo} save={(snapshot, id, previousId) => saveReport(campaign, snapshot, id, previousId)} />}
          {view === 'overview' && campaign && (
            <>
              {report ? <>
                <TrafficReport report={report} campaignName={campaign.plan.name} demo={demo} busy={advice.busy} adviceError={advice.id === report.id ? advice.error : ''}
                  onAdvise={() => void requestAdvice(report)} onRevise={() => { setRevision(report); setView('analyze'); section.current?.scrollIntoView({ block: 'start' }); }} />
                <details className="cartao">
                  <summary className="min-h-12 content-center cursor-pointer px-4 font-bold text-marinho sm:px-6">Ver planejamento da campanha</summary>
                  <CampaignPlan campaign={campaign} embedded />
                </details>
              </>
                : <section className="cartao p-4 sm:p-6">
                  <h2 className="flex items-center gap-2 text-lg font-extrabold"><History size={20} className="shrink-0 text-marinho" /> Histórico da campanha</h2>
                  <p className="mt-2 text-sm text-text-muted">Insira as métricas ou importe um CSV para salvar a primeira avaliação.</p>
                  <button className="btn-primario mt-4 min-h-11" onClick={() => open('analyze', true)}>Analisar campanha <ArrowRight size={16} /></button>
                </section>}
              {!report && <CampaignPlan campaign={campaign} />}
            </>
          )}
        </>
      )}
    </div>
  );
}
