import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientCreated?: (clientName: string) => void;
}

const COMMON_NICHES = [
  'Odontologia',
  'Moda Urbana',
  'SaaS / Tech',
  'Gastronomia',
  'Fitness',
  'Advocacia',
  'Imobiliária',
  'Arquitetura',
  'E-commerce',
  'Pet Shop'
];

export const NewClientModal: React.FC<NewClientModalProps> = ({
  isOpen,
  onClose,
  onClientCreated,
}) => {
  const { addClient } = useApp();
  const [name, setName] = useState('');
  const [niche, setNiche] = useState('Odontologia');
  const [customNiche, setCustomNiche] = useState('');
  const [isCustomNiche, setIsCustomNiche] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalNiche = isCustomNiche ? (customNiche.trim() || 'Geral') : niche;
    addClient(name, finalNiche);

    onClientCreated?.(name.trim());
    onClose();
    setName('');
    setCustomNiche('');
    setIsCustomNiche(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0a1f3d]/40 backdrop-blur-[2px] animate-in fade-in">
      <div className="w-full max-w-md rounded-bento bg-surface border border-border-subtle p-6 shadow-suave space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent-primary/20 text-accent-glow flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-text-main">Cadastrar Novo Cliente</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-canvas text-text-muted hover:text-text-main flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-text-main block mb-1">
              Nome do Cliente / Empresa *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Dra. Mariana Odonto, Studio Brutal, Lumina Tech..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="campo"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-text-main block mb-1">
              Nicho / Ramo de Atuação
            </label>
            {!isCustomNiche ? (
              <div className="space-y-2">
                <select
                  value={niche}
                  onChange={(e) => {
                    if (e.target.value === 'CUSTOM') {
                      setIsCustomNiche(true);
                    } else {
                      setNiche(e.target.value);
                    }
                  }}
                  className="campo cursor-pointer"
                >
                  {COMMON_NICHES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                  <option value="CUSTOM">+ Outro Nicho Personalizado...</option>
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  placeholder="Digite o nicho (ex: Arquitetura, Pet Shop...)"
                  value={customNiche}
                  onChange={(e) => setCustomNiche(e.target.value)}
                  className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-canvas border border-border-subtle text-text-main focus:border-accent-glow outline-none"
                />
                <button
                  type="button"
                  onClick={() => setIsCustomNiche(false)}
                  className="text-xs text-text-muted hover:text-text-main px-2 py-2"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-border-subtle flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs rounded-xl bg-canvas text-text-muted hover:text-text-main cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-accent-primary hover:bg-accent-hover text-white flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Salvar Cliente</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
