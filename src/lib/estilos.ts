import type { PublicationStatus, Stage } from '../types';

// Cores de status pensadas para o fundo claro, harmonizando com o azul-marinho da marca
export const COR_STATUS: Record<PublicationStatus, { chip: string; ponto: string; coluna: string }> = {
  IDEIA:    { chip: 'bg-violet-50 text-violet-700 border-violet-200',   ponto: 'bg-violet-500',  coluna: 'bg-violet-500' },
  CRIANDO:  { chip: 'bg-amber-50 text-amber-800 border-amber-200',      ponto: 'bg-amber-500',   coluna: 'bg-amber-500' },
  APROVADO: { chip: 'bg-sky-50 text-sky-800 border-sky-200',            ponto: 'bg-sky-500',     coluna: 'bg-sky-500' },
  AGENDADO: { chip: 'bg-gelo text-marinho border-[#c7dbf5]',            ponto: 'bg-marinho',     coluna: 'bg-marinho' },
  POSTADO:  { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', ponto: 'bg-emerald-500', coluna: 'bg-emerald-500' },
};

export const COR_ETAPA: Record<Stage, string> = {
  BRIEFING: 'bg-violet-50 text-violet-700 border-violet-200',
  PRODUCAO: 'bg-amber-50 text-amber-800 border-amber-200',
  REVISAO: 'bg-sky-50 text-sky-800 border-sky-200',
  CONCLUIDO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
