import { useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { FileUp, FlaskConical, Plus, X } from 'lucide-react';
import { parseTrafficCsv, CSV_TEMPLATE } from '../../../lib/trafficCsv';
import {
  COUNTS, FUNNELS, LEAD_STAGES, MAX_CREATIVES, MAX_CSV_BYTES, MAX_GROUPS, MAX_LEADS_PER_CREATIVE, SOURCES, VALUES,
  parsePlan, parseSnapshot,
} from '../../../../supabase/functions/_shared/traffic';
import type { CampaignRow, Creative, Funnel, Lead, Origin, Plan, ReportRow, Snapshot } from '../../../../supabase/functions/_shared/traffic';

export const money = (value: number | null) => value === null ? '—' :
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const decimal = (value: FormDataEntryValue | null) => numeric(String(value ?? ''));
function numeric(input: string) {
  const value = input.trim();
  if (!value) return null;
  return /^\d+(?:[.,]\d+)?$/.test(value) ? Number(value.replace(',', '.')) : NaN;
}
const message = (error: unknown) => error instanceof Error ? error.message : 'Tente novamente.';
type CreativeFields = Record<keyof Omit<Creative, 'leads'>, string>;
const blankCreative = () => ({ name: '', group: '', format: '', angle: '', ...Object.fromEntries(VALUES.map((key) => [key, ''])) }) as CreativeFields;

function requestId(ref: { current: { payload: string; id: string } | null }, value: unknown) {
  const payload = JSON.stringify(value);
  if (ref.current?.payload === payload) return ref.current.id;
  const id = crypto.randomUUID();
  ref.current = { payload, id };
  return id;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0"><span className="rotulo !text-sm">{label}</span>{children}</label>;
}

export function Notice({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{children}</p>;
}

export function PlanForm({ save }: { save: (plan: Plan, id: string) => Promise<void> }) {
  const [mode, setMode] = useState<'ABO' | 'CBO'>('ABO');
  const [groups, setGroups] = useState(() => [crypto.randomUUID()]);
  const [budget, setBudget] = useState('');
  const [reserve, setReserve] = useState('0');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const attempt = useRef<{ payload: string; id: string } | null>(null);
  const available = Number.isFinite(numeric(budget)) && Number.isFinite(numeric(reserve))
    ? Math.max(0, (Math.round(Number(numeric(budget)) * 100) - Math.round(Number(numeric(reserve)) * 100)) / 100) : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setError('');
    setBusy(true);
    try {
      const plan = parsePlan({
        name: data.get('name'), objective: data.get('objective'), start: data.get('start'), end: data.get('end'), funnel: data.get('funnel'),
        mode, budget: numeric(budget), reserve: numeric(reserve), minRetestSales: decimal(data.get('minRetestSales')),
        groups: groups.map((id) => ({ name: data.get(`group-${id}`), audience: data.get(`audience-${id}`), budget: decimal(data.get(`budget-${id}`)) })),
      });
      await save(plan, requestId(attempt, plan));
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="cartao p-4 sm:p-6 space-y-5" onSubmit={submit}>
      <div>
        <h2 className="text-lg font-extrabold">Planejar campanha</h2>
        <p className="mt-1 text-sm text-text-muted">Defina o objetivo, os conjuntos e o teto para a janela de teste.</p>
      </div>
      <fieldset disabled={busy} className="space-y-5 min-w-0">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome da campanha"><input autoComplete="off" name="name" className="campo min-h-11" required maxLength={100} /></Field>
          <Field label="Funil"><select name="funnel" className="campo min-h-11">{Object.entries(FUNNELS).map(([id, funnel]) => <option key={id} value={id}>{funnel.label}</option>)}</select></Field>
          <div className="sm:col-span-2"><Field label="Objetivo"><input name="objective" className="campo min-h-11" required maxLength={240} placeholder="Ex. validar a oferta com novos públicos" /></Field></div>
          <Field label="Início planejado"><input name="start" className="campo min-h-11" type="date" defaultValue={today()} required /></Field>
          <Field label="Fim planejado"><input name="end" className="campo min-h-11" type="date" defaultValue={today()} required /></Field>
        </div>
        <fieldset className="grid gap-3 sm:grid-cols-2 min-w-0">
          <legend className="mb-2 text-sm font-bold">Orçamento de mídia</legend>
          {(['ABO', 'CBO'] as const).map((option) => (
            <label key={option} className={`flex gap-3 items-start rounded-xl border p-3 cursor-pointer ${mode === option ? 'border-accent-glow bg-gelo' : 'border-border-subtle'}`}>
              <input className="mt-1 accent-marinho" type="radio" name="mode" checked={mode === option} onChange={() => setMode(option)} />
              <span className="text-sm"><strong className="block">{option}</strong>{option === 'ABO' ? 'Orçamento por conjunto' : 'Orçamento compartilhado na campanha'}</span>
            </label>
          ))}
          <Field label="Teto total (R$)"><input className="campo min-h-11" inputMode="decimal" required value={budget} onChange={(event) => setBudget(event.target.value)} /></Field>
          <Field label="Reserva protegida (R$)"><input className="campo min-h-11" inputMode="decimal" required value={reserve} onChange={(event) => setReserve(event.target.value)} /></Field>
        </fieldset>
        <p className="rounded-xl bg-gelo p-3 text-sm">Disponível para alocação <strong className="ml-1">{money(available)}</strong></p>
        <details>
          <summary className="min-h-11 cursor-pointer content-center text-sm font-bold text-marinho">Critério de evidência para reteste</summary>
          <div className="max-w-sm pb-2">
            <Field label="Mínimo de vendas confirmadas"><input className="campo min-h-11" name="minRetestSales" inputMode="numeric" defaultValue="5" /></Field>
            <p className="mt-1 text-xs text-text-muted">Aumente o mínimo quando a decisão exigir uma amostra maior. Atribuição e custos também entram na avaliação.</p>
          </div>
        </details>
        <div className="space-y-3">
          <h3 className="text-sm font-bold">Conjuntos</h3>
          {groups.map((group, i) => (
            <fieldset key={group} className="rounded-xl border border-border-subtle p-3 sm:p-4 min-w-0">
              <legend className="px-1 text-xs font-bold text-text-muted">Conjunto {i + 1}</legend>
              <div className="grid items-end gap-3 sm:grid-cols-2">
                <Field label="Nome do conjunto"><input className="campo min-h-11" name={`group-${group}`} required maxLength={100} /></Field>
                <Field label="Público"><input className="campo min-h-11" name={`audience-${group}`} maxLength={240} /></Field>
                {mode === 'ABO' && <Field label="Orçamento do conjunto (R$)"><input className="campo min-h-11" name={`budget-${group}`} inputMode="decimal" required /></Field>}
                {groups.length > 1 && <button type="button" className="btn-fantasma min-h-11 justify-self-start" onClick={() => setGroups(groups.filter((id) => id !== group))}><X size={16} /> Remover conjunto {i + 1}</button>}
              </div>
            </fieldset>
          ))}
          {groups.length < MAX_GROUPS && <button type="button" className="btn-secundario min-h-11" onClick={() => setGroups([...groups, crypto.randomUUID()])}><Plus size={17} /> Adicionar conjunto</button>}
        </div>
      </fieldset>
      {error && <Notice>{error}</Notice>}
      <button className="btn-primario min-h-11 w-full sm:w-auto" disabled={busy}>{busy ? 'Salvando…' : 'Salvar planejamento'}</button>
    </form>
  );
}

const fieldLabels = (funnel: Funnel) => ({
  spend: 'Gasto (R$)', impressions: 'Impressões', clicks: 'Cliques', entries: FUNNELS[funnel].entry,
  qualified: FUNNELS[funnel].qualified, open: FUNNELS[funnel].open, sales: funnel === 'ecommerce' ? 'Compras' : 'Vendas',
  revenue: 'Receita atribuída (R$)',
});

type LeadDraft = Lead & { key: string };
type Draft = { key: string; fields: CreativeFields; leads: LeadDraft[] };
const newLead = (lead: Lead = { contact: '', stage: 'new' }): LeadDraft => ({ ...lead, key: crypto.randomUUID() });
function newDraft(row?: Creative): Draft {
  const key = crypto.randomUUID();
  if (!row) return { key, fields: blankCreative(), leads: [] };
  const { leads, ...fields } = row;
  return {
    key,
    fields: Object.fromEntries(Object.entries(fields).map(([name, value]) => [name, String(value ?? '')])) as CreativeFields,
    leads: (leads ?? []).map((lead) => newLead(lead)),
  };
}

function LeadFields({ leads, onChange }: { leads: LeadDraft[]; onChange: (leads: LeadDraft[]) => void }) {
  function update(key: string, changes: Partial<Lead>) {
    onChange(leads.map((lead) => lead.key === key ? { ...lead, ...changes } : lead));
  }
  return (
    <details className="mt-2 border-t border-border-subtle">
      <summary className="min-h-11 cursor-pointer content-center text-sm font-bold text-marinho">Contatos acompanhados ({leads.length})</summary>
      <p className="mb-3 text-xs text-text-muted">Registre uma referência e a etapa dos contatos que você acompanha. Inclua esses contatos nos totais correspondentes do criativo.</p>
      <div className="space-y-3">
        {leads.map((lead, index) => (
          <fieldset key={lead.key} className="grid min-w-0 gap-2 rounded-xl bg-canvas p-3 sm:grid-cols-2">
            <legend className="sr-only">Contato {index + 1}</legend>
            <Field label="Referência do contato"><input className="campo min-h-11" placeholder="Ex. iniciais ou código no CRM" maxLength={100}
              value={lead.contact} onChange={(e) => update(lead.key, { contact: e.target.value })} /></Field>
            <Field label="Estágio"><select className="campo min-h-11" value={lead.stage} onChange={(e) => update(lead.key, { stage: e.target.value as Lead['stage'] })}>
              {Object.entries(LEAD_STAGES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select></Field>
            <button type="button" className="btn-fantasma min-h-11 justify-self-start" onClick={() => onChange(leads.filter(({ key }) => key !== lead.key))}><X size={16} /> Remover contato {index + 1}</button>
          </fieldset>
        ))}
        {leads.length < MAX_LEADS_PER_CREATIVE && <button type="button" className="btn-secundario min-h-11" onClick={() => onChange([...leads, newLead()])}><Plus size={16} /> Adicionar contato</button>}
      </div>
    </details>
  );
}

export function AnalysisForm({ campaign, revision, demo, save }: {
  campaign: CampaignRow;
  revision?: ReportRow;
  demo: boolean;
  save: (snapshot: Snapshot, id: string, previousId: string | null) => Promise<void>;
}) {
  const previous = revision?.snapshot;
  const [drafts, setDrafts] = useState(() => previous?.creatives.map(newDraft) ?? [newDraft()]);
  const [source, setSource] = useState<Origin>(previous?.source ?? (demo ? 'simulated' : 'manual'));
  const [imported, setImported] = useState(previous?.source === 'csv');
  const [usingExample, setUsingExample] = useState(false);
  const [ticket, setTicket] = useState(String(previous?.ticket ?? ''));
  const [target, setTarget] = useState(String(previous?.target ?? ''));
  const [unitCost, setUnitCost] = useState(String(previous?.unitCost ?? ''));
  const [trackingVerified, setTracking] = useState(previous?.trackingVerified ?? false);
  const [error, setError] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const attempt = useRef<{ payload: string; id: string } | null>(null);
  const labels = fieldLabels(campaign.plan.funnel);

  function sample() {
    const signals = [
      { entries: 12, qualified: 8, sales: 2, open: 2, clicks: 84, impressions: 3500 },
      { entries: 10, qualified: 7, sales: 0, open: 4, clicks: 65, impressions: 3500 },
      { entries: 2, qualified: 0, sales: 0, open: 0, clicks: 20, impressions: 3500 },
      { entries: 9, qualified: 5, sales: 1, open: 3, clicks: 56, impressions: 3500 },
    ];
    setDrafts(signals.map((row, i) => newDraft({
      ...row, name: `Criativo ${'ABCD'[i]}`, spend: 100, group: '', format: '', angle: '', revenue: null,
    })));
    setSource('simulated');
    setUsingExample(true);
    setImported(false);
    setTarget('60');
    setTicket('100');
    setUnitCost('');
    setTracking(false);
    setError('');
    setImportStatus('Quatro criativos simulados carregados.');
  }

  async function importCsv(selected?: File) {
    if (!selected) return;
    setError('');
    setImportStatus('');
    setImporting(true);
    try {
      if (selected.size > MAX_CSV_BYTES) throw new Error('O CSV excede 96 KB.');
      const rows = parseTrafficCsv(await selected.text());
      setDrafts((draftRows) => rows.map((row) => {
        const draft = newDraft(row);
        return { ...draft, leads: draftRows.find(({ fields }) => fields.name === row.name)?.leads ?? [] };
      }));
      setImported(true);
      if (source !== 'simulated') setSource('csv');
      setImportStatus(`${rows.length} criativos importados. Confira os campos antes de salvar.`);
    } catch (failure) {
      setError(message(failure));
    } finally {
      if (file.current) file.current.value = '';
      setImporting(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || importing) return;
    const input = new FormData(event.currentTarget);
    setError('');
    setBusy(true);
    try {
      const snapshot = parseSnapshot({
        start: input.get('start'), end: input.get('end'), source, ticket: numeric(ticket), unitCost: numeric(unitCost), target: numeric(target), trackingVerified,
        creatives: drafts.map(({ fields, leads }) => ({
          ...fields, ...Object.fromEntries(VALUES.map((key) => [key, numeric(fields[key])])),
          leads: leads.map(({ contact, stage }) => ({ contact, stage })),
        })),
      }, campaign.plan);
      await save(snapshot, requestId(attempt, snapshot), revision?.id ?? null);
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }

  function update(key: string, field: keyof CreativeFields, value: string) {
    setDrafts((rows) => rows.map((row) => row.key === key ? { ...row, fields: { ...row.fields, [field]: value } } : row));
  }

  return (
    <form className="cartao space-y-5 p-4 sm:p-6" onSubmit={submit}>
      <div>
        <h2 className="text-lg font-extrabold">{revision ? 'Reavaliar campanha' : 'Analisar campanha'}</h2>
        <p className="mt-1 text-sm text-text-muted">{revision ? 'Atualize os valores acumulados. A avaliação anterior fica no histórico.' : 'Informe valores acumulados por criativo dentro do período selecionado.'}</p>
      </div>
      <fieldset disabled={busy || importing} className="min-w-0 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Início da análise"><input type="date" name="start" className="campo min-h-11" defaultValue={previous?.start ?? campaign.plan.start} readOnly={!!revision} required /></Field>
          <Field label="Fim da análise"><input type="date" name="end" className="campo min-h-11" defaultValue={previous?.end ?? campaign.plan.end} min={previous?.end} required /></Field>
          <Field label="Origem dos dados">
            <select className="campo min-h-11" value={source} onChange={(e) => setSource(e.target.value as Origin)} disabled={demo || !!revision || usingExample}>
              {Object.entries(SOURCES).filter(([key]) => key !== 'csv' || imported).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
            </select>
          </Field>
          <Field label="CPA-teto por venda (R$)"><input className="campo min-h-11" required inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
          <Field label="Ticket por venda (R$, opcional)"><input className="campo min-h-11" inputMode="decimal" value={ticket} onChange={(e) => setTicket(e.target.value)} /></Field>
          <Field label="Custo por venda (R$, opcional)"><input className="campo min-h-11" inputMode="decimal" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} /></Field>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input className="h-5 w-5 shrink-0 accent-marinho" type="checkbox" checked={trackingVerified} onChange={(e) => setTracking(e.target.checked)} />
          Atribuição das vendas conferida
        </label>
        <div className="rounded-xl border border-border-subtle bg-canvas p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input ref={file} type="file" hidden accept=".csv,text/csv,text/tab-separated-values" onChange={(e) => void importCsv(e.target.files?.[0])} />
            <button type="button" className="btn-secundario min-h-11" onClick={() => file.current?.click()}><FileUp size={17} /> Importar CSV</button>
            <a className="btn-fantasma min-h-11" download="modelo-trafego.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent('\uFEFF' + CSV_TEMPLATE + '\r\n')}`}>Baixar modelo</a>
            {!revision && campaign.plan.funnel === 'whatsapp' && !usingExample && <button type="button" className="btn-fantasma min-h-11" onClick={sample}><FlaskConical size={17} /> Usar exemplo</button>}
            {usingExample && <button type="button" className="btn-fantasma min-h-11" onClick={() => {
              setDrafts([newDraft()]); setUsingExample(false); setSource(demo ? 'simulated' : 'manual');
              setImported(false); setImportStatus(''); setError(''); setTarget(''); setTicket(''); setUnitCost(''); setTracking(false);
            }}>Limpar exemplo</button>}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-text-muted">A importação substitui as linhas em edição. Inclua uma linha por criativo com gasto e vendas. Use zero para valores conferidos e deixe campos opcionais desconhecidos em branco.</p>
          {(importing || importStatus) && <p role="status" className="mt-2 text-sm font-semibold text-marinho">{importing ? 'Lendo CSV…' : importStatus}</p>}
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-bold">Criativos <span className="font-normal text-text-muted">({drafts.length})</span></h3>
          {drafts.map(({ key, fields, leads }, i) => {
            const existing = previous?.creatives.some((row) => row.name === fields.name) ?? false;
            return (
              <fieldset key={key} className="min-w-0 rounded-xl border border-border-subtle p-3 sm:p-4">
                <legend className="px-1 text-xs font-bold text-text-muted">Criativo {i + 1}</legend>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <Field label="Nome do criativo"><input className="campo min-h-11" maxLength={100} required readOnly={existing} value={fields.name} onChange={(e) => update(key, 'name', e.target.value)} /></Field>
                  <Field label="Gasto (R$)"><input className="campo min-h-11" inputMode="decimal" required value={fields.spend} onChange={(e) => update(key, 'spend', e.target.value)} /></Field>
                  <Field label={labels.sales}><input className="campo min-h-11" inputMode="numeric" required value={fields.sales} onChange={(e) => update(key, 'sales', e.target.value)} /></Field>
                </div>
                <details className="mt-2" open={Boolean(revision) || undefined}>
                  <summary className="min-h-11 content-center cursor-pointer text-sm font-bold text-marinho">Métricas do funil e detalhes</summary>
                  <div className="grid gap-3 pt-2 sm:grid-cols-2 xl:grid-cols-3">
                    {VALUES.filter((field) => field !== 'spend' && field !== 'sales').map((field) => (
                      <Field key={field} label={labels[field]}>
                        <input className="campo min-h-11" inputMode={(COUNTS as readonly string[]).includes(field) ? 'numeric' : 'decimal'} placeholder="Desconhecido" value={fields[field]} onChange={(e) => update(key, field, e.target.value)} />
                      </Field>
                    ))}
                    <Field label="Conjunto">
                      <select className="campo min-h-11" value={fields.group} onChange={(e) => update(key, 'group', e.target.value)}>
                        <option value="">Sem vínculo</option>
                        {fields.group && !campaign.plan.groups.some((group) => group.name === fields.group) && <option value={fields.group}>{fields.group} (revise)</option>}
                        {campaign.plan.groups.map((group) => <option key={group.name}>{group.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Formato"><input className="campo min-h-11" maxLength={100} value={fields.format} onChange={(e) => update(key, 'format', e.target.value)} /></Field>
                    <Field label="Ângulo criativo"><input className="campo min-h-11" maxLength={240} value={fields.angle} onChange={(e) => update(key, 'angle', e.target.value)} /></Field>
                  </div>
                </details>
                {campaign.plan.funnel !== 'ecommerce' && <LeadFields leads={leads} onChange={(next) => {
                  setDrafts((rows) => rows.map((row) => row.key === key ? { ...row, leads: next } : row));
                }} />}
                {!existing && drafts.length > 1 && <button type="button" className="btn-fantasma min-h-11 mt-2" onClick={() => setDrafts(drafts.filter((row) => row.key !== key))}><X size={16} /> Remover criativo {i + 1}</button>}
              </fieldset>
            );
          })}
          {drafts.length < MAX_CREATIVES && <button type="button" className="btn-secundario min-h-11" onClick={() => setDrafts([...drafts, newDraft()])}><Plus size={17} /> Adicionar criativo</button>}
        </div>
      </fieldset>
      {error && <Notice>{error}</Notice>}
      <button className="btn-primario min-h-11 w-full sm:w-auto" disabled={busy || importing}>{busy ? 'Calculando e salvando…' : 'Calcular e salvar diagnóstico'}</button>
    </form>
  );
}
