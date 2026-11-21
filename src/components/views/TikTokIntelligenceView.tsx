import { useEffect, useState } from 'react';
import { ChartNoAxesCombined, Clapperboard, Search, Sparkles, Trash2 } from 'lucide-react';
import { nextTikTokSlot, TIKTOK_DAYS, TIKTOK_TIMEZONES, tiktokHour } from '../../../supabase/functions/_shared/tiktok';
import type { TikTokInput, TikTokReport as Report, TikTokZone } from '../../../supabase/functions/_shared/tiktok';
import { useApp } from '../../context/AppContext';
import { useUI } from '../../context/UIContext';
import { adviseTikTok, deleteTikTokReport, listTikTokReports, loadTikTokReport, saveTikTokReport } from '../../services/tiktokService';
import type { Client } from '../../types';
import { Field, Notice } from './traffic/TrafficForms';
import { TikTokResearch } from './tiktok/TikTokResearch';
import { TikTokForm } from './tiktok/TikTokForm';
import { TikTokReport } from './tiktok/TikTokReport';

const modes = [{ id: 'general', label: 'Pesquisa geral', Icon: Search }, { id: 'account', label: 'Analisar conta', Icon: ChartNoAxesCombined }] as const;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Tente novamente.';
const localDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

export default function TikTokIntelligenceView() {
  const { clients, isMockMode } = useApp();
  const { abrirPost } = useUI();
  const [mode, setMode] = useState<(typeof modes)[number]['id']>('general');
  const [clientId, setClientId] = useState('');
  const active = clients.find((client) => client.id === clientId);

  function draft(client: Client, day: number, hour: number, note: string, zone: TikTokZone = 'America/Sao_Paulo') {
    abrirPost(null, {
      client_name: client.name, format: 'Reels / TikTok', status: 'IDEIA',
      headline: `Teste TikTok · ${TIKTOK_DAYS[day]} às ${tiktokHour(hour)}`,
      scheduled_for: nextTikTokSlot(day, hour, zone),
      copy_text: `Pauta de teste do TikTok Viral Intelligence. Fuso: ${TIKTOK_TIMEZONES[zone]}. ${note}`,
    });
  }

  return (
    <div className="space-y-5 pb-6 [&_button:focus-visible]:outline [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-accent-glow">
      <header className="relative isolate overflow-hidden rounded-bento bg-marinho px-4 py-5 text-white shadow-suave sm:px-7 sm:py-7">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_rgba(106,200,255,0.3),_transparent_66%)]" />
        <Clapperboard size={26} aria-hidden="true" className="mb-3 text-white/90" />
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">TikTok Viral Intelligence</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/85">Planeje testes de publicação com pesquisas de mercado ou analise os resultados orgânicos de uma conta da equipe.</p>
      </header>
      <nav aria-label="Modos do TikTok Viral Intelligence" className="grid grid-cols-2 gap-2 sm:flex">
        {modes.map(({ id, label, Icon }) => <button key={id} className={mode === id ? 'btn-primario min-h-11' : 'btn-secundario min-h-11'}
          type="button" aria-pressed={mode === id} onClick={() => setMode(id)}><Icon size={17} className="shrink-0" />{label}</button>)}
      </nav>
      {mode === 'general' ? <TikTokResearch clients={clients} draft={(client, day, hour, format) => draft(client, day, hour, `Formato sugerido: ${format}.`)} /> : (
        <div className="space-y-5">
          <section className="cartao p-4 sm:p-6">
            <div className="max-w-sm"><Field label="Cliente da análise"><select className="campo" value={active?.id ?? ''} onChange={(event) => setClientId(event.target.value)}>
              <option value="">Selecione o cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select></Field></div>
            {!active && <p className="mt-2 text-sm text-text-muted">{clients.length ? 'Selecione o cliente para criar uma análise ou abrir o histórico.' : 'Cadastre um cliente em Clientes para iniciar a análise.'}</p>}
          </section>
          {active && <ClientTikTok key={active.id} clientId={active.id} demo={isMockMode}
            draft={(report, day, hour) => draft(active, day, hour, `Perfil analisado: ${report.input.handle}. Compare com outra faixa usando um vídeo de formato semelhante.`, report.input.timezone)} />}
        </div>
      )}
    </div>
  );
}

