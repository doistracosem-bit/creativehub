import React, { useMemo, useState } from 'react';
import {
  Plus, Search, Phone, Mail, AtSign, FolderKanban, CalendarClock, Pencil, Trash2, StickyNote, ChevronRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useUI } from '../../context/UIContext';
import type { Client } from '../../types';
import { STAGE_LABEL, STATUS_LABEL } from '../../types';
import { cn } from '../../lib/utils';
import { COR_ETAPA, COR_STATUS } from '../../lib/estilos';
import { fmtDiaRelativo, fmtHora, iniciais } from '../../lib/datas';
import { Folha, Vazio } from '../ui/Folha';

/** Cliente como aparece na lista: cadastrado ou só usado em projetos/posts */
type ItemCliente = Client & { semCadastro?: boolean };

const NICHOS = ['Odontologia', 'Saúde', 'Moda', 'Gastronomia', 'Fitness', 'Advocacia', 'Imobiliária', 'Arquitetura', 'E-commerce', 'Infoproduto', 'Educação', 'Beleza', 'Tecnologia', 'Geral'];

export const ClientsView: React.FC = () => {
  const { clients, projects, publications } = useApp();
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<{ cliente: ItemCliente | null } | null>(null);

  // Junta os clientes cadastrados com nomes usados em projetos/posts que ainda não têm ficha
  const lista: ItemCliente[] = useMemo(() => {
    const nomes = new Set(clients.map((c) => c.name.toLowerCase()));
    const soltos = [...new Set([...projects.map((p) => p.client_name), ...publications.map((p) => p.client_name)])]
      .filter((n): n is string => !!n && !nomes.has(n.toLowerCase()))
      .map((n) => ({ id: `sem-cadastro:${n}`, name: n, niche: '', semCadastro: true }));
    return [...clients, ...soltos].sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, projects, publications]);

  const filtrados = lista.filter((c) =>
    !busca || `${c.name} ${c.niche} ${c.instagram ?? ''}`.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-main tracking-tight">Clientes</h1>
          <p className="text-sm text-text-muted mt-1">{lista.length} {lista.length === 1 ? 'cliente' : 'clientes'}. Toque em um para ver projetos, posts e contato.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input className="campo pl-10 !py-2.5" placeholder="Buscar cliente…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </label>
          <button className="btn-primario shrink-0" onClick={() => setAberto({ cliente: null })}><Plus className="w-4 h-4" /><span className="hidden sm:inline">Novo cliente</span></button>
        </div>
      </header>

      {filtrados.length === 0 ? (
        <Vazio texto={busca ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}
          acao={!busca && <button className="btn-primario mt-1" onClick={() => setAberto({ cliente: null })}><Plus className="w-4 h-4" />Cadastrar o primeiro</button>} />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtrados.map((c) => <CartaoCliente key={c.id} cliente={c} aoAbrir={() => setAberto({ cliente: c })} />)}
        </div>
      )}

      {aberto && <FichaCliente cliente={aberto.cliente} aoFechar={() => setAberto(null)} />}
    </div>
  );
};

function useResumo(nome: string) {
  const { projects, publications } = useApp();
  const projetos = projects.filter((p) => p.client_name === nome);
  const posts = publications.filter((p) => p.client_name === nome).sort((a, b) => +new Date(a.scheduled_for) - +new Date(b.scheduled_for));
  const agora = Date.now();
  const proximo = posts.find((p) => p.status !== 'POSTADO' && +new Date(p.scheduled_for) >= agora);
  return {
    projetos,
    posts,
    ativos: projetos.filter((p) => p.stage !== 'CONCLUIDO').length,
    agendados: posts.filter((p) => p.status !== 'POSTADO' && +new Date(p.scheduled_for) >= agora).length,
    proximo,
  };
}

