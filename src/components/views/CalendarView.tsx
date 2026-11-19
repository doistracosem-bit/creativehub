import React, { useMemo, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, LayoutGrid, CalendarDays, ArrowRight, Clock, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import type { Publication, PublicationStatus } from '../../types';
import { STATUS_LABEL } from '../../types';
import { cn } from '../../lib/utils';
import { COR_STATUS } from '../../lib/estilos';
import { fmtHora, fmtDiaRelativo, inicioDoDia, mesmoDia } from '../../lib/datas';
import { Avatar, Vazio } from '../ui/Folha';

interface CalendarViewProps {
  onNewPost: () => void;
}

const COLUNAS: PublicationStatus[] = ['IDEIA', 'CRIANDO', 'APROVADO', 'AGENDADO', 'POSTADO'];
const PROXIMO: Record<PublicationStatus, PublicationStatus> = { IDEIA: 'CRIANDO', CRIANDO: 'APROVADO', APROVADO: 'AGENDADO', AGENDADO: 'POSTADO', POSTADO: 'POSTADO' };
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const CalendarView: React.FC<CalendarViewProps> = ({ onNewPost }) => {
  const { publications, updatePublicationStatus } = useApp();
  const { usuario } = useAuth();
  const { abrirPost } = useUI();
  const [visao, setVisao] = useState<'quadro' | 'mes'>('quadro');
  const [formato, setFormato] = useState('ALL');
  const [soMeus, setSoMeus] = useState(false);

  const filtrados = publications
    .filter((p) => formato === 'ALL' || p.format.toLowerCase().includes(formato.toLowerCase()))
    .filter((p) => !soMeus || p.responsible_email === usuario?.email);

  return (
    <div className="space-y-5">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-main tracking-tight">Calendário de publicações</h1>
          <p className="text-sm text-text-muted mt-1">Toque em um post para ver tudo sobre ele, editar ou excluir.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 rounded-xl bg-surface border border-border-subtle">
            {([['quadro', 'Quadro', LayoutGrid], ['mes', 'Mês', CalendarDays]] as const).map(([id, label, Icone]) => (
              <button key={id} onClick={() => setVisao(id)}
                className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer',
                  visao === id ? 'bg-marinho text-white shadow-sm' : 'text-text-muted hover:text-text-main')}>
                <Icone className="w-4 h-4" />{label}
              </button>
            ))}
          </div>
          <select value={formato} onChange={(e) => setFormato(e.target.value)} className="campo !w-auto !py-2 text-sm">
            <option value="ALL">Todos os formatos</option>
            <option value="Carrossel">Carrossel</option>
            <option value="Reels">Reels / TikTok</option>
            <option value="Post">Post estático</option>
            <option value="Stor">Stories</option>
          </select>
          <button onClick={() => setSoMeus(!soMeus)}
            className={cn('px-3 py-2 rounded-xl text-sm font-semibold border transition-all cursor-pointer',
              soMeus ? 'bg-gelo border-[#c7dbf5] text-marinho' : 'bg-surface border-border-subtle text-text-muted hover:text-text-main')}>
            Só meus
          </button>
          <button onClick={onNewPost} className="btn-primario hidden sm:inline-flex"><Plus className="w-4 h-4" />Novo post</button>
        </div>
      </header>

      {visao === 'quadro'
        ? <Quadro posts={filtrados} abrir={(id) => abrirPost(id)} avancar={updatePublicationStatus} novo={(status) => abrirPost(null, { status })} />
        : <Mes posts={filtrados} abrir={(id) => abrirPost(id)} novo={(dia) => { const d = new Date(dia); d.setHours(10, 0, 0, 0); abrirPost(null, { scheduled_for: d.toISOString(), status: 'AGENDADO' }); }} />}
    </div>
  );
};

/* ---------------- QUADRO (kanban) ---------------- */

