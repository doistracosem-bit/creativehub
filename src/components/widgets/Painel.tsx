import React, { useState } from 'react';
import { ArrowRight, Sparkles, AlertTriangle, CalendarCheck, FolderKanban, Clock, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import type { Publication } from '../../types';
import { STATUS_LABEL, STAGE_LABEL } from '../../types';
import { cn } from '../../lib/utils';
import { COR_STATUS, COR_ETAPA } from '../../lib/estilos';
import { fmtHora, fmtDiaRelativo, inicioDoDia, mesmoDia } from '../../lib/datas';
import { Avatar, Vazio } from '../ui/Folha';
import { MARCA } from '../../lib/marca';

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export const Painel: React.FC = () => {
  const { publications, projects } = useApp();
  const { usuario } = useAuth();
  const { abrirPost, abrirProjeto, irPara } = useUI();
  const [soMeus, setSoMeus] = useState(false);

  const agora = Date.now();
  const hoje0 = inicioDoDia(agora);
  const meus = (p: Publication) => !soMeus || p.responsible_email === usuario?.email;
  const posts = publications.filter(meus).sort((a, b) => +new Date(a.scheduled_for) - +new Date(b.scheduled_for));

  const deHoje = posts.filter((p) => mesmoDia(p.scheduled_for, agora));
  const atrasados = posts.filter((p) => p.status !== 'POSTADO' && +new Date(p.scheduled_for) < hoje0);
  const proximos = posts.filter((p) => { const t = +new Date(p.scheduled_for); return t >= hoje0 + 864e5 && t < hoje0 + 8 * 864e5; });
  const ativos = projects.filter((p) => p.stage !== 'CONCLUIDO').sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline));
  const pendentesHoje = deHoje.filter((p) => p.status !== 'POSTADO').length;

  const semana = Array.from({ length: 7 }, (_, i) => hoje0 + i * 864e5);
  const dataHoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-6">
      {/* Destaque */}
      <section className="relative overflow-hidden rounded-[28px] bg-marinho text-white p-6 sm:p-8">
        <div className="absolute -right-16 -top-24 w-80 h-80 rounded-full bg-white/[.06]" />
        <div className="absolute right-44 -bottom-20 w-52 h-52 rounded-full bg-celeste/15" />
        <img src={MARCA.mascote} alt="" className="absolute right-4 sm:right-10 bottom-0 h-36 sm:h-52 w-auto translate-y-6 drop-shadow-[0_20px_30px_rgba(0,0,0,.3)]" />
        <div className="relative max-w-[62%] sm:max-w-xl">
          <p className="text-sm text-white/70 first-letter:uppercase">{dataHoje}</p>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mt-1">{saudacao()}, {usuario?.nome.split(' ')[0]}!</h1>
          <p className="text-white/80 mt-2 text-sm sm:text-base">
            {pendentesHoje ? `Você tem ${pendentesHoje} ${pendentesHoje === 1 ? 'post' : 'posts'} para publicar hoje.` : 'Nenhum post pendente para hoje.'}
          </p>
        </div>
        <div className="relative grid grid-cols-3 gap-2 sm:gap-3 mt-6 max-w-[70%] sm:max-w-lg">
          <Numero icone={CalendarCheck} valor={deHoje.length} rotulo="Hoje" />
          <Numero icone={AlertTriangle} valor={atrasados.length} rotulo="Atrasados" alerta={atrasados.length > 0} />
          <Numero icone={FolderKanban} valor={ativos.length} rotulo="Projetos" />
        </div>
      </section>

      <div className="flex items-center justify-between">
        <div className="inline-flex p-1 rounded-xl bg-surface border border-border-subtle">
          {[['Equipe', false], ['Só meus', true]].map(([l, v]) => (
            <button key={String(l)} onClick={() => setSoMeus(v as boolean)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-semibold cursor-pointer', soMeus === v ? 'bg-marinho text-white' : 'text-text-muted')}>{l}</button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          {atrasados.length > 0 && (
            <Bloco titulo="Atrasados" contador={atrasados.length} alerta>
              {atrasados.map((p) => <LinhaPost key={p.id} post={p} mostrarDia aoAbrir={() => abrirPost(p.id)} />)}
            </Bloco>
          )}

          <Bloco titulo="Publicações de hoje" contador={deHoje.length}>
            {deHoje.length ? deHoje.map((p) => <LinhaPost key={p.id} post={p} aoAbrir={() => abrirPost(p.id)} />)
              : <Vazio texto="Nada agendado para hoje." acao={<button className="btn-secundario !py-2 mt-1" onClick={() => { const d = new Date(); d.setHours(18, 0, 0, 0); abrirPost(null, { scheduled_for: d.toISOString(), status: 'AGENDADO' }); }}>Agendar um post</button>} />}
          </Bloco>

          <Bloco titulo="Próximos 7 dias" contador={proximos.length} acao={<button onClick={() => irPara('calendar')} className="text-sm font-semibold text-accent-glow inline-flex items-center gap-1 cursor-pointer">Calendário <ArrowRight className="w-4 h-4" /></button>}>
            {proximos.length ? proximos.map((p) => <LinhaPost key={p.id} post={p} mostrarDia aoAbrir={() => abrirPost(p.id)} />)
              : <Vazio texto="Semana livre por enquanto." compacto />}
          </Bloco>
        </div>

        <div className="space-y-6 min-w-0">
          {/* Semana */}
          <section className="cartao p-5">
            <h2 className="font-bold text-text-main mb-4">Sua semana</h2>
            <div className="grid grid-cols-7 gap-1.5">
              {semana.map((t) => {
                const lista = posts.filter((p) => mesmoDia(p.scheduled_for, t));
                const d = new Date(t);
                return (
                  <button key={t} onClick={() => irPara('calendar')}
                    className={cn('rounded-2xl py-2.5 flex flex-col items-center gap-1 cursor-pointer transition-colors', t === hoje0 ? 'bg-marinho text-white' : 'bg-canvas hover:bg-gelo text-text-main')}>
                    <span className={cn('text-[10px] font-semibold uppercase', t === hoje0 ? 'text-white/70' : 'text-text-muted')}>{d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
                    <span className="text-base font-bold leading-none">{d.getDate()}</span>
                    <span className="flex gap-0.5 h-1.5">{lista.slice(0, 3).map((p) => <i key={p.id} className={cn('w-1.5 h-1.5 rounded-full', t === hoje0 ? 'bg-celeste' : COR_STATUS[p.status].ponto)} />)}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Projetos */}
          <section className="cartao p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-text-main">Projetos em andamento</h2>
              <button onClick={() => irPara('projects')} className="text-sm font-semibold text-accent-glow inline-flex items-center gap-1 cursor-pointer">Ver todos <ArrowRight className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {ativos.slice(0, 4).map((p) => {
                const dias = Math.round((inicioDoDia(p.deadline) - hoje0) / 864e5);
                return (
                  <button key={p.id} onClick={() => abrirProjeto(p)} className="w-full text-left p-3.5 rounded-2xl border border-border-subtle hover:border-celeste hover:bg-surface-hover transition-colors cursor-pointer">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-accent-glow truncate">{p.client_name}</span>
                      <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', COR_ETAPA[p.stage])}>{STAGE_LABEL[p.stage]}</span>
                    </div>
                    <p className="text-sm font-semibold text-text-main mt-1 truncate">{p.project_name}</p>
                    <div className="flex items-center gap-3 mt-2.5">
                      <div className="flex-1 h-1.5 rounded-full bg-canvas overflow-hidden"><div className="h-full rounded-full bg-accent-glow" style={{ width: `${p.progress}%` }} /></div>
                      <span className="text-xs font-semibold text-text-main">{p.progress}%</span>
                      <span className={cn('text-xs font-semibold', dias < 0 ? 'text-red-600' : dias <= 3 ? 'text-amber-700' : 'text-text-muted')}>
                        {dias < 0 ? `${-dias}d atrasado` : dias === 0 ? 'Entrega hoje' : `${dias}d`}
                      </span>
                    </div>
                  </button>
                );
              })}
              {ativos.length === 0 && <Vazio texto="Nenhum projeto ativo." compacto />}
            </div>
          </section>

          {/* Copilot */}
          <button onClick={() => irPara('ai-copilot')} className="w-full text-left cartao p-5 bg-gradient-to-br from-gelo to-white hover:border-celeste transition-colors cursor-pointer group">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-glow"><Sparkles className="w-4 h-4" />Copilot IA</span>
            <p className="font-bold text-text-main mt-1.5">Gere briefings, ganchos e carrosséis em segundos</p>
            <span className="text-sm font-semibold text-marinho inline-flex items-center gap-1 mt-3 group-hover:gap-2 transition-all">Abrir laboratório de ideias <ArrowRight className="w-4 h-4" /></span>
          </button>
        </div>
      </div>
    </div>
  );
};

function Numero({ icone: Icone, valor, rotulo, alerta }: { icone: React.ElementType; valor: number; rotulo: string; alerta?: boolean }) {
  return (
    <div className={cn('rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 backdrop-blur', alerta ? 'bg-amber-400/20' : 'bg-white/10')}>
      <Icone className={cn('w-4 h-4', alerta ? 'text-amber-300' : 'text-celeste')} />
      <p className="text-xl sm:text-2xl font-bold mt-1 leading-none">{valor}</p>
      <p className="text-[11px] sm:text-xs text-white/70 mt-1">{rotulo}</p>
    </div>
  );
}

function Bloco({ titulo, contador, alerta, acao, children }: { titulo: string; contador?: number; alerta?: boolean; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <h2 className={cn('font-bold', alerta ? 'text-red-700' : 'text-text-main')}>{titulo}</h2>
        {contador !== undefined && <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', alerta ? 'bg-red-50 text-red-700' : 'bg-surface text-text-muted border border-border-subtle')}>{contador}</span>}
        <span className="flex-1" />{acao}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function LinhaPost({ post, aoAbrir, mostrarDia }: { post: Publication; aoAbrir: () => void; mostrarDia?: boolean }) {
  const { memberName, updatePublicationStatus } = useApp();
  const postado = post.status === 'POSTADO';
  const atrasado = !postado && +new Date(post.scheduled_for) < Date.now();
  return (
    <div onClick={aoAbrir} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && aoAbrir()}
      className={cn('flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-surface border shadow-suave cursor-pointer transition-all hover:-translate-y-0.5',
        atrasado ? 'border-red-200' : 'border-transparent hover:border-celeste')}>
      <button
        onClick={(e) => { e.stopPropagation(); updatePublicationStatus(post.id, postado ? 'AGENDADO' : 'POSTADO'); }}
        aria-label={postado ? 'Desmarcar publicado' : 'Marcar como publicado'}
        className={cn('w-6 h-6 rounded-lg border-2 grid place-items-center shrink-0 transition-colors cursor-pointer',
          postado ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-[#c4d3e8] hover:border-emerald-500')}>
        {postado && <CheckCircle2 className="w-4 h-4" />}
      </button>
      <div className="w-14 shrink-0">
        {mostrarDia && <p className={cn('text-[11px] font-semibold', atrasado ? 'text-red-600' : 'text-text-muted')}>{fmtDiaRelativo(post.scheduled_for)}</p>}
        <p className="text-base font-bold text-text-main leading-tight flex items-center gap-1">{!mostrarDia && <Clock className="w-3.5 h-3.5 text-text-muted" />}{fmtHora(post.scheduled_for)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-semibold truncate', postado ? 'line-through text-text-muted' : 'text-text-main')}>{post.headline}</p>
        <p className="text-xs text-text-muted truncate">{post.client_name} · {post.format}</p>
      </div>
      <span className={cn('hidden sm:inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full border', atrasado ? 'bg-red-50 text-red-700 border-red-200' : COR_STATUS[post.status].chip)}>
        {atrasado ? 'Atrasado' : STATUS_LABEL[post.status]}
      </span>
      <Avatar nome={memberName(post.responsible_email)} tamanho={28} />
    </div>
  );
}