function CartaoCliente({ cliente, aoAbrir }: { cliente: ItemCliente; aoAbrir: () => void }) {
  const r = useResumo(cliente.name);
  return (
    <article onClick={aoAbrir} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && aoAbrir()}
      className="cartao p-5 cursor-pointer transition-all hover:-translate-y-0.5 hover:border-celeste group">
      <div className="flex items-start gap-3">
        <span className="w-12 h-12 rounded-2xl bg-gelo text-marinho font-bold grid place-items-center shrink-0 text-base">{iniciais(cliente.name)}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-text-main truncate group-hover:text-accent-glow transition-colors">{cliente.name}</h2>
          {cliente.semCadastro
            ? <span className="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">Sem cadastro</span>
            : <p className="text-sm text-text-muted truncate">{cliente.niche || 'Sem nicho'}</p>}
        </div>
        <ChevronRight className="w-5 h-5 text-text-muted shrink-0 mt-1" />
      </div>

      {(cliente.phone || cliente.instagram) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-text-muted">
          {cliente.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{cliente.phone}</span>}
          {cliente.instagram && <span className="inline-flex items-center gap-1"><AtSign className="w-3.5 h-3.5" />{cliente.instagram.replace(/^@/, '')}</span>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mt-4">
        <div className="rounded-xl bg-canvas px-3 py-2">
          <p className="text-lg font-bold text-text-main leading-none">{r.ativos}</p>
          <p className="text-[11px] text-text-muted mt-1">{r.ativos === 1 ? 'projeto ativo' : 'projetos ativos'}</p>
        </div>
        <div className="rounded-xl bg-canvas px-3 py-2">
          <p className="text-lg font-bold text-text-main leading-none">{r.agendados}</p>
          <p className="text-[11px] text-text-muted mt-1">{r.agendados === 1 ? 'post a publicar' : 'posts a publicar'}</p>
        </div>
      </div>
      <p className="text-xs text-text-muted mt-3 truncate">
        {r.proximo ? <>Próximo post: <b className="text-text-main">{fmtDiaRelativo(r.proximo.scheduled_for)}, {fmtHora(r.proximo.scheduled_for)}</b></> : 'Nenhum post agendado'}
      </p>
    </article>
  );
}

/* ---------------- Ficha do cliente (pop-up) ---------------- */

function FichaCliente({ cliente: inicial, aoFechar }: { cliente: ItemCliente | null; aoFechar: () => void }) {
  const { clients, addClient, updateClient, deleteClient, deleteProject, deletePublication } = useApp();
  // Usa sempre a versão mais recente do cadastro (ex.: logo depois de editar)
  const cliente: ItemCliente | null = (inicial && clients.find((c) => c.id === inicial.id)) || inicial;
  const { abrirPost, abrirProjeto, novoProjeto } = useUI();
  const cadastrado = !!cliente && !cliente.semCadastro;
  const [modo, setModo] = useState<'ver' | 'editar' | 'excluir'>(cadastrado ? 'ver' : 'editar');
  const [f, setF] = useState({
    name: cliente?.name ?? '', niche: cliente?.niche || '', phone: cliente?.phone ?? '',
    email: cliente?.email ?? '', instagram: cliente?.instagram ?? '', notes: cliente?.notes ?? '',
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [apagarTudo, setApagarTudo] = useState(false);
  const r = useResumo(cliente?.name ?? '');

  async function salvar() {
    if (!f.name.trim()) { setErro('Digite o nome do cliente.'); return; }
    setSalvando(true); setErro('');
    const dados = {
      name: f.name.trim(), niche: f.niche.trim() || 'Geral',
      phone: f.phone.trim() || null, email: f.email.trim() || null,
      instagram: f.instagram.trim() || null, notes: f.notes.trim() || null,
    };
    try {
      if (cadastrado) { await updateClient(cliente!.id, dados); setModo('ver'); }
      else {
        if (cliente?.semCadastro && dados.name !== cliente.name) {
          // Completar cadastro com outro nome: cria e renomeia projetos/posts
          const c = addClient(cliente.name, dados.niche, dados);
          await updateClient(c.id, { name: dados.name });
        } else addClient(dados.name, dados.niche, dados);
        aoFechar();
      }
    } catch { setErro('Não foi possível salvar. Tente de novo.'); }
    setSalvando(false);
  }

  async function excluir() {
    setSalvando(true); setErro('');
    try {
      if (apagarTudo) {
        for (const p of r.posts) await deletePublication(p.id);
        for (const p of r.projetos) await deleteProject(p.id);
      }
      if (cadastrado) await deleteClient(cliente!.id);
      aoFechar();
    } catch { setErro('Não foi possível excluir. Tente de novo.'); setSalvando(false); }
  }

  const titulo = !cliente ? 'Novo cliente' : modo === 'excluir' ? 'Excluir cliente?' : modo === 'editar' ? (cadastrado ? 'Editar cliente' : 'Completar cadastro') : cliente.name;

  /* --- Excluir --- */
  if (modo === 'excluir' && cliente) {
    const temVinculos = r.projetos.length + r.posts.length > 0;
    return (
      <Folha aberta aoFechar={aoFechar} largura="md" titulo={titulo}
        rodape={<>
          {erro && <span className="text-sm text-red-700 mr-auto">{erro}</span>}
          <span className="flex-1" />
          <button className="btn-fantasma" onClick={() => setModo(cadastrado ? 'ver' : 'editar')} disabled={salvando}>Cancelar</button>
          <button className="btn-primario !bg-red-600 hover:!bg-red-700" onClick={excluir} disabled={salvando || (!cadastrado && !apagarTudo)}>
            <Trash2 className="w-4 h-4" />{salvando ? 'Excluindo…' : 'Excluir'}
          </button>
        </>}>
        <p className="text-sm text-text-muted">
          O cadastro de <b className="text-text-main">{cliente.name}</b> será apagado.
        </p>
        {temVinculos && (
          <>
            <p className="text-sm text-text-muted mt-3">
              Ele tem <b className="text-text-main">{r.projetos.length} {r.projetos.length === 1 ? 'projeto' : 'projetos'}</b> e <b className="text-text-main">{r.posts.length} {r.posts.length === 1 ? 'post' : 'posts'}</b>.
              {' '}Se eles ficarem, o nome continua aparecendo aqui como “sem cadastro”.
            </p>
            <label className="flex items-start gap-3 mt-4 p-3 rounded-2xl bg-red-50 border border-red-100 cursor-pointer">
              <input type="checkbox" className="mt-0.5 w-4 h-4 accent-red-600" checked={apagarTudo} onChange={(e) => setApagarTudo(e.target.checked)} />
              <span className="text-sm text-red-800">Excluir também os projetos e posts deste cliente (não dá para desfazer)</span>
            </label>
          </>
        )}
      </Folha>
    );
  }

  /* --- Editar / Novo --- */
  if (modo === 'editar' || !cliente) {
    return (
      <Folha aberta aoFechar={aoFechar} largura="md" titulo={titulo}
        rodape={<>
          {erro && <span className="text-sm text-red-700 mr-auto">{erro}</span>}
          {cliente?.semCadastro && (r.projetos.length + r.posts.length > 0) && (
            <button className="btn-fantasma !text-red-600 hover:!bg-red-50" onClick={() => { setApagarTudo(true); setModo('excluir'); }}><Trash2 className="w-4 h-4" /></button>
          )}
          <span className="flex-1" />
          <button className="btn-fantasma" onClick={() => (cadastrado ? setModo('ver') : aoFechar())}>Cancelar</button>
          <button className="btn-primario" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : cadastrado ? 'Salvar' : 'Cadastrar'}</button>
        </>}>
        {cliente?.semCadastro && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4">
            Este nome aparece em projetos ou posts, mas ainda não tem cadastro. Complete os dados abaixo.
          </p>
        )}
        <div className="space-y-4">
          <div>
            <label className="rotulo">Nome do cliente</label>
            <input className="campo font-semibold" autoFocus={!cliente} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Studio Lumina" />
          </div>
          <div>
            <label className="rotulo">Nicho</label>
            <input className="campo" list="nichos" value={f.niche} onChange={(e) => setF({ ...f, niche: e.target.value })} placeholder="Ex.: Odontologia" />
            <datalist id="nichos">{NICHOS.map((n) => <option key={n} value={n} />)}</datalist>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="rotulo">WhatsApp / telefone</label>
              <input className="campo" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="(16) 99999-0000" />
            </div>
            <div>
              <label className="rotulo">Instagram</label>
              <input className="campo" value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} placeholder="@perfil" />
            </div>
          </div>
          <div>
            <label className="rotulo">E-mail</label>
            <input className="campo" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="contato@cliente.com" />
          </div>
          <div>
            <label className="rotulo">Anotações</label>
            <textarea className="campo resize-none" rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Preferências, combinados, horários de aprovação…" />
          </div>
        </div>
      </Folha>
    );
  }

  /* --- Ver --- */
  const zap = cliente.phone?.replace(/\D/g, '');
  const insta = cliente.instagram?.replace(/^@/, '').trim();
  return (
    <Folha aberta aoFechar={aoFechar} largura="lg"
      topo={<span className="inline-block mb-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-gelo text-marinho">{cliente.niche || 'Sem nicho'}</span>}
      titulo={titulo}
      rodape={<>
        <button className="btn-fantasma !text-red-600 hover:!bg-red-50" onClick={() => setModo('excluir')}><Trash2 className="w-4 h-4" /><span className="hidden sm:inline">Excluir</span></button>
        <span className="flex-1" />
        <button className="btn-secundario" onClick={() => setModo('editar')}><Pencil className="w-4 h-4" />Editar</button>
        <button className="btn-primario" onClick={() => abrirPost(null, { client_name: cliente.name, status: 'IDEIA' })}><CalendarClock className="w-4 h-4" /><span className="hidden sm:inline">Agendar post</span><span className="sm:hidden">Post</span></button>
      </>}>
      {/* Contato */}
      <div className="grid sm:grid-cols-3 gap-2">
        <Contato icone={Phone} rotulo="WhatsApp" valor={cliente.phone} href={zap ? `https://wa.me/${zap.length <= 11 ? '55' + zap : zap}` : undefined} />
        <Contato icone={AtSign} rotulo="Instagram" valor={insta ? '@' + insta : null} href={insta ? `https://instagram.com/${insta}` : undefined} />
        <Contato icone={Mail} rotulo="E-mail" valor={cliente.email} href={cliente.email ? `mailto:${cliente.email}` : undefined} />
      </div>
      {cliente.notes && (
        <div className="mt-3 rounded-2xl bg-canvas p-4 text-sm text-text-main whitespace-pre-wrap flex gap-2">
          <StickyNote className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />{cliente.notes}
        </div>
      )}

      {/* Projetos */}
      <div className="flex items-center justify-between mt-6 mb-2">
        <h3 className="font-bold text-text-main flex items-center gap-2"><FolderKanban className="w-4 h-4 text-accent-glow" />Projetos <span className="text-text-muted font-semibold">{r.projetos.length}</span></h3>
        <button className="text-sm font-semibold text-accent-glow inline-flex items-center gap-1 cursor-pointer" onClick={() => novoProjeto(cliente.name)}><Plus className="w-4 h-4" />Novo projeto</button>
      </div>
      <div className="space-y-2">
        {r.projetos.length ? r.projetos.map((p) => (
          <button key={p.id} onClick={() => abrirProjeto(p)} className="w-full text-left flex items-center gap-3 p-3 rounded-2xl border border-border-subtle hover:border-celeste hover:bg-surface-hover transition-colors cursor-pointer">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-text-main truncate">{p.project_name}</span>
              <span className="block text-xs text-text-muted">Prazo {new Date(p.deadline).toLocaleDateString('pt-BR')} · {p.progress}%</span>
            </span>
            <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0', COR_ETAPA[p.stage])}>{STAGE_LABEL[p.stage]}</span>
          </button>
        )) : <p className="text-sm text-text-muted py-3 text-center rounded-2xl border border-dashed border-border-subtle">Nenhum projeto ainda.</p>}
      </div>

      {/* Posts */}
      <h3 className="font-bold text-text-main flex items-center gap-2 mt-6 mb-2"><CalendarClock className="w-4 h-4 text-accent-glow" />Posts <span className="text-text-muted font-semibold">{r.posts.length}</span></h3>
      <div className="space-y-2">
        {r.posts.length ? r.posts.slice(-12).map((p) => (
          <button key={p.id} onClick={() => abrirPost(p.id)} className="w-full text-left flex items-center gap-3 p-3 rounded-2xl border border-border-subtle hover:border-celeste hover:bg-surface-hover transition-colors cursor-pointer">
            <span className="w-16 shrink-0">
              <span className="block text-[11px] font-semibold text-text-muted">{fmtDiaRelativo(p.scheduled_for)}</span>
              <span className="block text-sm font-bold text-text-main">{fmtHora(p.scheduled_for)}</span>
            </span>
            <span className={cn('min-w-0 flex-1 text-sm font-semibold truncate', p.status === 'POSTADO' ? 'text-text-muted line-through' : 'text-text-main')}>{p.headline}</span>
            <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 hidden sm:inline', COR_STATUS[p.status].chip)}>{STATUS_LABEL[p.status]}</span>
          </button>
        )) : <p className="text-sm text-text-muted py-3 text-center rounded-2xl border border-dashed border-border-subtle">Nenhum post ainda.</p>}
      </div>
    </Folha>
  );
}

function Contato({ icone: Icone, rotulo, valor, href }: { icone: React.ElementType; rotulo: string; valor?: string | null; href?: string }) {
  const conteudo = (
    <>
      <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide flex items-center gap-1.5"><Icone className="w-3.5 h-3.5" />{rotulo}</p>
      <p className={cn('text-sm font-semibold mt-1 truncate', valor ? 'text-text-main' : 'text-text-muted font-normal')}>{valor || 'Não informado'}</p>
    </>
  );
  return valor && href
    ? <a href={href} target="_blank" rel="noreferrer" className="block rounded-2xl border border-border-subtle p-3 hover:border-celeste hover:bg-surface-hover transition-colors">{conteudo}</a>
    : <div className="rounded-2xl border border-border-subtle p-3">{conteudo}</div>;
}

