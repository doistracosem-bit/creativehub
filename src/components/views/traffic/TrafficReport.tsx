import { BarChart3, ChartNoAxesCombined, CircleAlert, Clock3, ShieldCheck, Sparkles } from 'lucide-react';
import { FUNNELS, LEAD_STAGES, SOURCES } from '../../../../supabase/functions/_shared/traffic';
import type { CampaignRow, Color, ReportRow } from '../../../../supabase/functions/_shared/traffic';
import { money, Notice } from './TrafficForms';

const countFormat = new Intl.NumberFormat('pt-BR');
const ratioFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const count = (value: number | null) => value === null ? '—' : countFormat.format(value);
const rate = (value: number | null, suffix: string) => value === null ? '—' : `${ratioFormat.format(value)}${suffix}`;
const colors: Record<Color, { title: string; style: string }> = {
  green: { title: 'Verde', style: 'bg-emerald-50 text-emerald-900 ring-emerald-200' },
  yellow: { title: 'Amarelo', style: 'bg-amber-50 text-amber-900 ring-amber-200' },
  red: { title: 'Vermelho', style: 'bg-red-50 text-red-900 ring-red-200' },
  gray: { title: 'Cinza', style: 'bg-slate-100 text-slate-800 ring-slate-200' },
};

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(value.slice(0, 10)));

