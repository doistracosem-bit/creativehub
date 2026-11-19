import React from 'react';
import { useState } from 'react';
import { LayoutDashboard, Calendar, FolderKanban, Sparkles, Image as ImageIcon, Users, LogOut, Plus, Contact, MoreHorizontal } from 'lucide-react';
import { Folha } from './ui/Folha';
import type { NavTab } from '../types';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { Avatar } from './ui/Folha';
import { MARCA } from '../lib/marca';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
}

const navItems: { id: NavTab; label: string; curto: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Painel', curto: 'Painel', icon: LayoutDashboard },
  { id: 'calendar', label: 'Calendário', curto: 'Calendário', icon: Calendar },
  { id: 'projects', label: 'Projetos', curto: 'Projetos', icon: FolderKanban },
  { id: 'clients', label: 'Clientes', curto: 'Clientes', icon: Contact },
  { id: 'ai-copilot', label: 'Copilot IA', curto: 'IA', icon: Sparkles },
  { id: 'references', label: 'Referências', curto: 'Refs', icon: ImageIcon },
  { id: 'settings', label: 'Equipe e avisos', curto: 'Equipe', icon: Users },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { usuario, sair } = useAuth();
  const { abrirPost } = useUI();
  const [maisAberto, setMaisAberto] = useState(false);
  const principaisCelular: NavTab[] = ['dashboard', 'calendar', 'projects', 'clients'];
  const extrasCelular = navItems.filter((i) => !principaisCelular.includes(i.id));
  const extraAtivo = extrasCelular.some((i) => i.id === activeTab);

  return (
    <>
      {/* ===== Computador: barra lateral ===== */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 h-screen sticky top-0 bg-surface border-r border-border-subtle px-4 py-6">
        <button onClick={() => setActiveTab('dashboard')} className="px-2 mb-8 cursor-pointer self-start" title="Início">
          <img src={MARCA.logoEscuro} alt="Dois Traços" className="h-8 w-auto" />
        </button>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const ativo = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id)}
                className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer',
                  ativo ? 'bg-marinho text-white shadow-[0_8px_20px_-10px_rgba(11,57,116,.8)]' : 'text-text-muted hover:text-text-main hover:bg-canvas')}>
                <Icon className="w-[18px] h-[18px]" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <button onClick={() => abrirPost(null)} className="btn-primario mt-6 !bg-accent-glow hover:!bg-[#004f7d]">
          <Plus className="w-4 h-4" />Agendar post
        </button>

        <div className="mt-auto relative rounded-2xl bg-gelo p-4 pt-16 overflow-hidden">
          <img src={MARCA.mascote} alt="" className="absolute -top-2 right-1 h-24 w-auto" />
          <div className="flex items-center gap-2.5">
            <Avatar nome={usuario?.nome || '?'} tamanho={34} className="!bg-white" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-text-main truncate">{usuario?.nome}</p>
              <p className="text-xs text-text-muted">{usuario?.papel === 'admin' ? 'Admin' : 'Membro'}</p>
            </div>
            <button onClick={() => sair()} title="Sair" className="w-8 h-8 rounded-full grid place-items-center text-text-muted hover:text-marinho hover:bg-white cursor-pointer">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ===== Celular: barra inferior ===== */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-surface/95 backdrop-blur-xl border-t border-border-subtle pb-[env(safe-area-inset-bottom)] grid grid-cols-5">
        {navItems.filter((i) => principaisCelular.includes(i.id)).map((item) => {
          const Icon = item.icon;
          const ativo = activeTab === item.id;
          return (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className={cn('flex flex-col items-center justify-center gap-1 h-16 text-[11px] font-semibold cursor-pointer', ativo ? 'text-marinho' : 'text-text-muted')}>
              <span className={cn('w-12 h-7 rounded-full grid place-items-center transition-colors', ativo && 'bg-gelo')}>
                <Icon className="w-5 h-5" />
              </span>
              {item.curto}
            </button>
          );
        })}
        <button onClick={() => setMaisAberto(true)}
          className={cn('flex flex-col items-center justify-center gap-1 h-16 text-[11px] font-semibold cursor-pointer', extraAtivo ? 'text-marinho' : 'text-text-muted')}>
          <span className={cn('w-12 h-7 rounded-full grid place-items-center transition-colors', extraAtivo && 'bg-gelo')}>
            <MoreHorizontal className="w-5 h-5" />
          </span>
          Mais
        </button>
      </nav>

      {/* Celular: menu "Mais" */}
      <Folha aberta={maisAberto} aoFechar={() => setMaisAberto(false)} titulo="Mais" largura="md">
        <div className="space-y-1 pb-2">
          {extrasCelular.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => { setActiveTab(item.id); setMaisAberto(false); }}
                className={cn('w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-semibold cursor-pointer',
                  activeTab === item.id ? 'bg-gelo text-marinho' : 'text-text-main hover:bg-canvas')}>
                <span className="w-9 h-9 rounded-xl bg-canvas grid place-items-center text-accent-glow"><Icon className="w-5 h-5" /></span>
                {item.label}
              </button>
            );
          })}
          <button onClick={() => sair()} className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-semibold text-text-muted hover:bg-canvas cursor-pointer">
            <span className="w-9 h-9 rounded-xl bg-canvas grid place-items-center"><LogOut className="w-5 h-5" /></span>Sair
          </button>
        </div>
      </Folha>
    </>
  );
};
