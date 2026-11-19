import React, { useEffect, useRef, useState } from 'react';
import { 
  Image as ImageIcon, 
  Tag, 
  Palette, 
  Sparkles, 
  Plus, 
  Filter,
  UploadCloud,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { referenceFileError, referenceImageTypes } from '../../lib/referenceImages';
import { ReferenceImage } from './ReferenceImage';

export const ReferencesView: React.FC = () => {
  const { references, addReference } = useApp();
  const [selectedNiche, setSelectedNiche] = useState<string>('ALL');
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newNiche, setNewNiche] = useState('Odontologia');
  const [imageMode, setImageMode] = useState<'file' | 'link'>('file');
  const [imageFile, setImageFile] = useState<{ file: File; preview: string } | null>(null);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newTags, setNewTags] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const preview = imageFile?.preview;

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const niches = ['ALL', ...Array.from(new Set(references.map((r) => r.niche)))];

  const filtered = selectedNiche === 'ALL'
    ? references
    : references.filter(r => r.niche.toLowerCase() === selectedNiche.toLowerCase());

  const handleAddReference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    if (!newTitle.trim() || !newNiche.trim()) {
      setError('Preencha o título e o nicho.');
      return;
    }
    const image = imageMode === 'file' ? imageFile?.file : newImageUrl.trim();
    if (!image) {
      setError(imageMode === 'file' ? 'Selecione uma imagem para enviar.' : 'Informe o link direto da imagem.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await addReference({
        title: newTitle.trim(),
        niche: newNiche.trim(),
        notes: newNotes.trim(),
        tags: [...new Set(newTags.split(',').map((tag) => tag.trim()).filter(Boolean))],
        ai_insights: {},
      }, image);
      setSelectedNiche('ALL');
      setIsAdding(false);
      setNewTitle('');
      setImageFile(null);
      setNewImageUrl('');
      setNewNotes('');
      setNewTags('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a referência. Tente novamente.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  function selectImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError('');
    if (!file) {
      setImageFile(null);
      return;
    }
    const problem = referenceFileError(file);
    if (problem) {
      event.target.value = '';
      setImageFile(null);
      setError(problem);
      return;
    }
    setImageFile({ file, preview: URL.createObjectURL(file) });
  }

  function closeForm() {
    setIsAdding(false);
    setImageFile(null);
    setError('');
  }

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
            onClick={() => isAdding ? closeForm() : setIsAdding(true)}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-accent-primary hover:bg-accent-hover text-white flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Referência</span>
          </button>
        </div>
      </div>

      {/* Quick Add Form Drawer */}
      {isAdding && (
        <form onSubmit={handleAddReference} aria-busy={saving} className="p-4 sm:p-6 rounded-bento bg-surface border border-accent-primary/40 space-y-4 shadow-suave">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent-glow" />
              Adicionar Nova Referência Visual
            </h3>
            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="text-xs text-text-muted hover:text-text-main"
            >
              Fechar
            </button>
          </div>

          <fieldset disabled={saving} className="space-y-4 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reference-title" className="rotulo">Título da referência</label>
                <input
                  id="reference-title"
                  type="text"
                  required
                  placeholder="Ex: Lookbook Brutalista"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-canvas border border-border-subtle text-text-main outline-none focus:border-accent-glow"
                />
              </div>
              <div>
                <label htmlFor="reference-niche" className="rotulo">Nicho</label>
                <input
                  id="reference-niche"
                  type="text"
                  required
                  placeholder="Ex: Moda Urbana / Odonto"
                  value={newNiche}
                  onChange={(e) => setNewNiche(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-canvas border border-border-subtle text-text-main outline-none focus:border-accent-glow"
                />
              </div>
            </div>

            <fieldset className="rounded-2xl border border-border-subtle bg-canvas/40 p-3 sm:p-4 min-w-0">
              <legend className="px-1 text-sm font-semibold text-text-main">Imagem da referência</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2 mb-3 text-sm text-text-main">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="reference-image-mode" checked={imageMode === 'file'}
                    onChange={() => { setImageMode('file'); setError(''); }} />
                  Enviar arquivo
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="reference-image-mode" checked={imageMode === 'link'}
                    onChange={() => { setImageMode('link'); setImageFile(null); setError(''); }} />
                  Usar link
                </label>
              </div>
              {imageMode === 'file' ? (
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  {preview && (
                    <div className="w-28 aspect-[4/3] rounded-lg overflow-hidden bg-surface border border-border-subtle shrink-0">
                      <ReferenceImage source={preview} alt="Prévia do arquivo selecionado" className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div className="min-w-0 w-full">
                    <label htmlFor="reference-file" className="rotulo flex items-center gap-1.5">
                      <UploadCloud size={16} aria-hidden="true" /> Escolher imagem
                    </label>
                    <input id="reference-file" type="file" accept={referenceImageTypes.join(',')}
                      aria-describedby="reference-file-help" onChange={selectImage}
                      className="campo file:mr-3 file:cursor-pointer file:border-0 file:rounded-md file:bg-gelo file:px-2 file:py-1 file:font-semibold file:text-accent-primary" />
                    {imageFile && <p className="mt-1 text-xs text-text-main break-all">{imageFile.file.name}</p>}
                    <p id="reference-file-help" className="mt-1 text-xs text-text-muted">JPG, PNG, WebP, GIF ou AVIF de até 5 MB.</p>
                  </div>
                </div>
              ) : (
                <div>
                  <label htmlFor="reference-link" className="rotulo">Link direto da imagem</label>
                  <input id="reference-link" type="url" placeholder="https://exemplo.com/imagem.jpg"
                    value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)}
                    className="campo" />
                </div>
              )}
            </fieldset>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reference-notes" className="rotulo">Notas de direção de arte</label>
                <textarea
                  id="reference-notes"
                  rows={2}
                  placeholder="Observações sobre iluminação, enquadramento e textura..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-canvas border border-border-subtle text-text-main outline-none focus:border-accent-glow resize-none"
                />
              </div>
              <div>
                <label htmlFor="reference-tags" className="rotulo">Tags (separadas por vírgula)</label>
                <input
                  id="reference-tags"
                  type="text"
                  placeholder="minimalismo, dark mode, neon"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-canvas border border-border-subtle text-text-main outline-none focus:border-accent-glow"
                />
              </div>
            </div>
          </fieldset>

          {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              className="btn-primario"
              disabled={saving}
            >
              <Plus className="w-3.5 h-3.5" />
              {saving ? 'Salvando…' : 'Salvar referência'}
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
                <ReferenceImage
                  source={ref.image_url ?? ''}
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