function StatGrid({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 xl:grid-cols-4">
      {items.map(([label, value]) => (
        <div className="min-w-0" key={label}>
          <dt className="text-xs font-semibold text-text-muted">{label}</dt>
          <dd className="mt-1 font-bold tabular-nums break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CampaignPlan({ campaign, embedded = false }: { campaign: CampaignRow; embedded?: boolean }) {
  const { plan } = campaign;
  return (
    <article className={`min-w-0 p-4 sm:p-6 ${embedded ? 'border-t border-border-subtle' : 'cartao'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 break-words text-lg font-extrabold">{plan.name}</h2>
        <span className="rounded-full bg-gelo px-2.5 py-1 text-xs font-bold text-marinho">{plan.mode}</span>
      </div>
      <p className="mt-1 break-words text-sm text-text-muted">{plan.objective}</p>
      <p className="mt-2 mb-5 flex items-center gap-2 text-xs font-semibold text-text-muted"><Clock3 size={15} /> {FUNNELS[plan.funnel].label} · {formatDate(plan.start)} a {formatDate(plan.end)}</p>
      <StatGrid items={[
        ['Teto planejado', money(plan.budget)], ['Reserva', money(plan.reserve)],
        ['Alocado', money(plan.allocation)], ['Disponível sem alocação', money(plan.unallocated)],
      ]} />
      <ul className="mt-5 divide-y divide-border-subtle border-t border-border-subtle">
        {plan.groups.map((group) => (
          <li key={group.name} className="flex justify-between gap-3 py-3 text-sm">
            <div className="min-w-0 break-words"><strong>{group.name}</strong>{group.audience && <p className="mt-0.5 text-text-muted">{group.audience}</p>}</div>
            {group.budget !== null && <strong className="shrink-0">{money(group.budget)}</strong>}
          </li>
        ))}
      </ul>
    </article>
  );
}

export function TrafficReport({ report, campaignName, demo, busy, adviceError, onAdvise, onRevise }: {
  report: ReportRow; campaignName: string; demo: boolean; busy: boolean; adviceError: string; onAdvise: () => void; onRevise: () => void;
}) {
  const { snapshot, diagnosis, advice } = report;
  const { total, rows } = diagnosis;
  const funnel = FUNNELS[diagnosis.funnel];
  const salesLabel = diagnosis.funnel === 'ecommerce' ? 'Compras' : 'Vendas';
  const actionsAvailable = diagnosis.reasons.length === 0 && diagnosis.retestLimit > 0;
  return (
    <div className="space-y-4">
      <section className="cartao space-y-4 p-4 sm:p-6" aria-label="Resumo da análise">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold text-marinho"><BarChart3 size={16} /> {SOURCES[snapshot.source]} · Playbook {diagnosis.version}</p>
            <h2 className="mt-2 text-xl font-extrabold">Diagnóstico da campanha</h2>
            <p className="mt-1 break-words text-sm text-text-muted"><strong className="text-text-main">{campaignName}</strong> · {formatDate(snapshot.start)} a {formatDate(snapshot.end)} · {funnel.label}</p>
          </div>
          <button className="btn-secundario min-h-11" onClick={onRevise}>Reavaliar com novos dados</button>
        </div>
        {diagnosis.unchanged !== null && <p className="rounded-xl bg-gelo p-3 text-sm">{diagnosis.unchanged ? 'Reavaliação sem mudança na classificação.' : 'A classificação mudou nesta reavaliação.'}</p>}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {([
            ['Gasto acumulado', money(total.spend)], [salesLabel, count(total.sales)],
            ['CPA acumulado', money(total.cpa)], ['ROAS atribuído', rate(total.roas, '×')],
          ] as const).map(([label, value]) => (
            <div className="rounded-xl border border-border-subtle bg-canvas p-3 sm:p-4 min-w-0" key={label}>
              <p className="text-xs font-semibold text-text-muted">{label}</p>
              <p className="mt-1 text-base font-extrabold tabular-nums break-words sm:text-xl">{value}</p>
            </div>
          ))}
        </div>
        <StatGrid items={[
          ['CPA-teto por venda', money(snapshot.target)], ['Receita atribuída', money(total.revenue)],
          ['Receita menos mídia', money(total.mediaBalance)], ['Saldo após mídia e custo informado', money(diagnosis.contribution)],
          ['Custo por entrada', money(total.costPerEntry)], ['Custo por qualificação', money(total.costPerQualified)],
          ['CPM', money(total.cpm)], ['CPC', money(total.cpc)], ['CTR', rate(total.ctr, '%')],
          ['Taxa de qualificação', rate(total.qualificationRate, '%')], ['Taxa de venda por entrada', rate(total.saleRate, '%')],
          [funnel.open, count(total.open)],
        ]} />
        <p className="text-xs leading-relaxed text-text-muted">O traço indica dado desconhecido ou taxa indefinida. {diagnosis.estimatedRevenue && 'A receita inclui estimativas com base no ticket informado. '}{diagnosis.additionalSalesAtTarget > 0 && `Para chegar ao CPA-teto com o gasto atual, seriam necessárias mais ${count(diagnosis.additionalSalesAtTarget)} vendas.`}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section className="cartao p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><ChartNoAxesCombined className="shrink-0 text-marinho" size={20} /> Etapas do funil</h2>
        <p className="mt-1 mb-4 text-sm text-text-muted">{diagnosis.funnelRule}</p>
        <StatGrid items={[
          ['Impressões', count(total.impressions)], ['Cliques', count(total.clicks)], [funnel.entry, count(total.entries)],
          [funnel.qualified, count(total.qualified)], [salesLabel, count(total.sales)],
        ]} />
      </section>

      <section className="cartao p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><ShieldCheck className="shrink-0 text-marinho" size={20} /> Reserva e pré-escala</h2>
        <div className="mt-3">
          <StatGrid items={[
            ['Saldo no teto planejado', money(diagnosis.remaining)], ['Reserva protegida dentro do saldo', money(diagnosis.protectedReserve)],
            ['Limite sugerido para reteste', money(diagnosis.retestLimit)],
          ]} />
        </div>
        <div className="mt-4 rounded-xl bg-gelo p-3 text-sm">
          <p className="flex gap-2 font-bold"><CircleAlert size={18} className="shrink-0" /> {actionsAvailable ? 'Reteste controlado pode ser avaliado pelo gestor.' : 'Preservar o saldo neste cenário.'}</p>
          {diagnosis.reasons.length > 0 && <ul className="mt-2 ml-5 list-disc space-y-1 text-text-main">{diagnosis.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
          {actionsAvailable && <p className="mt-2">Avalie um novo teste limitado a um CPA-teto e ao saldo disponível fora da reserva. A simulação não projeta retorno.</p>}
        </div>
      </section>
      </div>

      <section className="space-y-3" aria-label="Comparativo por criativo">
        <h2 className="text-lg font-extrabold">Comparativo por criativo</h2>
        <div className="cartao hidden overflow-hidden xl:block">
          <table className="w-full table-fixed text-sm">
            <caption className="sr-only">Indicadores principais dos criativos</caption>
            <thead className="bg-gelo text-left text-xs text-marinho">
              <tr>{['Criativo', 'Gasto', salesLabel, 'CPA', 'ROAS', 'Classificação'].map((title, index) => (
                <th scope="col" className={`px-3 py-3 ${index === 0 ? 'w-[27%] pl-5' : ''}`} key={title}>{title}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map(({ name, metrics, color }) => (
                <tr key={name} className="tabular-nums">
                  <th scope="row" className="break-words py-3 pl-5 pr-3 text-left">{name}</th>
                  {[money(metrics.spend), count(metrics.sales), money(metrics.cpa), rate(metrics.roas, '×')].map((value, index) => <td key={index} className="break-words px-3 py-3">{value}</td>)}
                  <td className="px-3 py-3">{colors[color].title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          {rows.map((row, index) => {
            const m = row.metrics;
            const status = colors[row.color];
            const leads = snapshot.creatives[index].leads ?? [];
            return (
              <article className="cartao min-w-0 space-y-3 p-4 sm:p-5" key={row.name}>
                <div className="flex justify-between gap-2">
                  <div className="min-w-0 break-words">
                    <h3 className="font-extrabold">{row.name}</h3>
                    {[row.group, row.format, row.angle].some(Boolean) && <p className="text-xs text-text-muted">{[row.group, row.format, row.angle].filter(Boolean).join(' · ')}</p>}
                  </div>
                  <span className={`shrink-0 self-start rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${status.style}`}>{status.title}</span>
                </div>
                <StatGrid items={[
                  ['Gasto', money(m.spend)], [salesLabel, count(m.sales)], ['CPA', money(m.cpa)], ['ROAS', rate(m.roas, '×')],
                  [funnel.entry, count(m.entries)], [funnel.qualified, count(m.qualified)], ['Em aberto', count(m.open)],
                  ['Custo por entrada', money(m.costPerEntry)], ['CTR', rate(m.ctr, '%')], ['CPC', money(m.cpc)], ['CPM', money(m.cpm)],
                  [row.revenueEstimated ? 'Receita estimada' : 'Receita atribuída', money(m.revenue)],
                ]} />
                <div className="border-t border-border-subtle pt-3 text-sm">
                  <p className="font-bold">{row.action}</p>
                  <p className="mt-1 text-text-muted">{row.reason}</p>
                  <p className="mt-2 text-xs font-bold text-marinho">{row.evidence}</p>
                </div>
                {leads.length > 0 && <details className="border-t border-border-subtle text-sm">
                  <summary className="min-h-11 cursor-pointer content-center font-bold text-marinho">Contatos acompanhados ({leads.length})</summary>
                  <ul className="divide-y divide-border-subtle">
                    {leads.map(({ contact, stage }, index) => <li key={index} className="flex flex-wrap justify-between gap-2 py-2">
                      <span className="min-w-0 break-words">{contact}</span><span className="text-text-muted">{LEAD_STAGES[stage]}</span>
                    </li>)}
                  </ul>
                </details>}
              </article>
            );
          })}
        </div>
      </section>

      <section className="cartao space-y-3 p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><Sparkles className="shrink-0 text-accent-glow" size={20} /> Interpretação Gemini</h2>
        {advice ? (
          <>
            <p className="break-words text-sm leading-relaxed">{advice.summary}</p>
            <ul className="grid gap-3 xl:grid-cols-2">
              {advice.recommendations.map((item) => {
                const row = rows[item.target - 1];
                const metrics = row?.metrics ?? total;
                return (
                  <li className="min-w-0 break-words rounded-xl border border-border-subtle bg-canvas p-4 text-sm" key={item.target}>
                    <p className="font-bold">{row?.name ?? 'Campanha'}</p>
                    <p className="mt-1 text-xs font-semibold text-marinho">CPA {money(metrics.cpa)} · {count(metrics.sales)} {salesLabel.toLowerCase()} · {row?.evidence ?? (diagnosis.reasons.length ? 'Evidência incompleta' : 'Dados da janela')}</p>
                    <p className="mt-2 text-text-muted">{item.context}</p>
                    <p className="mt-2 font-semibold">{item.action}</p>
                    <p className="mt-1 text-text-muted">{item.rationale}</p>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <>
            <p className="text-sm text-text-muted">{demo ? 'A interpretação está disponível no ambiente conectado.' : 'Peça ao Gemini uma leitura das evidências e dos próximos passos para revisão do gestor.'}</p>
            {adviceError && <Notice>{adviceError}</Notice>}
            {!demo && <button className="btn-primario min-h-11" disabled={busy} onClick={onAdvise}>{busy ? 'Interpretando evidências…' : adviceError ? 'Tentar novamente' : 'Gerar recomendações'}</button>}
          </>
        )}
      </section>
    </div>
  );
}