function Quadro({ posts, abrir, avancar, novo }: {
  posts: Publication[]; abrir: (id: string) => void;
  avancar: (id: string, s: PublicationStatus) => Promise<void>; novo: (s: PublicationStatus) => void;
}) {
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<PublicationStatus | null>(null);

  return (
    <div className="flex lg:grid lg:grid-cols-5 gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 pb-2">
      {COLUNAS.map((col) => {
        const lista = posts.filter((p) => p.status === col).sort((a, b) => +new Date(a.scheduled_for) - +new Date(b.scheduled_for));
        return (
          <section key={col}
            onDragOver={(e) => { e.preventDefault(); setSobre(col); }}
            onDragLeave={() => setSobre(null)}
            onDrop={() => { if (arrastando) avancar(arrastando, col); setArrastando(null); setSobre(null); }}
            className={cn('snap-start shrink-0 w-[82vw] sm:w-72 lg:w-auto rounded-3xl p-2.5 flex flex-col gap-2 transition-colors min-h-[360px]',
              sobre === col ? 'bg-gelo ring-2 ring-celeste' : 'bg-[#e3ecf8]/70')}>
            <h2 className="flex items-center gap-2 px-2 pt-1.5 pb-1 text-sm font-bold text-text-main">
              <span className={cn('w-2 h-2 rounded-full', COR_STATUS[col].ponto)} />
              {STATUS_LABEL[col]}
              <span className="ml-auto text-xs font-semibold text-text-muted bg-surface rounded-full px-2 py-0.5">{lista.length}</span>
            </h2>
            {lista.map((p) => (
              <CartaoPost key={p.id} post={p} abrir={abrir} avancar={avancar} onDragStart={() => setArrastando(p.id)} />
            ))}
            {lista.length === 0 && <p className="text-xs text-text-muted text-center py-6 border border-dashed border-[#cfdcef] rounded-2xl">Nada por aqui</p>}
            <button onClick={() => novo(col)} className="mt-auto w-full py-2 rounded-2xl text-xs font-semibold text-text-muted hover:text-marinho hover:bg-surface transition-colors inline-flex items-center justify-center gap-1 cursor-pointer">
              <Plus className="w-3.5 h-3.5" />Adicionar
            </button>
          </section>
        );
      })}
    </div>
  );
}

