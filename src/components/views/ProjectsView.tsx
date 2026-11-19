import React, { useState } from 'react';
import { 
  FolderKanban, 
  Plus, 
  Calendar, 
  Clock, 
  ArrowUpRight,
  Trash2,
  UserPlus
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Project, Stage } from '../../types';
import { cn } from '../../lib/utils';
import { COR_ETAPA } from '../../lib/estilos';
import { STAGE_LABEL } from '../../types';
import { NewClientModal } from '../modals/NewClientModal';
import { Folha } from '../ui/Folha';

interface ProjectsViewProps {
  onNewProject: () => void;
  onOpenDetails?: (project: Project) => void;
}

const stages: Stage[] = ['BRIEFING', 'PRODUCAO', 'REVISAO', 'CONCLUIDO'];

export const ProjectsView: React.FC<ProjectsViewProps> = ({ onNewProject, onOpenDetails }) => {
  const { projects, updateProjectStage, deleteProject } = useApp();
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);

  const getStageBadgeClass = (stage: Stage) => {
    switch (stage) {
      default:
        return COR_ETAPA[stage];
    }
  };

  const handleProgressChange = (id: string, currentStage: Stage, newProgress: number) => {
    let nextStage = currentStage;
    if (newProgress === 100) nextStage = 'CONCLUIDO';
    else if (newProgress >= 80) nextStage = 'REVISAO';
    else if (newProgress > 25) nextStage = 'PRODUCAO';
    else nextStage = 'BRIEFING';

    updateProjectStage(id, nextStage, newProgress);
  };

  // Confirmação dentro do app (a janela nativa do navegador é bloqueada em alguns aparelhos)
  const [paraExcluir, setParaExcluir] = useState<Project | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState('');

  const handleDeleteProject = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setErroExclusao('');
    setParaExcluir(project);
  };

  const confirmarExclusao = async () => {
    if (!paraExcluir) return;
    setExcluindo(true);
    try {
      await deleteProject(paraExcluir.id);
      setParaExcluir(null);
    } catch {
      setErroExclusao('Não foi possível excluir. Verifique a conexão e tente de novo.');
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com botões de Ação Rápida */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-accent-glow mb-1">
            <FolderKanban className="w-3.5 h-3.5" />
            Clientes e entregas
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-main tracking-tight">
            Projetos
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Etapas, prazos e progresso de cada cliente. Toque no nome para ver os detalhes.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsNewClientOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-surface hover:bg-surface-hover text-text-main border border-border-subtle flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5 text-accent-glow" />
            <span>Novo cliente</span>
          </button>

          <button
            type="button"
            onClick={onNewProject}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-accent-primary hover:bg-accent-hover text-white flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo projeto</span>
          </button>
        </div>
      </div>

      {/* Grid de Projetos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div
            key={project.id}
            className="p-6 rounded-bento bg-surface border border-border-subtle hover:border-accent-primary/50 transition-all flex flex-col justify-between shadow-suave group relative overflow-hidden"
          >
            <div>
              {/* Top Row: Client + Stage + Botão Lixeira */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-accent-glow font-bold truncate max-w-[140px]">
                  {project.client_name}
                </span>

                <div className="flex items-center gap-2">
                  <select
                    value={project.stage}
                    onChange={(e) => updateProjectStage(project.id, e.target.value as Stage)}
                    className={cn(
                      "text-[11px] font-semibold px-2 py-1 rounded-full border cursor-pointer outline-none",
                      getStageBadgeClass(project.stage)
                    )}
                  >
                    {stages.map((st) => (
                      <option key={st} value={st}>
                        {STAGE_LABEL[st]}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteProject(e, project)}
                    className="w-7 h-7 rounded-lg bg-canvas/80 text-text-muted hover:text-rose-700 hover:bg-rose-500/10 border border-border-subtle flex items-center justify-center transition-colors cursor-pointer"
                    title="Excluir projeto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Title */}
              <h3 
                onClick={() => onOpenDetails?.(project)}
                className="text-base font-bold text-text-main group-hover:text-accent-glow transition-colors leading-snug cursor-pointer"
                title="Clique para ver prancheta e detalhes"
              >
                {project.project_name}
              </h3>

              {/* Deadline */}
              <div className="flex items-center gap-2 text-xs text-text-muted mt-3 font-mono">
                <Calendar className="w-3.5 h-3.5 text-accent-glow" />
                <span>
                  Prazo: {new Date(project.deadline).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>

              {/* Interactive Progress Bar */}
              <div className="space-y-2 mt-5 p-3 rounded-2xl bg-canvas/80 border border-border-subtle">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">Progresso</span>
                  <span className="font-mono font-bold text-accent-glow">{project.progress}%</span>
                </div>
                
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={project.progress}
                  onChange={(e) => handleProgressChange(project.id, project.stage, Number(e.target.value))}
                  className="w-full accent-accent-primary cursor-pointer"
                />

              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 mt-4 border-t border-border-subtle/50 flex items-center justify-between text-xs text-text-muted">
              <span className="flex items-center gap-1 font-mono text-[10px]">
                <Clock className="w-3 h-3 text-accent-glow" />
                Criado há {Math.floor((Date.now() - new Date(project.created_at).getTime()) / (1000 * 60 * 60 * 24))}d
              </span>

              <button
                type="button"
                onClick={() => onOpenDetails?.(project)}
                className="flex items-center gap-1 text-accent-glow hover:underline cursor-pointer font-medium"
              >
                <span>Detalhes</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}

        {projects.length === 0 && (
          <div className="col-span-full p-12 text-center rounded-bento bg-surface border border-dashed border-border-subtle text-text-muted text-sm space-y-2">
            <p>Nenhum projeto cadastrado no momento.</p>
            <button
              type="button"
              onClick={onNewProject}
              className="text-accent-glow hover:underline text-xs"
            >
              Criar o primeiro projeto agora &rarr;
            </button>
          </div>
        )}
      </div>

      {/* Confirmação de exclusão */}
      <Folha
        aberta={!!paraExcluir}
        aoFechar={() => !excluindo && setParaExcluir(null)}
        largura="md"
        titulo="Excluir projeto?"
        rodape={
          <>
            <span className="flex-1" />
            <button className="btn-fantasma" onClick={() => setParaExcluir(null)} disabled={excluindo}>Cancelar</button>
            <button className="btn-primario !bg-red-600 hover:!bg-red-700" onClick={confirmarExclusao} disabled={excluindo}>
              <Trash2 className="w-4 h-4" />{excluindo ? 'Excluindo…' : 'Excluir projeto'}
            </button>
          </>
        }
      >
        <p className="text-sm text-text-muted">
          O projeto <b className="text-text-main">{paraExcluir?.project_name}</b> ({paraExcluir?.client_name}) será apagado de vez.
          Os posts ligados a ele continuam no calendário, só ficam sem projeto.
        </p>
        {erroExclusao && <p className="text-sm text-red-700 mt-3">{erroExclusao}</p>}
      </Folha>

      {/* Modal de Novo Cliente */}
      <NewClientModal
        isOpen={isNewClientOpen}
        onClose={() => setIsNewClientOpen(false)}
      />
    </div>
  );
};
