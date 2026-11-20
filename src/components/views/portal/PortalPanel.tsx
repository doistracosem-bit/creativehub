import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Archive, ArrowLeft, Bell, CalendarDays, Check, ClipboardCheck, CloudUpload, ListChecks, Send, UsersRound } from 'lucide-react';
import { ativarNotificacoes } from '../../../lib/notificacoes';
import type { PortalLink } from '../../../lib/portalLinks';
import type { Publication } from '../../../types';
import { PORTAL_FILE_TYPES, portalAction, portalDetails, portalUpload, portalWorkspace } from '../../../services/portalService';
import type { PortalAccess, PortalNotice, PortalPost, PortalRole } from '../../../services/portalService';
import { Folha } from '../../ui/Folha';
import { PortalArtwork } from './PortalArtwork';
import { PortalBadge, PortalCalendar, portalDate, portalDateKey } from './PortalCalendar';

type Tab = 'queue' | 'review' | 'history' | 'calendar' | 'notices' | 'access';
type Part = 'art' | 'caption';
type Dialog = {
  op: 'changes' | 'reject' | 'edit_caption' | 'suggest' | 'minor' | 'resend' | 'share_history' | 'release' |
    'date' | 'publish' | 'import' | 'batch' | 'access' | 'revoke' | 'team_phone';
  title: string;
  post?: PortalPost;
  part?: Part;
  access?: PortalAccess;
};
type Board = Awaited<ReturnType<typeof portalWorkspace>>;

const parts = { art: 'Arte ou vídeo', caption: 'Legenda' } as const;
const statusText = { approved: 'Aprovada', pending: 'Pendente', changes: 'Alterações solicitadas' };
const waitingOnClient = (post: PortalPost) => !post.rejection && !post.released_at && !post.published_at &&
  (post.art_status === 'pending' || post.caption_status === 'pending');
const readyForReview = (post: PortalPost) => post.shared_at && !post.rejection && !post.released_at && !post.published_at &&
  post.art_status === 'approved' && post.caption_status === 'approved';
const errorText = (error: unknown) => {
  const message = (error as { message?: unknown })?.message;
  return typeof message === 'string' && !/permission denied|violates|constraint|relation|invalid input|undefined column|ambiguous/i.test(message)
    ? message : 'Não foi possível concluir a ação. Atualize a Central e tente novamente.';
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0"><span className="rotulo !text-sm">{label}</span>{children}</label>;
}

