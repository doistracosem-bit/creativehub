import React, { useState } from 'react';
import { BellRing, Bell, Smartphone, Share, PlusSquare, Trash2, UserPlus, LogOut, Database, Send } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import type { TeamRole } from '../../types';
import { Avatar } from '../ui/Folha';
import { cn } from '../../lib/utils';
import { ativarNotificacoes, statusNotificacao, ehIOS, estaInstalado, notificacaoTeste } from '../../lib/notificacoes';

export const SettingsView: React.FC = () => {
  const { isMockMode, team, addMember, updateMemberRole, removeMember } = useApp();
  const { usuario, sair } = useAuth();
  const admin = usuario?.papel === 'admin';

  const [status, setStatus] = useState(statusNotificacao());
  const [msgAviso, setMsgAviso] = useState('');
  const [ativando, setAtivando] = useState(false);
  const [novo, setNovo] = useState({ nome: '', email: '', papel: 'membro' as TeamRole });
  const [erroEquipe, setErroEquipe] = useState('');
  const [removendo, setRemovendo] = useState<string | null>(null);

  const iphoneSemInstalar = ehIOS() && !estaInstalado();

  async function ativar() {
    if (!usuario) return;
    setAtivando(true); setMsgAviso('');
    const r = await ativarNotificacoes(usuario.email);
    setStatus(statusNotificacao());
    setAtivando(false);
    if (r === 'ok') { setMsgAviso('Pronto! Este aparelho vai receber os lembretes.'); notificacaoTeste(); }
    if (r === 'negado') setMsgAviso('O navegador bloqueou as notificações. Libere nas configurações do site e tente de novo.');
    if (r === 'precisa-instalar') setMsgAviso('No iPhone, primeiro adicione o app à Tela de Início (passo a passo abaixo).');
    if (r === 'indisponivel') setMsgAviso('Este navegador não suporta notificações. No iPhone use o Safari; no Android, o Chrome.');
    if (r === 'erro') setMsgAviso('Não foi possível ativar agora. Tente de novo em instantes.');
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(novo.email.trim())) { setErroEquipe('E-mail inválido.'); return; }
    try {
      await addMember(novo.email, novo.nome, novo.papel);
      setNovo({ nome: '', email: '', papel: 'membro' }); setErroEquipe('');
    } catch { setErroEquipe('Não foi possível adicionar. Só admins podem gerenciar a equipe.'); }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-main tracking-tight">Equipe e avisos</h1>
        <p className="text-sm text-text-muted mt-1">Quem tem acesso ao app e como os lembretes chegam no seu celular.</p>
      </header>

      {/* Avisos */}
      <section className={cn('cartao p-5 sm:p-6 overflow-hidden relative', status !== 'granted' && 'border-celeste')}>
        <div className="flex items-start gap-4">
          <div className={cn('w-11 h-11 rounded-2xl grid place-items-center shrink-0', status === 'granted' ? 'bg-emerald-50 text-emerald-600' : 'bg-gelo text-marinho')}>
            {status === 'granted' ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-text-main">Lembretes neste aparelho</h2>
            <p className="text-sm text-text-muted mt-0.5">
              {status === 'granted'
                ? 'Ativados. Você recebe um aviso antes e na hora de cada post que estiver no seu nome (ou sem responsável).'
                : status === 'denied'
                  ? 'Bloqueados no navegador. Libere as notificações nas configurações do site.'
                  : 'Ative para receber “Hora de postar” mesmo com o app fechado. Faça isso em cada aparelho (celular e computador).'}
            </p>
            {msgAviso && <p className="text-sm font-medium text-marinho mt-2">{msgAviso}</p>}
            <div className="flex flex-wrap gap-2 mt-4">
              {status !== 'granted' && (
                <button className="btn-primario" onClick={ativar} disabled={ativando || iphoneSemInstalar}>
                  <BellRing className="w-4 h-4" />{ativando ? 'Ativando…' : 'Ativar lembretes'}
                </button>
              )}
              {status === 'granted' && (
                <>
                  <button className="btn-secundario" onClick={() => notificacaoTeste()}><Send className="w-4 h-4" />Enviar teste</button>
                  <button className="btn-fantasma" onClick={ativar}>Registrar de novo</button>
                </>
              )}
            </div>
          </div>
        </div>

        {iphoneSemInstalar && (
          <div className="mt-5 rounded-2xl bg-canvas p-4">
            <p className="text-sm font-bold text-text-main flex items-center gap-2"><Smartphone className="w-4 h-4" />No iPhone, instale o app primeiro</p>
            <ol className="mt-2 space-y-1.5 text-sm text-text-muted">
              <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-white grid place-items-center text-xs font-bold text-marinho">1</span>Toque em <Share className="w-4 h-4 text-marinho" /><b className="text-text-main">Compartilhar</b> no Safari</li>
              <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-white grid place-items-center text-xs font-bold text-marinho">2</span>Escolha <PlusSquare className="w-4 h-4 text-marinho" /><b className="text-text-main">Adicionar à Tela de Início</b></li>
              <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-white grid place-items-center text-xs font-bold text-marinho">3</span>Abra o app pelo ícone e volte aqui</li>
            </ol>
          </div>
        )}
      </section>

      {/* Equipe */}
      <section className="cartao p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-text-main">Equipe <span className="text-text-muted font-semibold">· {team.length}</span></h2>
        </div>
        <div className="divide-y divide-border-subtle">
          {team.map((m) => (
            <div key={m.email} className="flex items-center gap-3 py-3">
              <Avatar nome={m.name} tamanho={38} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-main truncate">{m.name}{m.email === usuario?.email && <span className="text-text-muted font-normal"> (você)</span>}</p>
                <p className="text-xs text-text-muted truncate">{m.email}</p>
              </div>
              {admin && m.email !== usuario?.email ? (
                removendo === m.email ? (
                  <span className="flex items-center gap-1">
                    <button className="btn-fantasma !py-1.5 !text-xs" onClick={() => setRemovendo(null)}>Cancelar</button>
                    <button className="btn-primario !py-1.5 !text-xs !bg-red-600 hover:!bg-red-700" onClick={() => { removeMember(m.email); setRemovendo(null); }}>Remover</button>
                  </span>
                ) : (
                  <>
                    <select className="campo !w-auto !py-1.5 !text-xs" value={m.role} onChange={(e) => updateMemberRole(m.email, e.target.value as TeamRole)}>
                      <option value="membro">Membro</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button onClick={() => setRemovendo(m.email)} aria-label={`Remover ${m.name}`} className="w-8 h-8 rounded-full grid place-items-center text-text-muted hover:text-red-600 hover:bg-red-50 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                  </>
                )
              ) : (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gelo text-marinho">{m.role === 'admin' ? 'Admin' : 'Membro'}</span>
              )}
            </div>
          ))}
        </div>

        {admin && (
          <form onSubmit={adicionar} className="mt-4 rounded-2xl bg-canvas p-4">
            <p className="text-sm font-bold text-text-main flex items-center gap-2 mb-3"><UserPlus className="w-4 h-4 text-accent-glow" />Adicionar pessoa</p>
            <div className="grid sm:grid-cols-[1fr_1.4fr_auto_auto] gap-2">
              <input className="campo" placeholder="Nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
              <input className="campo" type="email" placeholder="E-mail" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
              <select className="campo sm:!w-auto" value={novo.papel} onChange={(e) => setNovo({ ...novo, papel: e.target.value as TeamRole })}>
                <option value="membro">Membro</option><option value="admin">Admin</option>
              </select>
              <button className="btn-primario">Adicionar</button>
            </div>
            {erroEquipe && <p className="text-sm text-red-700 mt-2">{erroEquipe}</p>}
            <p className="text-xs text-text-muted mt-2">A pessoa entra com Google ou cria uma senha em “Primeiro acesso”, usando exatamente esse e-mail.</p>
          </form>
        )}
      </section>

      {/* Conta */}
      <section className="cartao p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar nome={usuario?.nome || '?'} tamanho={42} />
          <div className="min-w-0">
            <p className="font-semibold text-text-main truncate">{usuario?.nome}</p>
            <p className="text-xs text-text-muted truncate">{usuario?.email}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-text-muted"><Database className="w-3.5 h-3.5" />{isMockMode ? 'Modo demonstração (sem banco)' : 'Conectado ao Supabase'}</span>
        <button className="btn-secundario" onClick={() => sair()}><LogOut className="w-4 h-4" />{isMockMode ? 'Restaurar dados de exemplo' : 'Sair'}</button>
      </section>
    </div>
  );
};
