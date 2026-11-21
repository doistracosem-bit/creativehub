import { ArrowUpRight, CalendarPlus } from 'lucide-react';
import { TIKTOK_DAYS, TIKTOK_TIMEZONES, tiktokHour } from '../../../../supabase/functions/_shared/tiktok';
import type { TikTokReport as Report } from '../../../../supabase/functions/_shared/tiktok';
import { mondayFirst, tableClass } from './TikTokResearch';

type Slot = Report['metrics']['slots'][number];
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const metric = (value: number | null) => value === null ? '—' : number.format(value);
const percent = (value: number | null) => value === null ? '—' : metric(value) + '%';

export function TikTokReport({ report, draft }: { report: Report; draft: (slot: Slot) => void }) {
  const { input, metrics } = report;
  const zone = TIKTOK_TIMEZONES[input.timezone];
  const hours = [...new Set(metrics.slots.map((slot) => slot.hour))].sort((a, b) => a - b);
  const grid = new Map(metrics.slots.map((slot) => [slot.day * 24 + slot.hour, slot]));
  const links = input.posts.filter((post) => post.url !== null);
  return (
    <div className="space-y-5">
      <section className="cartao min-w-0 p-4 sm:p-6">
        <h2 className="break-all text-xl font-extrabold text-marinho">{input.handle}</h2>
        <p className="mt-1 text-sm text-text-muted">{zone} · Referência {input.reference.split('-').reverse().join('/')} · {
          input.mode === 'seven-day' ? 'Métricas dos primeiros 7 dias' : 'Métricas acumuladas'}</p>
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(145px,1fr))] gap-3">
          {metrics.periods.map((period) => <article key={period.days} className="rounded-2xl bg-canvas p-3">
            <h3 className="text-xs font-bold text-text-muted">Últimos {period.days} dias</h3>
            <p className="mt-1 text-2xl font-extrabold text-marinho">{metric(period.medianViews)}</p>
            <p className="text-xs text-text-muted">Mediana de visualizações · n={period.count}</p>
            <p className="mt-2 text-xs text-text-muted">Média {metric(period.meanViews)} · Desvio mediano {metric(period.dispersion)}</p>
            <p className="text-xs text-text-muted">Engajamento {percent(period.engagement)} · Virais {percent(period.viralRate)} ({period.classified} classificados)</p>
          </article>)}
        </div>
        <p className="mt-3 text-xs text-text-muted">{metrics.excluded} publicações fora do cálculo por impulsionamento, período ou tempo de maturação.</p>
      </section>

      <section className="cartao min-w-0 p-4 sm:p-6">
        <h3 className="text-lg font-extrabold text-marinho">Faixas observadas</h3>
        <p className="mt-1 text-sm text-text-muted">Até cinco faixas, em ordem de VPS, desempenho relativo e mediana de visualizações. Faixas com evidência insuficiente servem para exploração.</p>
        <ol className="mt-4 divide-y divide-border-subtle">{metrics.slots.slice(0, 5).map((slot) => (
          <li key={`${slot.day}-${slot.hour}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="min-w-0">
              <p className="font-extrabold text-marinho">{TIKTOK_DAYS[slot.day]} · {tiktokHour(slot.hour)}</p>
              <p className="mt-0.5 text-xs text-text-muted">{slot.count} posts em {slot.dates} datas · Evidência {slot.confidence} · Mediana {metric(slot.medianViews)} · VPS {metric(slot.vps)}</p>
            </div>
            <button type="button" className="btn-secundario min-h-11" onClick={() => draft(slot)}><CalendarPlus size={15} /> Preparar pauta</button>
          </li>
        ))}</ol>
        <details className="mt-3 rounded-xl bg-canvas p-3 text-sm text-text-muted">
          <summary className="cursor-pointer font-bold text-marinho">Como o VPS é calculado</summary>
          <p className="mt-2">O VPS parcial vai de 0 a 100 e compara faixas do histórico. Ele combina desempenho relativo (25), frequência de virais (20), engajamento (10) e consistência (10), reescalados de 65 para 100. Atividade da audiência, concorrência, tendências e nicho exigem dados adicionais.</p>
          <p className="mt-2">Um post é classificado como viral a partir de 3× a mediana de pelo menos cinco outros posts do mesmo formato, na mesma janela de 7 dias de medição. A pontuação exige pelo menos três datas na faixa e métricas completas de curtidas, comentários e compartilhamentos. A evidência passa a moderada a partir de oito posts classificáveis em quatro datas. Isso mede cobertura do histórico, sem estimar probabilidade nem causalidade.</p>
        </details>
      </section>

      <section className="cartao min-w-0 p-4 sm:p-6">
        <h3 className="text-lg font-extrabold text-marinho">Mapa semanal da conta</h3>
        <p className="mt-1 text-sm text-text-muted">Cada célula mostra a mediana de visualizações e o número de publicações da faixa.</p>
        <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Mapa semanal da conta">
          <table className={tableClass}>
            <thead><tr><th scope="col">Hora</th>{mondayFirst.map((day) => <th scope="col" className="text-center" key={day}>{TIKTOK_DAYS[day].slice(0, 3)}</th>)}</tr></thead>
            <tbody>{hours.map((hour) => <tr key={hour}>
              <th scope="row">{tiktokHour(hour)}</th>
              {mondayFirst.map((day) => {
                const slot = grid.get(day * 24 + hour);
                return <td className="text-center" key={day}>{slot ? (
                  <span className={`block rounded-lg px-1 py-1.5 ${slot.confidence === 'moderada' ? 'bg-marinho text-white' : 'bg-gelo text-marinho'}`}>
                    <b>{metric(slot.medianViews)}</b><span className="block text-xs">n={slot.count}</span>
                  </span>
                ) : '–'}</td>;
              })}
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="cartao min-w-0 p-4 sm:p-6">
        <h3 className="text-lg font-extrabold text-marinho">Resultado por formato</h3>
        <ul className="mt-3 divide-y divide-border-subtle">{metrics.formats.map((format) => (
          <li key={format.name} className="break-words py-2 text-sm"><b className="text-marinho">{format.name}</b>
            <span className="block text-text-muted">n={format.count} · Mediana {metric(format.medianViews)} · Engajamento {percent(format.engagement)} · Virais {percent(format.viralRate)}</span></li>
        ))}</ul>
        {links.length > 0 && <details className="mt-3 rounded-xl bg-canvas p-3">
          <summary className="cursor-pointer text-sm font-bold text-marinho">Links das publicações informadas ({links.length})</summary>
          <ul className="mt-2 max-h-52 space-y-2 overflow-y-auto">{links.map((post) => <li key={post.url}>
            <a className="inline-flex items-center gap-1 break-words text-sm text-marinho underline" href={post.url!} target="_blank" rel="noreferrer">
              {post.format} · {post.published.replace('T', ' ')}<ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </li>)}</ul>
        </details>}
      </section>
    </div>
  );
}