export function PortalPanel({ clientId, name, role, email, team = false, admin = false, publications = [], initial, refreshed }: {
  clientId: string; name: string; role: PortalRole; email: string; team?: boolean; admin?: boolean;
  publications?: Publication[]; initial?: PortalLink; refreshed?: () => void;
}) {
  const [board, setBoard] = useState<Board>();
  const [tab, setTab] = useState<Tab>('queue');
  const [selectedId, setSelected] = useState(initial?.postId ?? '');
  const [mobileDetail, setMobileDetail] = useState(Boolean(initial?.postId));
  const [batch, setBatch] = useState(initial?.batchId ?? '');
  const [pendingOnly, setPendingOnly] = useState(Boolean(initial?.pendingOnly));
  const [dialog, setDialog] = useState<Dialog>();
  const [saving, setSaving] = useState(false);
  const running = useRef(false);
  const initialHandled = useRef(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [details, setDetails] = useState<{ id: string; revision: number; data: Awaited<ReturnType<typeof portalDetails>> }>();
  const [detailsError, setDetailsError] = useState('');
  const [detailRetry, setDetailRetry] = useState(0);
  const [accessRole, setAccessRole] = useState<PortalRole>('approve');
  const request = useRef<AbortController>(null);

  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const data = await portalWorkspace(clientId, team, controller.signal);
      if (controller.signal.aborted) return;
      setBoard(data);
      setError('');
    } catch (failure) {
      if (!controller.signal.aborted) setError(errorText(failure));
    }
  }, [clientId, team]);
  useEffect(() => {
    void refresh();
    const tick = () => { if (!document.hidden && !running.current) void refresh(); };
    const timer = window.setInterval(tick, 35_000);
    window.addEventListener('focus', tick);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', tick); request.current?.abort(); };
  }, [refresh]);

  const posts = board?.posts ?? [];
  const matching = posts.filter((post) => {
    if (tab === 'history') return post.published_at || post.released_at;
    if (tab === 'review') return readyForReview(post);
    return !post.published_at && !post.released_at && (!team || !readyForReview(post)) &&
      (!batch || post.batch_id === batch) && (!pendingOnly || waitingOnClient(post));
  });
  const selected = matching.find((post) => post.id === selectedId) ?? matching[0];
  const detailId = ['queue','review','history'].includes(tab) ? selected?.id : undefined;
  const detailRevision = selected?.revision ?? 0;
  const currentDetail = details?.id === detailId && details?.revision === detailRevision ? details.data : undefined;
  const draftWithArt = posts.filter((post) => !post.shared_at && !post.published_at && post.art_version > 0);
  const available = publications.filter((post) => post.client_name === name && !posts.some((item) => item.publication_id === post.id));

  function tabFor(post: PortalPost): Tab {
    if (post.published_at || post.released_at) return 'history';
    return team && readyForReview(post) ? 'review' : 'queue';
  }
  useEffect(() => {
    if (!board || initialHandled.current) return;
    initialHandled.current = true;
    const target = board.posts.find((post) => post.id === initial?.postId);
    if (target) {
      setBatch(''); setPendingOnly(false);
      setTab(target.published_at || target.released_at ? 'history' : team && readyForReview(target) ? 'review' : 'queue');
    } else if (initial?.postId) {
      setMobileDetail(false);
      setNotice('O post deste link está indisponível na sua Central.');
    }
  }, [board, initial?.postId, team]);

  useEffect(() => {
    if (!detailId) return;
    setDetailsError('');
    const controller = new AbortController();
    void portalDetails(detailId, controller.signal).then((data) => {
      if (!controller.signal.aborted) setDetails({ id: detailId, revision: detailRevision, data });
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) setDetailsError(errorText(failure));
    });
    return () => controller.abort();
  }, [detailId, detailRevision, detailRetry]);

  function go(next: Tab) {
    setTab(next); setBatch(''); setPendingOnly(false); setMobileDetail(false); setSelected(''); setNotice('');
    void refresh();
  }
  function open(post: PortalPost) {
    setTab(tabFor(post)); setBatch(''); setPendingOnly(false); setSelected(post.id); setMobileDetail(true);
  }
  function prompt(value: Dialog) {
    setFormError(''); setAccessRole(value.access?.role ?? 'approve'); setDialog(value);
  }
  const close = useCallback(() => {
    if (!running.current) setDialog(undefined);
  }, []);

  function payload(post?: PortalPost) {
    return { client_id: clientId, ...(post ? { post_id: post.id, revision: post.revision } : {}) };
  }
  async function approve(post: PortalPost, part: Part) {
    if (running.current) return;
    running.current = true; setSaving(true); setNotice(''); setError('');
    try {
      await portalAction('approve', { ...payload(post), part });
      setNotice(part === 'art' ? 'Arte aprovada.' : 'Legenda aprovada.');
    } catch (failure) { setNotice(errorText(failure)); }
    finally { await refresh(); running.current = false; setSaving(false); }
  }
  async function viewNotice(item: PortalNotice) {
    const target = posts.find((post) => post.id === item.post_id);
    if (target) open(target);
    else if (item.batch_id) {
      setTab('queue'); setBatch(item.batch_id); setPendingOnly(item.kind === 'overdue'); setSelected(''); setMobileDetail(false);
    }
    try {
      await portalAction('read', { notice_id: item.id });
      void refresh();
    } catch (failure) { setError(errorText(failure)); }
  }
  async function push() {
    const result = await ativarNotificacoes(email, true);
    setNotice(result === 'ok' ? 'Este aparelho receberá avisos da Central.' :
      result === 'precisa-instalar' ? 'Adicione o Creative Hub à tela de início e ative os avisos por lá.' :
        result === 'negado' ? 'Autorize as notificações nas configurações do navegador.' : 'Não foi possível ativar avisos neste aparelho.');
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog || running.current) return;
    const fields = new FormData(event.currentTarget);
    const post = dialog.post;
    running.current = true; setSaving(true); setFormError(''); setNotice('');
    try {
      const data = {
        ...payload(post), part: dialog.part, text: fields.get('text'), date: fields.get('date'), phone: fields.get('phone'),
        email: dialog.op === 'revoke' ? dialog.access?.email : fields.get('email'), role: fields.get('role'), due: fields.get('due'),
        opt_in: fields.has('opt-in'), confirm_minor: fields.has('confirm-minor'), publication_id: fields.get('publication'),
        posts: fields.getAll('posts').map((id) => {
          const item = draftWithArt.find((candidate) => candidate.id === id);
          return { id, revision: item?.revision };
        }),
      };
      const result = dialog.op === 'resend' && post
        ? await portalUpload(post, fields.getAll('files').filter((file): file is File => file instanceof File && file.size > 0), String(data.text ?? ''))
        : await portalAction(dialog.op, data);
      setDialog(undefined);
      if (dialog.op === 'import' && result.id) {
        const imported = available.find((item) => item.id === data.publication_id);
        setTab(imported?.status === 'POSTADO' ? 'history' : 'queue'); setSelected(result.id); setMobileDetail(true);
      }
      if (post && (dialog.op === 'release' || dialog.op === 'publish' || dialog.op === 'share_history')) {
        setTab('history'); setSelected(post.id);
      } else if (post && ['changes','reject','edit_caption','suggest','resend'].includes(dialog.op) && post.shared_at && !post.published_at) {
        setTab('queue'); setBatch(''); setPendingOnly(false); setSelected(post.id);
      }
      if (dialog.op === 'batch') { setTab('queue'); setBatch(result.batch_id ?? ''); setPendingOnly(false); setMobileDetail(false); }
      setNotice(dialog.op === 'resend' ? (post?.shared_at ? 'Nova arte enviada para aprovação.' : 'Arte anexada ao rascunho.') :
        dialog.op === 'release' ? 'Revisão final concluída. Post liberado no calendário.' :
          dialog.op === 'date' ? 'Calendário atualizado.' : dialog.op === 'batch' ? 'Envio registrado para os aprovadores.' : 'Alteração salva.');
      if (team) refreshed?.();
    } catch (failure) { setFormError(errorText(failure)); }
    finally { await refresh(); running.current = false; setSaving(false); }
  }

  const buttons: { id: Tab; name: string; icon: typeof Bell }[] = [
    { id:'queue', name:team ? 'Envios' : 'Aprovações', icon:ClipboardCheck },
    ...(team ? [{ id:'review' as const, name:'Revisão final', icon:ListChecks }] : []),
    { id:'history', name:'Concluídos e publicados', icon:Archive },
    { id:'calendar', name:'Calendário', icon:CalendarDays },
    ...(team ? [{ id:'access' as const, name:'Acessos', icon:UsersRound }] : []),
    { id:'notices', name:'Avisos', icon:Bell },
  ];
  const unread = board?.notices.filter((item) => !item.read_at).length ?? 0;
  const title = buttons.find((item) => item.id === tab)?.name;
  const activeBatch = board?.batches.find((item) => item.id === batch);

  function postDetail(post: PortalPost) {
    const canApprove = !team && role==='approve' && !post.published_at && !post.rejection;
    const deadline = board?.batches.find((item) => item.id===post.batch_id)?.due_at;
    return (
      <article className={`cartao min-w-0 space-y-4 p-4 sm:p-5 ${mobileDetail ? '' : 'hidden xl:block'}`}>
        <button type="button" onClick={() => setMobileDetail(false)} className="btn-fantasma min-h-11 xl:hidden"><ArrowLeft size={17} /> Voltar à lista</button>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="break-words text-lg font-extrabold">{post.title}</h3>
            <p className="text-sm text-text-muted">{post.format} · {post.published_at ? 'Publicado em' : 'Previsto para'} {portalDate(post.published_at ?? post.scheduled_at)}</p>
            {deadline && !post.published_at && !post.released_at && <p className="mt-1 text-xs font-semibold text-marinho">Prazo de aprovação · {portalDate(deadline)}</p>}
          </div>
          <PortalBadge post={post} />
        </div>
        {post.rejection && <div className="space-y-2 rounded-xl bg-red-50 p-3 text-sm text-red-900">
          <strong>Motivo da recusa</strong><p className="whitespace-pre-wrap break-words">{post.rejection}</p>
          {team && <button className="btn-primario min-h-11" onClick={() => prompt({op:'resend',title:'Enviar nova arte',post})}><CloudUpload size={17} /> Enviar nova arte</button>}
        </div>}
        {(['art','caption'] as const).map((part) => {
          const status = part === 'art' ? post.art_status : post.caption_status;
          const version = part === 'art' ? post.art_version : post.caption_version;
          const change = status === 'changes' ? currentDetail?.history.find((item) => item.part===part && item.action==='Solicitou alterações') : undefined;
          const note = part==='art' && !post.rejection ? currentDetail?.history.find((item) => item.part==='art' && item.version===version && item.action==='Adicionou nova arte') : undefined;
          return <section key={part} aria-label={parts[part]} className="space-y-3 border-t border-border-subtle pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-extrabold">{parts[part]} {version > 0 && <span className="font-normal text-text-muted">· v{version}</span>}</h4>
              {post.shared_at && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status==='approved' ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>{statusText[status]}</span>}
            </div>
            {part==='art' ? (currentDetail ? <PortalArtwork key={`${post.id}-${post.art_version}`} postId={post.id} title={post.title} version={post.art_version} assets={currentDetail.assets} /> :
              detailsError ? <div role="alert" className="text-sm text-red-800">{detailsError} <button className="btn-secundario min-h-11" onClick={() => setDetailRetry(detailRetry + 1)}>Tentar de novo</button></div> : <p role="status" className="text-sm text-text-muted">Carregando arte…</p>) :
              <p className="whitespace-pre-wrap break-words rounded-xl bg-canvas p-3 text-sm">{post.caption || 'Sem legenda.'}</p>}
            {change?.detail && <p className="whitespace-pre-wrap break-words rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{change.detail}</p>}
            {note?.detail && <p className="whitespace-pre-wrap break-words text-sm text-text-muted">{note.detail}</p>}
            <div className="flex flex-wrap gap-2">
              {canApprove && status==='pending' && <button className="btn-primario min-h-11" disabled={saving} onClick={() => void approve(post, part)}><Check size={16} /> Aprovar {part==='art'?'arte':'legenda'}</button>}
              {canApprove && status!=='changes' && <button className="btn-secundario min-h-11" onClick={() => prompt({op:'changes',title:status==='approved'?`Reabrir aprovação · ${parts[part]}`:`Pedir alterações · ${parts[part]}`,post,part})}>{status==='approved'?'Reabrir aprovação':'Pedir alterações'}</button>}
              {canApprove && part==='caption' && <button className="btn-secundario min-h-11" onClick={() => prompt({op:'edit_caption',title:'Editar legenda',post})}>Editar legenda</button>}
              {team && !post.rejection && part==='art' && (!post.published_at || !post.shared_at) &&
                <button className="btn-secundario min-h-11" onClick={() => prompt({op:'resend',title:version?'Enviar nova arte':'Anexar arte',post})}><CloudUpload size={16} /> {version?'Enviar nova arte':'Anexar arte'}</button>}
              {team && !post.rejection && !post.published_at && part==='caption' && <>
                <button className="btn-secundario min-h-11" onClick={() => prompt({op:'suggest',title:post.shared_at?'Sugerir legenda':'Editar legenda',post})}>{post.shared_at?'Sugerir legenda':'Editar legenda'}</button>
                {status==='approved' && <button className="btn-fantasma min-h-11" onClick={() => prompt({op:'minor',title:'Corrigir digitação ou pontuação',post})}>Corrigir digitação ou pontuação</button>}
              </>}
            </div>
          </section>;
        })}
        <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-3">
          {canApprove && <button className="btn-fantasma min-h-11 !text-red-700" onClick={() => prompt({op:'reject',title:'Recusar post',post})}>Recusar post</button>}
          {team && !post.published_at && <button className="btn-secundario min-h-11" onClick={() => prompt({op:'date',title:'Alterar data prevista',post})}>Alterar data</button>}
          {team && readyForReview(post) && <button className="btn-primario min-h-11" onClick={() => prompt({op:'release',title:'Concluir revisão final',post})}>Concluir revisão final</button>}
          {team && post.released_at && !post.published_at && <button className="btn-primario min-h-11" onClick={() => prompt({op:'publish',title:'Registrar publicação',post})}>Marcar como publicado</button>}
          {team && post.published_at && !post.shared_at && <button className="btn-primario min-h-11" disabled={!post.art_version} onClick={() => prompt({op:'share_history',title:'Compartilhar no histórico',post})}>Compartilhar no histórico</button>}
        </div>
        {!!currentDetail?.history.length && <details className="border-t border-border-subtle pt-3">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-extrabold text-marinho">Histórico de decisões</summary>
          <ol className="space-y-3">{currentDetail.history.map((item) => (
            <li className="border-l-2 border-border-subtle pl-3 text-sm" key={item.id}>
              <p className="font-bold">{item.actor} · {item.action}{item.part ? ` ${parts[item.part as Part].toLowerCase()} · v${item.version}` : ''}</p>
              <time className="text-xs text-text-muted" dateTime={item.created_at}>{new Date(item.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</time>
              {item.detail && <p className="mt-1 whitespace-pre-wrap break-words text-text-muted">{item.detail}</p>}
            </li>
          ))}</ol>
        </details>}
      </article>
    );
  }

  if (team && board?.settings.google_verified === false) return (
    <section className="cartao space-y-2 p-5">
      <h1 className="text-xl font-extrabold">Entre com Google para abrir a Central</h1>
      <p className="text-sm text-text-muted">Saia do Creative Hub e use Continuar com Google com o e-mail cadastrado pela Dois Traços.</p>
    </section>
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-col items-start justify-between gap-4 rounded-bento bg-marinho p-5 text-white shadow-suave sm:flex-row sm:items-end sm:p-6">
        <div className="min-w-0">
          <p className="mb-1 break-words text-sm font-bold text-blue-100">{name}</p>
          <h1 className="break-words text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          {role==='view' && !team && <p className="mt-1 text-sm text-blue-100">Somente visualização</p>}
        </div>
        {team && tab==='queue' && <div className="flex flex-wrap gap-2">
          <button className="btn-secundario min-h-11" disabled={!available.length} onClick={() => prompt({op:'import',title:'Trazer post do calendário'})}>Trazer post do calendário</button>
          <button className="btn-secundario min-h-11" disabled={!draftWithArt.length} onClick={() => prompt({op:'batch',title:'Novo envio para aprovação'})}><Send size={16} /> Novo envio</button>
        </div>}
      </header>
      <nav aria-label="Seções da Central" className="cartao flex flex-wrap gap-1 p-2">
        {buttons.map(({id,name:label,icon:Icon}) => <button key={id} onClick={() => go(id)} aria-current={tab===id ? 'page' : undefined}
          className={`min-h-11 min-w-0 rounded-xl px-2.5 py-2 text-xs font-bold sm:px-3 sm:text-sm ${tab===id?'bg-marinho text-white':'text-text-muted hover:bg-gelo'}`}>
          <Icon size={15} aria-hidden="true" className="mr-1 hidden align-text-bottom sm:inline" />{label}{id==='notices' && unread>0 ? ` (${unread})` : ''}
        </button>)}
      </nav>
      {notice && <p role="status" className="rounded-xl bg-gelo px-4 py-3 text-sm font-semibold text-marinho">{notice}</p>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error} <button className="btn-secundario min-h-11" onClick={() => void refresh()}>Atualizar</button></div>}
      {!board && !error && <p className="cartao p-4 text-sm text-text-muted" role="status">Carregando a Central…</p>}
      {board && (tab==='calendar' ? <PortalCalendar posts={posts} open={open} /> :
        tab==='notices' ? <section className="cartao space-y-3 p-4 sm:p-5">
          <button className="btn-secundario min-h-11" onClick={() => void push()}><Bell size={16} /> Ativar avisos neste aparelho</button>
          {!board.notices.length && <p className="text-sm text-text-muted">Nenhum aviso por enquanto.</p>}
          {board.notices.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle py-3">
            <div className="min-w-0"><p className={`break-words text-sm ${item.read_at?'font-semibold':'font-extrabold'}`}>{item.title}</p><p className="break-words text-sm text-text-muted">{item.body}</p></div>
            <button className="btn-secundario min-h-11" onClick={() => void viewNotice(item)}>{item.batch_id?(item.kind==='overdue'?'Ver posts pendentes':'Abrir envio'):item.post_id?'Abrir post':'Marcar como lido'}</button>
          </div>)}
        </section> : tab==='access' ? <section className="cartao space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            {admin && <button className="btn-primario min-h-11" onClick={() => prompt({op:'access',title:'Adicionar pessoa'})}>Adicionar pessoa</button>}
            <button className="btn-secundario min-h-11" onClick={() => prompt({op:'team_phone',title:'Meu WhatsApp na Dois Traços'})}>Meu WhatsApp</button>
          </div>
          {!board.settings.whatsapp_active && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">O canal do WhatsApp aguarda configuração. Os avisos da Central continuam disponíveis.</p>}
          <p className="text-sm text-text-muted">Compartilhe o endereço da Área do Cliente com as pessoas cadastradas. Elas entram usando o próprio e-mail.</p>
          <a className="btn-secundario min-h-11 break-all" href={`/?area=clientes&cliente=${clientId}`} target="_blank" rel="noreferrer">Abrir endereço da Área do Cliente</a>
          {!board.access.length && <p className="text-sm text-text-muted">Nenhuma pessoa cadastrada para esta empresa.</p>}
          {board.access.map((person) => <div className="flex flex-wrap justify-between gap-3 border-t border-border-subtle pt-3" key={person.email}>
            <div className="min-w-0 break-words text-sm"><strong>{person.name}</strong><p>{person.email}</p><p className="text-text-muted">{person.role==='approve'?'Pode aprovar':'Somente visualização'}{person.phone ? ` · +${person.phone}${person.whatsapp_opt_in?'':' · aguarda autorização'}` : ''}</p></div>
            {admin && <div className="flex flex-wrap gap-2">
              <button className="btn-secundario min-h-11" onClick={() => prompt({op:'access',title:'Editar acesso',access:person})}>Editar</button>
              <button className="btn-fantasma min-h-11 !text-red-700" onClick={() => prompt({op:'revoke',title:'Revogar acesso',access:person})}>Revogar</button>
            </div>}
          </div>)}
        </section> :
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(215px,.8fr)_minmax(0,1.35fr)]">
            <section className={`cartao min-w-0 p-4 sm:p-5 ${mobileDetail && selected?'hidden xl:block':''}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-extrabold">{activeBatch?.title ?? 'Posts'}</h2>
                {activeBatch && <button className="btn-fantasma min-h-11" onClick={() => { setBatch(''); setPendingOnly(false); }}>Todos os envios</button>}
              </div>
              {!matching.length && <p className="text-sm text-text-muted">{team && tab==='queue' ? 'Traga um post do calendário e anexe a arte para criar um envio.' : 'Nenhum post nesta aba.'}</p>}
              <ul className="space-y-2">{matching.map((post) => <li key={post.id}>
                <button type="button" aria-pressed={post.id===selected?.id} onClick={() => { setSelected(post.id); setMobileDetail(true); }}
                  className={`w-full rounded-xl border p-3 text-left hover:bg-gelo ${post.id===selected?.id?'border-blue-200 bg-gelo':'border-border-subtle'}`}>
                  <span className="block break-words text-sm font-extrabold">{post.title}</span>
                  <span className="mb-2 block text-xs text-text-muted">{portalDate(post.published_at ?? post.scheduled_at)} · {post.format}</span>
                  <PortalBadge post={post} />
                </button>
              </li>)}</ul>
            </section>
            {selected && postDetail(selected)}
          </div>)}
      <Folha aberta={Boolean(dialog)} aoFechar={close} titulo={dialog?.title} largura="md">
        {dialog && <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          {dialog.post && <p className="break-words text-sm font-bold text-marinho">{dialog.post.title}</p>}
          {dialog.op==='import' && <Field label="Post do calendário"><select className="campo min-h-11" name="publication" defaultValue="" required><option value="" disabled>Escolha um post</option>
            {available.map((post) => <option key={post.id} value={post.id}>{post.headline} · {portalDate(post.scheduled_for)}{post.status==='POSTADO'?' · Publicado':''}</option>)}</select></Field>}
          {dialog.op==='batch' && <>
            {!board?.settings.whatsapp_active && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">O WhatsApp aguarda configuração. Os aprovadores receberão o aviso na Central.</p>}
            <Field label="Nome do envio"><input className="campo min-h-11" name="text" maxLength={120} required /></Field>
            <Field label="Prazo de aprovação"><input className="campo min-h-11" name="due" type="date" min={portalDateKey()} defaultValue={portalDateKey()} required /></Field>
            <fieldset className="space-y-2"><legend className="text-sm font-bold">Posts do envio</legend>
              {draftWithArt.map((post) => <label className="flex min-h-11 items-center gap-2 text-sm" key={post.id}><input className="h-4 w-4 shrink-0 accent-marinho" type="checkbox" name="posts" value={post.id}/><span className="break-words">{post.title}</span></label>)}
            </fieldset>
          </>}
          {dialog.op==='access' && <>
            <Field label="Nome"><input className="campo min-h-11" name="text" defaultValue={dialog.access?.name} maxLength={120} required /></Field>
            <Field label="E-mail"><input className="campo min-h-11" name="email" type="email" defaultValue={dialog.access?.email} readOnly={Boolean(dialog.access)} required /></Field>
            <Field label="Permissão"><select className="campo min-h-11" name="role" value={accessRole} onChange={(event) => setAccessRole(event.target.value as PortalRole)}><option value="approve">Pode aprovar</option><option value="view">Somente visualização</option></select></Field>
            {accessRole==='approve' && <>
              <Field label="WhatsApp com DDI e DDD"><input className="campo min-h-11" name="phone" type="tel" placeholder="+55 (11) 99999-9999" defaultValue={dialog.access?.phone ?? ''} required /></Field>
              <label className="flex min-h-11 items-center gap-2 text-sm"><input name="opt-in" type="checkbox" defaultChecked={dialog.access?.whatsapp_opt_in} /> A pessoa autorizou receber os avisos por WhatsApp</label>
            </>}
          </>}
          {dialog.op==='revoke' && <p className="break-words text-sm">Revogar o acesso de <strong>{dialog.access?.name}</strong> a esta empresa?</p>}
          {dialog.op==='team_phone' && <Field label="Meu WhatsApp com DDI e DDD"><input className="campo min-h-11" name="phone" type="tel" defaultValue={board?.settings.phone ?? ''} /></Field>}
          {dialog.op==='resend' && <>
            <Field label="Nova arte ou vídeo"><input className="campo min-h-11" name="files" type="file" accept={PORTAL_FILE_TYPES} multiple required /></Field>
            <p className="text-xs text-text-muted">Até 10 arquivos de 50 MB. No carrossel, selecione na ordem de exibição.</p>
            <Field label={dialog.post?.shared_at?'O que mudou?':'Observação sobre o material'}><textarea className="campo min-h-24" name="text" maxLength={2000} required={Boolean(dialog.post?.shared_at)} /></Field>
          </>}
          {['changes','reject','edit_caption','suggest','minor'].includes(dialog.op) && <Field label={dialog.op==='changes'?'O que a equipe deve ajustar?':dialog.op==='reject'?'Motivo da recusa':'Legenda'}>
            <textarea className="campo min-h-28" name="text" maxLength={10000} defaultValue={['edit_caption','suggest','minor'].includes(dialog.op) ? dialog.post?.caption : ''} required />
          </Field>}
          {dialog.op==='minor' && <label className="flex min-h-11 items-center gap-2 text-sm"><input name="confirm-minor" type="checkbox" required /> O ajuste é apenas de digitação ou pontuação</label>}
          {dialog.op==='share_history' && <p className="text-sm">A arte final e a legenda ficarão visíveis no histórico desta empresa.</p>}
          {dialog.op==='release' && <p className="text-sm">A versão atual será liberada no calendário da Dois Traços.</p>}
          {['date','publish'].includes(dialog.op) && <Field label={dialog.op==='date'?'Nova data prevista':'Data em que foi publicado'}>
            <input className="campo min-h-11" name="date" type="date" defaultValue={dialog.op==='publish'?portalDateKey():portalDateKey(dialog.post?.scheduled_at)} required />
          </Field>}
          {formError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{formError}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secundario min-h-11" onClick={close} disabled={saving}>Cancelar</button>
            <button className="btn-primario min-h-11" disabled={saving}>{saving ? 'Salvando…' :
              dialog.op==='edit_caption' ? 'Aprovar e enviar à equipe' : ['batch','resend'].includes(dialog.op) && (dialog.op==='batch'||dialog.post?.shared_at) ? 'Enviar para aprovação' :
                dialog.op==='revoke' ? 'Revogar acesso' : dialog.op==='release' ? 'Liberar post' : 'Confirmar'}</button>
          </div>
        </form>}
      </Folha>
    </div>
  );
}
