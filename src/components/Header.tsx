import React, { useEffect, useState } from 'react';
import { Search, Plus, FolderPlus, Bell, BellRing } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { Avatar } from './ui/Folha';
import { statusNotificacao } from '../lib/notificacoes';
import { MARCA } from '../lib/marca';

interface HeaderProps {
  onNewPost?: () => void;
  onNewProject?: () => void;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onNewPost, onNewProject, searchQuery = '', setSearchQuery }) => {
  const { usuario } = useAuth();
  const { irPara } = useUI();
  const [focado, setFocado] = useState(false);
  const avisosAtivos = statusNotificacao() === 'granted';

  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); document.getElementById('hub-global-search')?.focus(); }
    };
    window.addEventListener('keydown', atalho);
    return () => window.removeEventListener('keydown', atalho);
  }, []);

  return (
    <>
      {/* Celular */}
      <header className="md:hidden sticky top-0 z-40 -mx-4 px-4 pt-[max(.75rem,env(safe-area-inset-top))] pb-3 bg-canvas/90 backdrop-blur-xl flex items-center justify-between">
        <img src={MARCA.logoEscuro} alt="Dois Traços" className="h-7 w-auto" />
        <div className="flex items-center gap-2">
          <button onClick={() => irPara('settings')} aria-label="Avisos" className="relative w-10 h-10 rounded-full grid place-items-center bg-surface border border-border-subtle text-text-muted">
            {avisosAtivos ? <BellRing className="w-[18px] h-[18px] text-marinho" /> : <Bell className="w-[18px] h-[18px]" />}
            {!avisosAtivos && <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />}
          </button>
          <button onClick={() => irPara('settings')} aria-label="Equipe e conta"><Avatar nome={usuario?.nome || '?'} tamanho={40} /></button>
        </div>
      </header>

      {/* Computador */}
      <header className="hidden md:flex items-center gap-3 pt-6 pb-2">
        <div className={cn('flex items-center flex-1 max-w-md px-3.5 h-11 rounded-xl bg-surface border transition-all',
          focado ? 'border-accent-glow ring-4 ring-accent-glow/10' : 'border-border-subtle')}>
          <Search className="w-4 h-4 text-text-muted mr-2.5 shrink-0" />
          <input id="hub-global-search" type="text" placeholder="Buscar posts, clientes ou referências…"
            value={searchQuery} onChange={(e) => setSearchQuery?.(e.target.value)}
            onFocus={() => setFocado(true)} onBlur={() => setFocado(false)}
            className="w-full bg-transparent text-sm text-text-main placeholder:text-text-muted/70 focus:outline-none" />
          <kbd className="whitespace-nowrap text-[10px] font-semibold text-text-muted px-1.5 py-0.5 rounded-md bg-canvas border border-border-subtle">Ctrl K</kbd>
        </div>
        <span className="flex-1" />
        <button onClick={() => irPara('settings')} title={avisosAtivos ? 'Avisos ativados' : 'Ativar avisos no aparelho'}
          className="relative w-11 h-11 rounded-xl grid place-items-center bg-surface border border-border-subtle text-text-muted hover:text-marinho cursor-pointer">
          {avisosAtivos ? <BellRing className="w-[18px] h-[18px] text-marinho" /> : <Bell className="w-[18px] h-[18px]" />}
          {!avisosAtivos && <span className="absolute top-2.5 right-3 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />}
        </button>
        <button onClick={onNewProject} className="btn-secundario"><FolderPlus className="w-4 h-4 text-accent-glow" />Novo projeto</button>
        <button onClick={onNewPost} className="btn-primario"><Plus className="w-4 h-4" />Novo post</button>
      </header>
    </>
  );
};