function CartaoPost({ post, abrir, avancar, onDragStart }: {
  post: Publication; abrir: (id: string) => void;
  avancar: (id: string, s: PublicationStatus) => Promise<void>; onDragStart: () => void;
}) {
  const { memberName } = useApp();
  const atrasado = post.status !== 'POSTADO' && new Date(post.scheduled_for).getTime() < Date.now();
  return (
    <article
      draggable onDragStart={onDragStart}
      onClick={() => abrir(post.id)}
      onKeyDown={(e) => e.key === 'Enter' && abrir(post.id)}
      tabIndex={0} role="button"
      className="group bg-surface rounded-2xl p-3.5 shadow-suave border border-transparent hover:border-celeste cursor-pointer transition-all hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-glow"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-accent-glow truncate">{post.client_name}</span>
        <span className="text-[11px] text-text-muted shrink-0">{post.format.split(' ')[0]}</span>
      </div>
      <h3 className="text-sm font-semibold text-text-main leading-snug mt-1.5 line-clamp-2">{post.headline}</h3>
      <div className="flex items-center gap-1.5 mt-3">
        <span className={cn('inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap min-w-0 truncate', atrasado ? 'text-red-600' : 'text-text-muted')}>
          <Clock className="w-3.5 h-3.5 shrink-0" />{fmtDiaRelativo(post.scheduled_for).replace(/^[^,]+, /, '')} · {fmtHora(post.scheduled_for)}
        </span>
        {post.assets_ready && <span title="Arte pronta"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /></span>}
        <span className="flex-1" />
        <Avatar nome={memberName(post.responsible_email)} tamanho={24} />
        {post.status !== 'POSTADO' && (
          <button
            onClick={(e) => { e.stopPropagation(); avancar(post.id, PROXIMO[post.status]); }}
            title={`Mover para ${STATUS_LABEL[PROXIMO[post.status]]}`}
            className="w-7 h-7 shrink-0 rounded-full grid place-items-center text-text-muted bg-canvas hover:bg-marinho hover:text-white transition-colors cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}

/* ---------------- MÊS ---------------- */

function Mes({ posts, abrir, novo }: { posts: Publication[]; abrir: (id: string) => void; novo: (dia: number) => void }) {
  const hoje = new Date();
  const [mes, setMes] = useState({ a: hoje.getFullYear(), m: hoje.getMonth() });
  const [dia, setDia] = useState(inicioDoDia(hoje));

  const dias = useMemo(() => {
    const primeiro = new Date(mes.a, mes.m, 1);
    return Array.from({ length: 42 }, (_, i) => new Date(mes.a, mes.m, 1 - primeiro.getDay() + i).getTime());
  }, [mes]);
  const porDia = useMemo(() => {
    const m: Record<number, Publication[]> = {};
    posts.forEach((p) => { (m[inicioDoDia(p.scheduled_for)] ||= []).push(p); });
    Object.values(m).forEach((l) => l.sort((a, b) => +new Date(a.scheduled_for) - +new Date(b.scheduled_for)));
    return m;
  }, [posts]);

  const mover = (d: number) => setMes(({ a, m }) => { const n = new Date(a, m + d, 1); return { a: n.getFullYear(), m: n.getMonth() }; });
  const nomeMes = new Date(mes.a, mes.m, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const doDia = porDia[dia] || [];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
      <div className="cartao p-3 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => mover(-1)} className="w-9 h-9 rounded-full grid place-items-center hover:bg-gelo cursor-pointer" aria-label="Mês anterior"><ChevronLeft className="w-5 h-5" /></button>
          <h2 className="text-lg font-bold text-text-main first-letter:uppercase min-w-[160px] text-center">{nomeMes}</h2>
          <button onClick={() => mover(1)} className="w-9 h-9 rounded-full grid place-items-center hover:bg-gelo cursor-pointer" aria-label="Próximo mês"><ChevronRight className="w-5 h-5" /></button>
          <button onClick={() => { setMes({ a: hoje.getFullYear(), m: hoje.getMonth() }); setDia(inicioDoDia(hoje)); }} className="btn-fantasma !py-1.5 ml-auto">Hoje</button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {DIAS.map((d) => <div key={d} className="text-[11px] font-semibold text-text-muted text-center pb-1">{d}</div>)}
          {dias.map((t) => {
            const lista = porDia[t] || [];
            const fora = new Date(t).getMonth() !== mes.m;
            const ehHoje = mesmoDia(t, hoje);
            return (
              <div key={t} onClick={() => setDia(t)} onDoubleClick={() => novo(t)} role="button" tabIndex={0}
                className={cn('min-w-0 rounded-xl p-1 sm:p-1.5 cursor-pointer transition-colors aspect-square sm:aspect-auto sm:min-h-[104px] flex flex-col items-center sm:items-stretch border',
                  t === dia ? 'border-marinho bg-gelo/60' : 'border-transparent bg-canvas/50 hover:bg-gelo/70', fora && 'opacity-40')}>
                <span className={cn('text-xs sm:text-[13px] font-semibold w-6 h-6 grid place-items-center rounded-full sm:self-start',
                  ehHoje ? 'bg-marinho text-white' : 'text-text-main')}>{new Date(t).getDate()}</span>
                {/* celular: pontinhos */}
                <span className="flex gap-0.5 mt-1 sm:hidden">{lista.slice(0, 3).map((p) => <i key={p.id} className={cn('w-1.5 h-1.5 rounded-full', COR_STATUS[p.status].ponto)} />)}</span>
                {/* computador: títulos */}
                <span className="hidden sm:flex flex-col gap-0.5 mt-1 min-w-0">
                  {lista.slice(0, 3).map((p) => (
                    <button key={p.id} onClick={(e) => { e.stopPropagation(); abrir(p.id); }}
                      className={cn('text-left text-[11px] leading-tight px-1.5 py-1 rounded-md truncate border cursor-pointer hover:brightness-95', COR_STATUS[p.status].chip, p.status === 'POSTADO' && 'line-through opacity-70')}>
                      <b className="font-semibold">{fmtHora(p.scheduled_for)}</b> {p.headline}
                    </button>
                  ))}
                  {lista.length > 3 && <span className="text-[11px] text-text-muted pl-1">+{lista.length - 3} mais</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <aside className="cartao p-4 sm:p-5 xl:sticky xl:top-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-text-main">{fmtDiaRelativo(new Date(dia).toISOString())}</h3>
          <button onClick={() => novo(dia)} className="btn-fantasma !py-1.5 !text-accent-glow"><Plus className="w-4 h-4" />Agendar</button>
        </div>
        <div className="space-y-2">
          {doDia.length ? doDia.map((p) => (
            <button key={p.id} onClick={() => abrir(p.id)} className="w-full text-left flex items-center gap-3 p-3 rounded-2xl border border-border-subtle hover:border-celeste hover:bg-surface-hover transition-colors cursor-pointer">
              <span className="text-sm font-bold text-text-main w-11 shrink-0">{fmtHora(p.scheduled_for)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-text-main truncate">{p.headline}</span>
                <span className="block text-xs text-text-muted truncate">{p.client_name} · {p.format}</span>
              </span>
              <span className={cn('w-2 h-2 rounded-full shrink-0', COR_STATUS[p.status].ponto)} />
            </button>
          )) : <Vazio texto="Nenhum post neste dia." compacto />}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-4 text-[11px] text-text-muted">
          {COLUNAS.map((s) => <span key={s} className="inline-flex items-center gap-1"><i className={cn('w-1.5 h-1.5 rounded-full', COR_STATUS[s].ponto)} />{STATUS_LABEL[s]}</span>)}
        </div>
      </aside>
    </div>
  );
}
