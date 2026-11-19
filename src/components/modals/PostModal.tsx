import React, { useEffect, useState } from 'react';
import {
  CalendarClock, Copy, Trash2, Pencil, CheckCircle2, Bell, User, Layers, FolderOpen,
  Image as ImageIcon, Check, UserPlus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import type { Publication, PublicationStatus } from '../../types';
import { STATUS_LABEL } from '../../types';
import { Folha, Avatar } from '../ui/Folha';
import { Toast } from '../ui/Toast';
import { cn } from '../../lib/utils';
import { COR_STATUS } from '../../lib/estilos';
import { paraInputLocal, deInputLocal, fmtDataLonga, fmtHora, LEMBRETES } from '../../lib/datas';

const ORDEM: PublicationStatus[] = ['IDEIA', 'CRIANDO', 'APROVADO', 'AGENDADO', 'POSTADO'];
const FORMATOS = ['Carrossel Instagram', 'Reels / TikTok', 'Post Estático', 'Stories Interativos', 'Vídeo YouTube', 'Artigo / Banner', 'LinkedIn'];

interface Props {
  aberto: boolean;
  publicacao: Publication | null;       // existente → abre em modo visualização
  preset?: Partial<Publication>;        // novo post com valores iniciais
  aoFechar: () => void;
}

export const PostModal: React.FC<Props> = ({ aberto, publicacao, preset, aoFechar }) => {
  const { addPublication, updatePublication, deletePublication, projects, clients, addClient, team, memberName } = useApp();
  const { usuario } = useAuth();
  const novo = !publicacao;
  const [modo, setModo] = useState<'ver' | 'editar'>(novo ? 'editar' : 'ver');
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  const base: Partial<Publication> = publicacao || preset || {};
  const [f, setF] = useState(() => formDe(base));
  const [novoCliente, setNovoCliente] = useState<string | null>(null);

  function formDe(p: Partial<Publication>) {
    return {
      headline: p.headline || '',
      client_name: p.client_name || clients[0]?.name || '',
      format: p.format || 'Carrossel Instagram',
      project_id: p.project_id || '',
      quando: paraInputLocal(p.scheduled_for),
      status: (p.status || 'IDEIA') as PublicationStatus,
      responsible_email: p.responsible_email ?? usuario?.email ?? '',
      reminder_minutes: p.reminder_minutes ?? 60,
      copy_text: p.copy_text || '',
      assets_ready: p.assets_ready || false,
    };
  }

  // Reinicia o formulário sempre que abrir outro post
  useEffect(() => {
    if (!aberto) return;
    setModo(publicacao ? 'ver' : 'editar');
    setF(formDe(publicacao || preset || {}));
    setConfirmarExclusao(false); setErro(''); setNovoCliente(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, publicacao?.id]);

  // Mantém a visualização em dia se o post mudar (ex.: status alterado)
  const atual = publicacao;
  const muda = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function salvar() {
    if (!f.headline.trim()) { setErro('Dê um título para o post.'); return; }
    let cliente = f.client_name;
    if (novoCliente !== null) {
      if (!novoCliente.trim()) { setErro('Digite o nome do novo cliente.'); return; }
      cliente = novoCliente.trim(); addClient(cliente, 'Geral');
    }
    setSalvando(true); setErro('');
    const scheduled_for = deInputLocal(f.quando);
    const dados = {
      headline: f.headline.trim(), client_name: cliente || 'Dois Traços', format: f.format,
      project_id: f.project_id || null, scheduled_for, status: f.status,
      responsible_email: f.responsible_email || null, reminder_minutes: Number(f.reminder_minutes),
      copy_text: f.copy_text, assets_ready: f.assets_ready,
    };
    const reprogramar = novo || scheduled_for !== atual?.scheduled_for || dados.reminder_minutes !== atual?.reminder_minutes;
    try {
      if (novo) await addPublication({ ...dados, reminder_sent: false, due_sent: false });
      else await updatePublication(atual!.id, reprogramar ? { ...dados, reminder_sent: false, due_sent: false } : dados);
      if (novo) aoFechar();
      else { setModo('ver'); setToast('Post atualizado'); }
    } catch {
      setErro('Não foi possível salvar. Tente de novo.');
    } finally { setSalvando(false); }
  }

  async function mudarStatus(s: PublicationStatus) {
    if (!atual) return;
    await updatePublication(atual.id, { status: s });
    setToast(s === 'POSTADO' ? 'Marcado como publicado ✓' : `Status: ${STATUS_LABEL[s]}`);
  }

  async function excluir() {
    if (!atual) return;
    await deletePublication(atual.id);
    aoFechar();
  }

  async function copiarLegenda() {
    try { await navigator.clipboard.writeText(atual?.copy_text || ''); setToast('Legenda copiada'); }
    catch { setToast('Não foi possível copiar. Selecione o texto e copie manualmente.'); }
  }

  const projeto = projects.find((p) => p.id === (atual?.project_id || ''));
  const lembreteLabel = LEMBRETES.find((l) => l.min === (atual?.reminder_minutes ?? 60))?.label || '1 hora antes';

  /* ---------------- VISUALIZAÇÃO ---------------- */
  if (modo === 'ver' && atual) {
    const cor = COR_STATUS[atual.status];
    return (
      <>
        <Folha
          aberta={aberto} aoFechar={aoFechar}
          topo={
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border', cor.chip)}>
                <span className={cn('w-1.5 h-1.5 rounded-full', cor.ponto)} />{STATUS_LABEL[atual.status]}
              </span>
              <span className="text-xs font-semibold text-accent-glow uppercase tracking-wide">{atual.client_name}</span>
            </div>
          }
          titulo={atual.headline}
          rodape={confirmarExclusao ? (
            <>
              <span className="text-sm text-text-main font-medium mr-auto">Excluir este post de vez?</span>
              <button className="btn-fantasma" onClick={() => setConfirmarExclusao(false)}>Cancelar</button>
              <button className="btn-primario !bg-red-600 hover:!bg-red-700" onClick={excluir}><Trash2 className="w-4 h-4" />Excluir</button>
            </>
          ) : (
            <>
              <button className="btn-fantasma !text-red-600 hover:!bg-red-50" onClick={() => setConfirmarExclusao(true)}><Trash2 className="w-4 h-4" /><span className="hidden sm:inline">Excluir</span></button>
              <span className="flex-1" />
              <button className="btn-secundario" onClick={() => setModo('editar')}><Pencil className="w-4 h-4" />Editar</button>
              {atual.status !== 'POSTADO' && (
                <button className="btn-primario" onClick={() => mudarStatus('POSTADO')}><CheckCircle2 className="w-4 h-4" />Marcar publicado</button>
              )}
            </>
          )}
        >
          {/* Informações */}
          <div className="grid grid-cols-2 gap-px rounded-2xl overflow-hidden border border-border-subtle bg-border-subtle mt-1">
            <Info icone={CalendarClock} rotulo="Quando" valor={`${fmtDataLonga(atual.scheduled_for)} · ${fmtHora(atual.scheduled_for)}`} largo />
            <Info icone={Layers} rotulo="Formato" valor={atual.format} />
            <Info icone={User} rotulo="Responsável" valor={
              <span className="inline-flex items-center gap-2"><Avatar nome={memberName(atual.responsible_email)} tamanho={22} />{memberName(atual.responsible_email)}</span>
            } />
            <Info icone={Bell} rotulo="Lembrete no celular" valor={lembreteLabel} />
            <Info icone={ImageIcon} rotulo="Arte" valor={atual.assets_ready
              ? <span className="text-emerald-700 inline-flex items-center gap-1"><Check className="w-4 h-4" />Pronta</span>
              : <span className="text-amber-700">Pendente</span>} />
            {projeto && <Info icone={FolderOpen} rotulo="Projeto" valor={projeto.project_name} largo />}
          </div>

          {/* Etapas */}
          <p className="rotulo mt-6">Etapa</p>
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
            {ORDEM.map((s) => (
              <button key={s} onClick={() => mudarStatus(s)}
                className={cn('shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer',
                  atual.status === s ? COR_STATUS[s].chip + ' ring-2 ring-offset-1 ring-current/20' : 'bg-surface border-border-subtle text-text-muted hover:text-text-main')}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          {/* Legenda */}
          <div className="flex items-center justify-between mt-6 mb-1.5">
            <p className="rotulo !mb-0">Legenda</p>
            {atual.copy_text && <button onClick={copiarLegenda} className="text-xs font-semibold text-accent-glow inline-flex items-center gap-1 hover:underline cursor-pointer"><Copy className="w-3.5 h-3.5" />Copiar</button>}
          </div>
          <div className="rounded-2xl bg-canvas p-4 text-sm text-text-main leading-relaxed whitespace-pre-wrap min-h-[64px]">
            {atual.copy_text || <span className="text-text-muted">Sem legenda ainda.</span>}
          </div>
        </Folha>
        <Toast isOpen={!!toast} message={toast || ''} type="success" onClose={() => setToast(null)} duration={2200} />
      </>
    );
  }

  /* ---------------- EDIÇÃO / NOVO ---------------- */
  return (
    <>
      <Folha
        aberta={aberto} aoFechar={aoFechar}
        titulo={novo ? 'Novo post' : 'Editar post'}
        rodape={
          <>
            {erro && <span className="text-sm text-red-700 mr-auto">{erro}</span>}
            <span className="flex-1" />
            <button className="btn-fantasma" onClick={() => (novo ? aoFechar() : setModo('ver'))}>Cancelar</button>
            <button className="btn-primario" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : novo ? 'Agendar post' : 'Salvar'}</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="rotulo">Título</label>
            <input className="campo font-semibold" autoFocus={novo} value={f.headline} onChange={(e) => muda('headline', e.target.value)} placeholder="Ex.: 5 erros no clareamento dental" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between">
                <label className="rotulo">Cliente</label>
                <button type="button" onClick={() => setNovoCliente(novoCliente === null ? '' : null)} className="text-xs font-semibold text-accent-glow inline-flex items-center gap-1 mb-1.5 cursor-pointer">
                  <UserPlus className="w-3.5 h-3.5" />{novoCliente === null ? 'Novo cliente' : 'Escolher existente'}
                </button>
              </div>
              {novoCliente === null ? (
                <select className="campo" value={f.client_name} onChange={(e) => muda('client_name', e.target.value)}>
                  {clients.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  {f.client_name && !clients.some((c) => c.name === f.client_name) && <option value={f.client_name}>{f.client_name}</option>}
                </select>
              ) : (
                <input className="campo" autoFocus value={novoCliente} onChange={(e) => setNovoCliente(e.target.value)} placeholder="Nome do cliente" />
              )}
            </div>
            <div>
              <label className="rotulo">Projeto</label>
              <select className="campo" value={f.project_id} onChange={(e) => muda('project_id', e.target.value)}>
                <option value="">Sem projeto</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="rotulo">Formato</label>
              <select className="campo" value={f.format} onChange={(e) => muda('format', e.target.value)}>
                {[...new Set([f.format, ...FORMATOS])].map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div>
              <label className="rotulo">Data e horário</label>
              <input className="campo" type="datetime-local" value={f.quando} onChange={(e) => muda('quando', e.target.value)} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="rotulo">Responsável</label>
              <select className="campo" value={f.responsible_email} onChange={(e) => muda('responsible_email', e.target.value)}>
                <option value="">Equipe toda</option>
                {team.map((m) => <option key={m.email} value={m.email}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="rotulo">Lembrete no celular</label>
              <select className="campo" value={f.reminder_minutes} onChange={(e) => muda('reminder_minutes', Number(e.target.value))}>
                {LEMBRETES.map((l) => <option key={l.min} value={l.min}>{l.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="rotulo">Etapa</label>
            <div className="flex flex-wrap gap-1.5">
              {ORDEM.map((s) => (
                <button type="button" key={s} onClick={() => muda('status', s)}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer',
                    f.status === s ? COR_STATUS[s].chip : 'bg-surface border-border-subtle text-text-muted hover:text-text-main')}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="rotulo">Legenda</label>
            <textarea className="campo resize-none leading-relaxed" rows={5} value={f.copy_text} onChange={(e) => muda('copy_text', e.target.value)} placeholder="Texto da publicação, com emojis e hashtags…" />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <span className={cn('w-10 h-6 rounded-full p-0.5 transition-colors', f.assets_ready ? 'bg-emerald-500' : 'bg-[#cfdcef]')}>
              <span className={cn('block w-5 h-5 rounded-full bg-white shadow transition-transform', f.assets_ready && 'translate-x-4')} />
            </span>
            <input type="checkbox" className="sr-only" checked={f.assets_ready} onChange={(e) => muda('assets_ready', e.target.checked)} />
            <span className="text-sm font-medium text-text-main">Arte pronta</span>
          </label>
        </div>
      </Folha>
      <Toast isOpen={!!toast} message={toast || ''} type="success" onClose={() => setToast(null)} duration={2200} />
    </>
  );
};

function Info({ icone: Icone, rotulo, valor, largo }: { icone: React.ElementType; rotulo: string; valor: React.ReactNode; largo?: boolean }) {
  return (
    <div className={cn('bg-surface p-3.5 sm:p-4', largo && 'col-span-2')}>
      <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide flex items-center gap-1.5"><Icone className="w-3.5 h-3.5" />{rotulo}</p>
      <div className="text-sm font-semibold text-text-main mt-1">{valor}</div>
    </div>
  );
}
