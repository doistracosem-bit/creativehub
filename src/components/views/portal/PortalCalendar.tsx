import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PortalPost } from '../../../services/portalService';

const zone = 'America/Sao_Paulo';
export const portalDateKey = (value = new Date().toISOString()) => new Intl.DateTimeFormat('sv-SE', { timeZone: zone }).format(new Date(value));
export const portalDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: zone, day: '2-digit', month: 'short' }).format(new Date(value));
const dayKey = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export function postState(post: PortalPost): [string, string] {
  if (post.published_at && post.shared_at) return ['Publicado', 'bg-emerald-50 text-emerald-900'];
  if (post.published_at) return ['Publicação antiga', 'bg-slate-100 text-slate-800'];
  if (!post.shared_at) return ['Rascunho', 'bg-slate-100 text-slate-800'];
  if (post.rejection) return ['Recusado', 'bg-red-50 text-red-900'];
  if (post.released_at) return ['Pronto para publicar', 'bg-emerald-50 text-emerald-900'];
  if (post.art_status === 'changes' || post.caption_status === 'changes') return ['Alterações solicitadas', 'bg-amber-50 text-amber-900'];
  if (post.art_status === 'approved' && post.caption_status === 'approved') return ['Revisão final', 'bg-gelo text-marinho'];
  return ['Aguardando aprovação', 'bg-amber-50 text-amber-900'];
}

export function PortalBadge({ post }: { post: PortalPost }) {
  const [label, colors] = postState(post);
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${colors}`}>{label}</span>;
}

export function PortalCalendar({ posts, open }: { posts: PortalPost[]; open: (post: PortalPost) => void }) {
  const [day, setDay] = useState(portalDateKey);
  const [month, setMonth] = useState(() => new Date(`${portalDateKey().slice(0, 7)}-01T12:00:00Z`));
  const year = month.getUTCFullYear();
  const index = month.getUTCMonth();
  const start = (month.getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
  const byDate = new Map<string, PortalPost[]>();
  posts.filter((post) => post.shared_at).forEach((post) => {
    const key = portalDateKey(post.published_at ?? post.scheduled_at);
    byDate.set(key, [...(byDate.get(key) ?? []), post]);
  });
  const selected = byDate.get(day) ?? [];
  function move(step: number) {
    const target = new Date(Date.UTC(year, index + step, 1, 12));
    setMonth(target);
    setDay(dayKey(target.getUTCFullYear(), target.getUTCMonth(), 1));
  }
  return (
    <section className="cartao min-w-0 space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-extrabold capitalize">{new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(month)}</h2>
        <div className="flex gap-2">
          <button className="btn-secundario min-h-11 min-w-11 !px-2" aria-label="Mês anterior" onClick={() => move(-1)}><ChevronLeft size={18} /></button>
          <button className="btn-secundario min-h-11 min-w-11 !px-2" aria-label="Próximo mês" onClick={() => move(1)}><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map((label) => <p className="text-center text-xs font-bold text-text-muted" key={label}>{label}</p>)}
        {Array.from({ length: start }, (_, i) => <span key={`empty-${i}`} />)}
        {Array.from({ length }, (_, i) => {
          const key = dayKey(year, index, i + 1);
          const count = byDate.get(key)?.length ?? 0;
          return (
            <button key={key} type="button" onClick={() => setDay(key)} aria-pressed={day === key} aria-label={`${i + 1}, ${count} posts`}
              className={`min-h-11 min-w-0 rounded-xl border text-sm font-bold ${day === key ? 'border-marinho bg-marinho text-white' : 'border-border-subtle bg-surface hover:bg-gelo'}`}>
              {i + 1}{count > 0 && <span aria-hidden="true" className="mx-auto block h-1 w-1 rounded-full bg-current" />}
            </button>
          );
        })}
      </div>
      <div className="border-t border-border-subtle pt-4">
        <h3 className="mb-3 flex items-center gap-2 font-extrabold"><CalendarDays size={18} /> {portalDate(`${day}T12:00:00Z`)}</h3>
        {!selected.length && <p className="text-sm text-text-muted">Nenhum post compartilhado neste dia.</p>}
        <ul className="space-y-2">{selected.map((post) => (
          <li key={post.id}>
            <button type="button" className="btn-secundario min-h-11 w-full !justify-between flex-wrap text-left" onClick={() => open(post)}>
              <span className="min-w-0 break-words">{post.title}</span><PortalBadge post={post} />
            </button>
          </li>
        ))}</ul>
      </div>
    </section>
  );
}
