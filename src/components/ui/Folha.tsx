import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { iniciais } from '../../lib/datas';
import { MARCA } from '../../lib/marca';

/** Janela pop-up: centralizada no computador, "folha" que sobe de baixo no celular. */
export const Folha: React.FC<{
  aberta: boolean;
  aoFechar: () => void;
  titulo?: React.ReactNode;
  topo?: React.ReactNode;
  rodape?: React.ReactNode;
  largura?: 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}> = ({ aberta, aoFechar, titulo, topo, rodape, largura = 'lg', children }) => {
  useEffect(() => {
    if (!aberta) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', esc);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = antes; };
  }, [aberta, aoFechar]);

  if (!aberta) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[#0a1f3d]/40 backdrop-blur-[2px] anim-surgir" onClick={aoFechar} />
      <div className={cn(
        'relative w-full bg-surface shadow-elevada flex flex-col max-h-[92vh] anim-folha',
        'rounded-t-[28px] sm:rounded-[28px]',
        largura === 'md' && 'sm:max-w-lg', largura === 'lg' && 'sm:max-w-2xl', largura === 'xl' && 'sm:max-w-4xl',
      )}>
        <div className="sm:hidden mx-auto mt-2.5 h-1 w-10 rounded-full bg-border-subtle" />
        {(titulo || topo) && (
          <header className="flex items-start gap-3 px-5 sm:px-7 pt-4 sm:pt-6 pb-3">
            <div className="flex-1 min-w-0">
              {topo}
              {titulo && <h2 className="text-lg sm:text-xl font-bold text-text-main leading-snug">{titulo}</h2>}
            </div>
            <button onClick={aoFechar} aria-label="Fechar" className="shrink-0 w-9 h-9 -mr-1 rounded-full grid place-items-center text-text-muted hover:bg-gelo hover:text-text-main transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </header>
        )}
        <div className="px-5 sm:px-7 pb-5 overflow-y-auto">{children}</div>
        {rodape && (
          <footer className="px-5 sm:px-7 py-4 border-t border-border-subtle flex flex-wrap items-center gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {rodape}
          </footer>
        )}
      </div>
    </div>
  );
};

export const Avatar: React.FC<{ nome: string; tamanho?: number; className?: string }> = ({ nome, tamanho = 28, className }) => (
  <span
    title={nome}
    className={cn('inline-grid place-items-center rounded-full bg-gelo text-marinho font-bold ring-2 ring-white shrink-0', className)}
    style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.38 }}
  >
    {iniciais(nome)}
  </span>
);

/** Ilustração do mascote para estados vazios */
export const Vazio: React.FC<{ texto: string; acao?: React.ReactNode; compacto?: boolean }> = ({ texto, acao, compacto }) => (
  <div className={cn('flex flex-col items-center text-center gap-2 rounded-2xl border border-dashed border-border-subtle', compacto ? 'p-4' : 'p-6')}>
    {!compacto && <img src={MARCA.mascote} alt="" className="h-20 w-auto opacity-90" />}
    <p className="text-sm text-text-muted">{texto}</p>
    {acao}
  </div>
);
