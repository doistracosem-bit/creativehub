import { createContext, useContext } from 'react';
import type { NavTab, Project, Publication } from '../types';

export interface UIContextType {
  /** Abre o pop-up de um post existente (por id) ou de um post novo (com valores iniciais) */
  abrirPost: (id: string | null, preset?: Partial<Publication>) => void;
  abrirProjeto: (projeto: Project) => void;
  /** Abre o formulário de novo projeto (opcionalmente já com o cliente escolhido) */
  novoProjeto: (cliente?: string) => void;
  irPara: (aba: NavTab) => void;
}

export const UIContext = createContext<UIContextType>({
  abrirPost: () => {},
  abrirProjeto: () => {},
  novoProjeto: () => {},
  irPara: () => {},
});

export const useUI = () => useContext(UIContext);
