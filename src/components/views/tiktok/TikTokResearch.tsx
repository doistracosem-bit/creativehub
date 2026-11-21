import { ArrowUpRight, CalendarPlus } from 'lucide-react';
import { TIKTOK_DAYS, tiktokHour } from '../../../../supabase/functions/_shared/tiktok';
import { researchCalendar, researchHeat, researchSlots, researchSources } from '../../../lib/tiktokResearch';
import { Field } from '../traffic/TrafficForms';
import { useState } from 'react';
import type { Client } from '../../../types';

export const mondayFirst = [1, 2, 3, 4, 5, 6, 0];
export const tableClass = 'w-full min-w-[500px] text-left text-sm [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2';

export function TikTokResearch({ clients, draft }: { clients: Client[]; draft: (client: Client, day: number, hour: number, format: string) => void }) {
  const [clientId, setClientId] = useState('');
  const client = clients.find((item) => item.id === clientId);
  const [ideaIndex, setIdeaIndex] = useState(0);
  const idea = researchSlots[ideaIndex];

  return (
    <div className="space-y-5">
      <section className="cartao p-4 sm:p-6">
        <h2 className="text-lg font-extrabold text-marinho">Horários para testar</h2>
        <p className="mt-1 max-w-3xl text-sm text-text-muted">Referências internacionais de 2026 aplicadas como hipóteses no horário de Brasília. Os estudos divulgam amostras gerais, sem contagem por faixa. Quarta à noite é o primeiro teste e domingo é onde os resultados mais divergem.</p>
        <ol className="mt-4 divide-y divide-border-subtle">
          {researchSlots.map((slot) => (
            <li key={`${slot.day}-${slot.hour}`} className="grid gap-1 py-3 md:grid-cols-[11rem_1fr] md:gap-4">
              <div>
                <p className="font-extrabold text-marinho">{TIKTOK_DAYS[slot.day]} · {tiktokHour(slot.hour)}</p>
                <p className="text-xs text-text-muted">Confiança {slot.confidence.toLowerCase()}</p>
              </div>
              <div className="min-w-0 text-sm text-text-muted">
                <p>{slot.reason}</p>
                <p className="mt-0.5 text-xs">{slot.format} · {slot.sources.map((id) => researchSources.find((source) => source.id === id)?.name).join(' · ')}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="cartao min-w-0 p-4 sm:p-6">
        <h2 className="text-lg font-extrabold text-marinho">Mapa semanal</h2>
        <p className="mt-1 text-sm text-text-muted">Número de fontes que destacam pelo menos um horário na faixa. Role a tabela para ver todos os dias.</p>
        <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Mapa semanal de estudos">
          <table className={tableClass}>
            <thead><tr><th scope="col">Faixa</th>{mondayFirst.map((day) => <th scope="col" className="text-center" key={day}>{TIKTOK_DAYS[day].slice(0, 3)}</th>)}</tr></thead>
            <tbody>{researchHeat.map((row) => <tr key={row.label}>
              <th scope="row" className="whitespace-nowrap text-text-muted">{row.label}</th>
              {row.sources.map((source, index) => <td key={index} className="text-center">
                <span className={`inline-grid size-8 place-items-center rounded-lg text-xs font-bold ${source.length > 1 ? 'bg-marinho text-white' : 'bg-gelo text-marinho'}`}
                  title={researchSources.filter(({ id }) => source.includes(id)).map(({ name }) => name).join(', ') || 'Sem destaque'}>{source.length || '–'}</span>
              </td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <section className="cartao min-w-0 space-y-3 p-4 sm:p-6">
          <h2 className="text-lg font-extrabold text-marinho">Experimento de 30 dias</h2>
          <table className="w-full text-left text-xs sm:text-sm [&_td]:py-2 [&_th]:py-2">
            <thead><tr><th scope="col">Semana</th><th scope="col">Quarta</th><th scope="col">Sexta</th><th scope="col">Domingo</th></tr></thead>
            <tbody className="divide-y divide-border-subtle">{researchCalendar.map((week, index) => (
              <tr key={index}><th scope="row">{index + 1}</th>{week.map((hour, day) => <td key={day}>{tiktokHour(hour)}</td>)}</tr>
            ))}</tbody>
          </table>
          <p className="text-sm text-text-muted">Compare posts orgânicos de tema e formato semelhantes. Registre as visualizações em 24 horas e 7 dias. Use a mediana de 7 dias e confira se o resultado depende de um único vídeo.</p>
        </section>
        <section className="cartao min-w-0 space-y-3 p-4 sm:p-6">
          <h2 className="text-lg font-extrabold text-marinho">Levar um teste ao calendário</h2>
          <p className="text-sm text-text-muted">Abra uma ideia com a próxima data para a equipe revisar e salvar.</p>
          <Field label="Cliente da pauta"><select className="campo" value={clientId} onChange={(event) => setClientId(event.target.value)}>
            <option value="">Selecione o cliente</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></Field>
          <Field label="Horário para testar"><select className="campo" value={ideaIndex} onChange={(event) => setIdeaIndex(Number(event.target.value))}>
            {researchSlots.map((slot, index) => <option key={index} value={index}>{TIKTOK_DAYS[slot.day]} às {tiktokHour(slot.hour)}</option>)}
          </select></Field>
          <button className="btn-secundario min-h-11" type="button" disabled={!client}
            onClick={() => { if (client) draft(client, idea.day, idea.hour, idea.format); }}>
            <CalendarPlus size={16} /> Preparar pauta
          </button>
        </section>
      </div>

      <section className="cartao p-4 sm:p-6">
        <h2 className="text-lg font-extrabold text-marinho">Fontes e limites</h2>
        <ul className="mt-3 grid gap-3 lg:grid-cols-3">{researchSources.map((source) => (
          <li key={source.id} className="rounded-2xl border border-border-subtle p-3 text-sm text-text-muted">
            <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-marinho underline-offset-2 hover:underline">
              {source.name}<ArrowUpRight size={14} aria-hidden="true" />
            </a>
            <p className="mt-1 text-xs">{source.date} · {source.base}</p><p className="mt-2">{source.signal}</p>
          </li>
        ))}</ul>
        <p className="mt-4 text-sm text-text-muted">Quinta às 13h e quarta às 22h são alternativas para outra rodada. O VPS fica indisponível na pesquisa geral porque os estudos não divulgam os dados por faixa necessários para calculá-lo.</p>
      </section>
    </div>
  );
}
