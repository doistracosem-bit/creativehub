import React, { useState } from 'react';
import { 
  Image as ImageIcon, 
  Tag, 
  Palette, 
  Sparkles, 
  Plus, 
  Filter 
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ReferencesView: React.FC = () => {
  const { references, addReference } = useApp();
  const [selectedNiche, setSelectedNiche] = useState<string>('ALL');
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newNiche, setNewNiche] = useState('Odontologia');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newTags, setNewTags] = useState('minimalismo, clean, luz natural');

  const niches = ['ALL', ...Array.from(new Set(references.map((r) => r.niche)))];

  const filtered = selectedNiche === 'ALL'
    ? references
    : references.filter(r => r.niche.toLowerCase() === selectedNiche.toLowerCase());

  const handleAddReference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newImageUrl.trim()) return;

    await addReference({
      title: newTitle,
      niche: newNiche,
      image_url: newImageUrl,
      notes: newNotes,
      tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
      ai_insights: {
        color_palette: ['#06090E', '#2563EB', '#38BDF8'],
        visual_weight: 'Personalizado',
        typography: 'Inter / Sans-serif contemporânea',
        key_takeaway: 'Adicionado pelo criativo no workspace.',
      },
    });

    setIsAdding(false);
    setNewTitle('');
    setNewImageUrl('');
    setNewNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-accent-glow mb-1">
            <ImageIcon className="w-3.5 h-3.5" />
            Acervo Visual &amp; Moodboards
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-main tracking-tight">
            Diretório de Referências &amp; Semiótica
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Imagens de alto impacto, extração de paleta cromática e diretrizes para briefs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-canvas border border-border-subtle text-xs text-text-muted">
            <Filter className="w-3.5 h-3.5 text-accent-glow" />
            <select
              value={selectedNiche}
              onChange={(e) => setSelectedNiche(e.target.value)}
              className="bg-transparent text-text-main outline-none cursor-pointer"
            >
              {niches.map((n) => (
                <option key={n} value={n}>
                  {n === 'ALL' ? 'Todos os Nichos' : n}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-accent-primary hover:bg-accent-hover text-white flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Referência</span>
          </button>
        </div>
      </div>

      {/* Quick Add Form Drawer */}
      {isAdding && (
        <form onSubmit={handleAddReference} className="p-6 rounded-bento bg-surface border border-accent-primary/40 space-y-4 shadow-suave animate-in fade-in">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent-glow" />
              Adicionar Nova Referência Visual
            </h3>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-xs text-text-muted hover:text-text-main"
            >
              Fechar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-text-muted block mb-1">Título da Referência</label>
              <input
                type="text"
                required
                placeholder="Ex: Lookbook Brutalista"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-canvas border border-border-subtle text-text-main outline-none focus:border-accent-glow"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Nicho</label>
              <input
                type="text"
                required
                placeholder="Ex: Moda Urbana / Odonto"
                value={newNiche}
                onChange={(e) => setNewNiche(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-canvas border border-border-subtle text-text-main outline-none focus:border-accent-glow"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">URL da Imagem (Unsplash)</label>
              <input
                type="url"
                required
                placeholder="https://images.unsplash.com/..."
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-canvas border border-border-subtle text-text-main outline-none focus:border-accent-glow"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted block mb-1">Notas de Direção de Arte</label>
              <textarea
                rows={2}
                placeholder="Observações sobre iluminação, enquadramento e textura..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-canvas border border-border-subtle text-text-main outline-none focus:border-accent-glow resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1">Tags (separadas por vírgula)</label>
              <input
                type="text"
                placeholder="minimalismo, dark mode, neon"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-canvas border border-border-subtle text-text-main outline-none focus:border-accent-glow"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-accent-primary hover:bg-accent-hover text-white flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Salvar Referência
            </button>
          </div>
        </form>
      )}

      {/* Grid of References */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((ref) => (
          <div
            key={ref.id}
            className="p-5 rounded-bento bg-surface border border-border-subtle hover:border-accent-primary/40 transition-all flex flex-col justify-between shadow-suave group overflow-hidden"
          >
            <div>
              {/* Image Preview with Aspect Ratio */}
              <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden mb-4 bg-canvas border border-border-subtle">
                <img
                  src={ref.image_url}
                  alt={ref.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-canvas/90 via-canvas/20 to-transparent" />
                
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full bg-surface/90 text-accent-glow border border-border-subtle backdrop-blur-md">
                    {ref.niche}
                  </span>
                </div>
              </div>

              {/* Title & Notes */}
              <h3 className="text-base font-bold text-text-main group-hover:text-accent-glow transition-colors">
                {ref.title}
              </h3>
              
              <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
                {ref.notes}
              </p>

              {/* Palette & AI Insights */}
              {ref.ai_insights?.color_palette && (
                <div className="mt-4 pt-3 border-t border-border-subtle/60">
                  <span className="text-[10px] font-mono text-text-muted flex items-center gap-1.5 mb-2">
                    <Palette className="w-3 h-3 text-accent-glow" />
                    Paleta Extraída:
                  </span>
                  <div className="flex items-center gap-2">
                    {ref.ai_insights.color_palette.map((color, cIdx) => (
                      <div key={cIdx} className="flex items-center gap-1">
                        <span
                          className="w-5 h-5 rounded-lg border border-border-subtle shadow-sm"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                        <span className="text-[9px] font-mono text-text-muted">{color}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mt-4">
                {ref.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-lg bg-canvas text-text-muted border border-border-subtle"
                  >
                    <Tag className="w-2.5 h-2.5 opacity-60" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom info */}
            {ref.ai_insights?.key_takeaway && (
              <div className="mt-4 pt-3 border-t border-border-subtle/50 text-[11px] text-accent-glow/90 italic">
                "{ref.ai_insights.key_takeaway}"
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