function ClientTikTok({ clientId, demo, draft }: { clientId: string; demo: boolean; draft: (report: Report, day: number, hour: number) => void }) {
  const [history, setHistory] = useState<Awaited<ReturnType<typeof listTikTokReports>>>([]);
  const [historyLoad, setHistoryLoad] = useState({ busy: true, error: '', retry: 0 });
  const [selectedId, setSelectedId] = useState('');
  const [report, setReport] = useState<Report>();
  const [opening, setOpening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void listTikTokReports(clientId, demo, controller.signal).then((items) => {
      if (controller.signal.aborted) return;
      setHistory(items);
      setHistoryLoad((state) => ({ ...state, busy: false, error: '' }));
    }).catch((failure) => {
      if (!controller.signal.aborted) setHistoryLoad((state) => ({ ...state, busy: false, error: errorMessage(failure) }));
    });
    return () => controller.abort();
  }, [clientId, demo, historyLoad.retry]);

  useEffect(() => {
    if (!selectedId || report?.id === selectedId) return;
    const controller = new AbortController();
    void loadTikTokReport(clientId, selectedId, demo, controller.signal).then((item) => {
      if (!controller.signal.aborted) setReport(item);
    }).catch((failure) => {
      if (!controller.signal.aborted) {
        setSelectedId('');
        setError(errorMessage(failure));
      }
    }).finally(() => {
      if (!controller.signal.aborted) setOpening(false);
    });
    return () => controller.abort();
  }, [clientId, demo, report?.id, selectedId]);

  async function save(input: TikTokInput, id: string) {
    const item = await saveTikTokReport(clientId, id, input, demo);
    setReport(item);
    setSelectedId(item.id);
    setHistory((rows) => [{ id: item.id, handle: item.input.handle, created_at: item.created_at }, ...rows.filter((row) => row.id !== item.id)]);
    setStatus('Análise salva no histórico.');
  }

  async function change(operation: 'advice' | 'delete') {
    if (!report || busy) return;
    setError('');
    setStatus('');
    setBusy(true);
    try {
      if (operation === 'advice') {
        setReport(await adviseTikTok(report));
        setStatus('Recomendações salvas.');
      } else {
        await deleteTikTokReport(clientId, report.id, demo);
        setHistory((rows) => rows.filter((row) => row.id !== report.id));
        setReport(undefined);
        setSelectedId('');
        setConfirmDelete(false);
        setStatus('Análise excluída.');
      }
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  const shown = report?.id === selectedId ? report : undefined;

  return (
    <div className="space-y-5">
      <section className="cartao space-y-3 p-4 sm:p-6">
        <h2 className="text-lg font-extrabold text-marinho">Histórico do cliente</h2>
        <p className="sr-only" role="status">{status}</p>
        {historyLoad.busy && <p className="text-sm text-text-muted" role="status">Carregando histórico…</p>}
        {historyLoad.error && <div className="space-y-2"><Notice>{historyLoad.error}</Notice><button className="btn-secundario"
          type="button" onClick={() => setHistoryLoad((state) => ({ busy: true, error: '', retry: state.retry + 1 }))}>Tentar novamente</button></div>}
        {history.length > 0 ? <div className="max-w-sm"><Field label="Abrir análise">
          <select className="campo" value={selectedId} disabled={busy} onChange={(event) => {
            const id = event.target.value;
            setOpening(Boolean(id) && id !== report?.id);
            setSelectedId(id);
            setConfirmDelete(false);
            setError('');
            setStatus('');
          }}>
            <option value="">Nova análise</option>
            {history.map((item) => <option key={item.id} value={item.id}>{item.handle} · {localDate.format(new Date(item.created_at))}</option>)}
          </select></Field></div>
          : !historyLoad.busy && !historyLoad.error && <p className="text-sm text-text-muted">Nenhuma análise salva para este cliente.</p>}
        {error && !shown && <Notice>{error}</Notice>}
      </section>

      {opening ? <p className="cartao p-4 text-sm text-text-muted" role="status">Carregando análise…</p>
        : shown ? <>
          <TikTokReport report={shown} draft={(slot) => draft(shown, slot.day, slot.hour)} />
          <section className="cartao space-y-3 p-4 sm:p-6">
            <h3 className="text-lg font-extrabold text-marinho">Recomendações para a equipe</h3>
            {shown.advice ? <>
              <p className="break-words text-sm text-text-muted">{shown.advice.summary}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-text-muted">{shown.advice.tests.map((test, index) => <li className="break-words" key={index}>{test}</li>)}</ul>
            </> : <button type="button" className="btn-primario min-h-11" disabled={busy || demo} onClick={() => void change('advice')}>
              <Sparkles size={16} />{busy && !confirmDelete ? 'Interpretando…' : 'Interpretar com Gemini'}
            </button>}
            {demo && !shown.advice && <p className="text-xs text-text-muted">O Gemini está disponível no ambiente conectado.</p>}
            {error && <Notice>{error}</Notice>}
          </section>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secundario min-h-11 text-red-800" disabled={busy} onClick={() => {
              if (confirmDelete) void change('delete');
              else { setConfirmDelete(true); setError(''); }
            }}><Trash2 size={16} />{confirmDelete ? busy ? 'Excluindo…' : 'Confirmar exclusão' : 'Excluir análise'}</button>
            {confirmDelete && <button type="button" className="btn-secundario min-h-11" disabled={busy} onClick={() => setConfirmDelete(false)}>Manter análise</button>}
          </div>
        </> : !historyLoad.busy && <TikTokForm save={save} />}
    </div>
  );
}
