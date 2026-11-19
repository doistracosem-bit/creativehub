import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Plus, UserPlus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { paraInputLocal } from '../../lib/datas';
import type { Stage } from '../../types';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Já abre com este cliente escolhido (ex.: vindo da ficha do cliente) */
  initialClientName?: string;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, initialClientName }) => {
  const { addProject, clients, addClient } = useApp();
  const [projectName, setProjectName] = useState('');
  const [selectedClientName, setSelectedClientName] = useState('');
  const [isCreatingNewClient, setIsCreatingNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientNiche, setNewClientNiche] = useState('Geral');

  const [stage, setStage] = useState<Stage>('BRIEFING');
  const [progress, setProgress] = useState(10);
  const [deadline, setDeadline] = useState(
    paraInputLocal(new Date(Date.now() + 86400000 * 14).toISOString()).slice(0, 10)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && initialClientName) { setSelectedClientName(initialClientName); setIsCreatingNewClient(false); }
  }, [isOpen, initialClientName]);

  useEffect(() => {
    if (clients.length > 0 && !selectedClientName) {
      setSelectedClientName(clients[0].name);
    }
  }, [clients, selectedClientName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    let finalClient = selectedClientName;
    if (isCreatingNewClient) {
      if (!newClientName.trim()) return;
      finalClient = newClientName.trim();
      addClient(finalClient, newClientNiche);
    }

    if (!finalClient) return;

    setIsSubmitting(true);
    try {
      await addProject({
        project_name: projectName,
        client_name: finalClient,
        stage,
        progress: Number(progress),
        deadline: new Date(deadline).toISOString(),
      });
      onClose();
      // Reset
      setProjectName('');
      setIsCreatingNewClient(false);
      setNewClientName('');
      setProgress(10);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0a1f3d]/40 backdrop-blur-[2px] animate-in fade-in">
      <div className="w-full max-w-lg rounded-[28px] bg-surface p-6 shadow-elevada anim-entrar max-h-[92vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent-primary/20 text-accent-glow flex items-center justify-center">
              <FolderPlus className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-text-main">Criar Novo Projeto</h3>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-canvas text-text-muted hover:text-text-main flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-text-main block mb-1">Nome do Projeto *</label>
            <input
              type="text"
              required
              placeholder="Ex: Campanha de Lançamento Verão 2027"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="campo"
            />
          </div>

          {/* Seletor Inteligente de Cliente */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-text-main">Cliente *</label>
              <button
                type="button"
                onClick={() => setIsCreatingNewClient(!isCreatingNewClient)}
                className="text-[11px] text-accent-glow hover:underline cursor-pointer flex items-center gap-1 font-medium"
              >
                <UserPlus className="w-3 h-3" />
                <span>{isCreatingNewClient ? 'Selecionar Existente' : '+ Cadastrar Novo Cliente'}</span>
              </button>
            </div>

            {!isCreatingNewClient ? (
              <select
                value={selectedClientName}
                onChange={(e) => {
                  if (e.target.value === '__NEW__') {
                    setIsCreatingNewClient(true);
                  } else {
                    setSelectedClientName(e.target.value);
                  }
                }}
                className="campo cursor-pointer"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.niche})
                  </option>
                ))}
                <option value="__NEW__">+ Cadastrar Novo Cliente...</option>
              </select>
            ) : (
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-canvas border border-accent-glow/40 animate-in fade-in">
                <div>
                  <label className="text-[10px] text-text-muted font-mono block mb-1">Nome do Novo Cliente</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Studio Lumina"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-surface border border-border-subtle text-text-main outline-none focus:border-accent-glow"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-[10px] text-text-muted font-mono block mb-1">Nicho</label>
                  <input
                    type="text"
                    placeholder="Ex: Arquitetura, Odonto..."
                    value={newClientNiche}
                    onChange={(e) => setNewClientNiche(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-surface border border-border-subtle text-text-main outline-none focus:border-accent-glow"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-text-main block mb-1">Etapa Inicial</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as Stage)}
                className="campo cursor-pointer"
              >
                <option value="BRIEFING">BRIEFING</option>
                <option value="PRODUCAO">PRODUCAO</option>
                <option value="REVISAO">REVISAO</option>
                <option value="CONCLUIDO">CONCLUIDO</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-text-main block mb-1">Prazo de Entrega</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="campo"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-text-muted mb-1">
              <span>Progresso Inicial</span>
              <span className="font-mono font-bold text-accent-glow">{progress}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-accent-primary cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs rounded-xl bg-canvas text-text-muted hover:text-text-main cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-accent-primary hover:bg-accent-hover text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Criando...' : 'Salvar Projeto'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
