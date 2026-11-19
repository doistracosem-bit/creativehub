import React, { useState } from 'react';
import { 
  X, 
  Layers, 
  Calendar, 
  CheckCircle2, 
  Download, 
  CheckSquare, 
  Square,
  Sliders
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Project, Stage } from '../../types';
import { cn } from '../../lib/utils';

interface ProjectDetailsModalProps {
  isOpen: boolean;
  project: Project | null;
  onClose: () => void;
}

const stages: Stage[] = ['BRIEFING', 'PRODUCAO', 'REVISAO', 'CONCLUIDO'];

export const ProjectDetailsModal: React.FC<ProjectDetailsModalProps> = ({
  isOpen,
  project,
  onClose,
}) => {
  const { updateProjectStage } = useApp();

  const [checklist, setChecklist] = useState<{ id: number; label: string; done: boolean }[]>([
    { id: 1, label: 'Briefing estratégico e pesquisa semiótica', done: true },
    { id: 2, label: 'Paleta cromática e famílias tipográficas aprovadas', done: true },
    { id: 3, label: 'Pranchetas 4:5 e facas de corte finalizadas', done: false },
    { id: 4, label: 'Mockups 3D e render de apresentação', done: false },
    { id: 5, label: 'Aprovação final do cliente e liberação dos arquivos', done: false },
  ]);

  if (!isOpen || !project) return null;

  const handleStageChange = (newStage: Stage) => {
    let newProgress = project.progress;
    if (newStage === 'CONCLUIDO') newProgress = 100;
    else if (newStage === 'REVISAO' && newProgress < 80) newProgress = 85;
    else if (newStage === 'PRODUCAO' && newProgress < 30) newProgress = 65;
    else if (newStage === 'BRIEFING') newProgress = 25;

    updateProjectStage(project.id, newStage, newProgress);
  };

  const handleProgressChange = (newProgress: number) => {
    let nextStage: Stage = project.stage;
    if (newProgress === 100) nextStage = 'CONCLUIDO';
    else if (newProgress >= 80) nextStage = 'REVISAO';
    else if (newProgress > 25) nextStage = 'PRODUCAO';
    else nextStage = 'BRIEFING';

    updateProjectStage(project.id, nextStage, newProgress);
  };

  const toggleChecklistItem = (id: number) => {
    setChecklist(prev =>
      prev.map(item => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  const handleExportBriefing = () => {
    const payload = {
      project_id: project.id,
      project_name: project.project_name,
      client_name: project.client_name,
      stage: project.stage,
      progress: project.progress,
      deadline: project.deadline,
      checklist,
      exported_at: new Date().toISOString(),
    };

    const dataUri = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload, null, 2))}`;
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `prancheta_${project.client_name.toLowerCase().replace(/\s+/g, '_')}.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const formatDeadline = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0a1f3d]/40 backdrop-blur-[2px] animate-in fade-in">
      <div className="w-full max-w-xl rounded-bento bg-surface border border-border-subtle p-6 shadow-suave space-y-5 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-border-subtle">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-accent-glow uppercase tracking-wider mb-1">
              <Layers className="w-3.5 h-3.5" />
              <span>{project.client_name}</span>
            </div>
            <h3 className="text-xl font-bold text-text-main leading-snug">
              {project.project_name}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-canvas text-text-muted hover:text-text-main flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informações de Prazo e Status */}
        <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-canvas border border-border-subtle">
          <div>
            <span className="text-[10px] font-mono text-text-muted uppercase block">Prazo de Entrega</span>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-text-main mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-accent-glow" />
              <span>{formatDeadline(project.deadline)}</span>
            </div>
          </div>
          <div>
            <span className="text-[10px] font-mono text-text-muted uppercase block">Etapa do Pipeline</span>
            <select
              value={project.stage}
              onChange={(e) => handleStageChange(e.target.value as Stage)}
              className="mt-0.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-xl bg-surface border border-accent-glow/40 text-accent-glow outline-none cursor-pointer w-full"
            >
              {stages.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Progresso do Projeto com Slider Interativo */}
        <div className="space-y-2 p-4 rounded-2xl bg-canvas border border-border-subtle">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted flex items-center gap-1.5 font-medium">
              <Sliders className="w-3.5 h-3.5 text-accent-glow" />
              Ajuste de Progresso
            </span>
            <span className="font-mono font-bold text-accent-glow">{project.progress}%</span>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            value={project.progress}
            onChange={(e) => handleProgressChange(Number(e.target.value))}
            className="w-full accent-accent-primary cursor-pointer"
          />

          <div className="w-full h-1.5 rounded-full bg-surface overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent-primary to-accent-glow rounded-full transition-all duration-300"
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>

        {/* Checklist de Entregas da Prancheta */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text-main flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              Checklist de Direção de Arte
            </span>
            <span className="text-[10px] font-mono text-text-muted">
              {checklist.filter(c => c.done).length} de {checklist.length} concluídos
            </span>
          </div>

          <div className="space-y-1.5">
            {checklist.map((item) => (
              <div
                key={item.id}
                onClick={() => toggleChecklistItem(item.id)}
                className={cn(
                  "p-3 rounded-xl border text-xs flex items-center gap-2.5 cursor-pointer transition-all",
                  item.done
                    ? "bg-canvas/50 border-border-subtle/60 text-text-muted line-through opacity-80"
                    : "bg-canvas border-border-subtle text-text-main hover:border-accent-primary/40"
                )}
              >
                {item.done ? (
                  <CheckSquare className="w-4 h-4 text-emerald-700 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-text-muted shrink-0" />
                )}
                <span className="flex-1">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleExportBriefing}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-canvas hover:bg-surface-hover text-accent-glow border border-accent-glow/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Prancheta (.json)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-accent-primary hover:bg-accent-hover text-white text-xs font-semibold cursor-pointer transition-all shadow-sm active:scale-95 text-center"
          >
            Salvar e Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
