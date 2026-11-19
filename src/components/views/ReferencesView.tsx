import { useRef, useState } from 'react';
import { ExternalLink, Image as ImageIcon, LayoutTemplate, Palette, Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { normalizeNiche } from '../../../supabase/functions/_shared/briefing';
import { extractReferencePalette } from '../../lib/referenceImages';
import { extractedReferencePalette, listReferenceStyles, referenceKind, referenceSourceLink, referenceStyle } from '../../lib/references';
import type { Reference, ReferenceKind } from '../../types';
import { ReferenceEditor } from './ReferenceEditor';
import { ReferenceImage } from './ReferenceImage';
import { Folha } from '../ui/Folha';

export function ReferencesView() {
  const { references, updateReference, deleteReference } = useApp();
  const [kind, setKind] = useState<ReferenceKind>('post');
  const [style, setStyle] = useState('');
  const [niche, setNiche] = useState('');
  const [editor, setEditor] = useState<{ reference: Reference | null } | null>(null);
  const [status, setStatus] = useState('');
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Reference | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteLock = useRef(false);
  const paletteLock = useRef(false);
  const styles = listReferenceStyles(references);
  const section = references.filter((item) => referenceKind(item) === kind);
  const niches = [...new Set(section.map((item) => item.niche?.trim()).filter(Boolean))];
  const filtered = section.filter((item) => (!style || normalizeNiche(referenceStyle(item)) === normalizeNiche(style)) &&
    (!niche || normalizeNiche(item.niche || '') === normalizeNiche(niche)));

  function selectKind(next: ReferenceKind) {
    setKind(next);
    setStyle('');
    setNiche('');
    setStatus('');
  }

  async function extractPalette(reference: Reference) {
    if (paletteLock.current) return;
    paletteLock.current = true;
    setAnalyzing(reference.id);
    setStatus('');
    try {
      const palette = await extractReferencePalette(reference.image_url);
      if (!palette.length) throw new Error('Paleta vazia');
      await updateReference(reference.id, {
        ai_insights: { ...reference.ai_insights, color_palette: palette, palette_source: 'image' },
      });
      setStatus(`Paleta de “${reference.title}” atualizada.`);
    } catch {
      setStatus('Não foi possível extrair as cores. Em Editar, envie a imagem como arquivo e tente novamente.');
    } finally {
      paletteLock.current = false;
      setAnalyzing(null);
    }
  }

  function closeDelete() {
    if (deleteLock.current) return;
    setPendingDelete(null);
    setDeleteError('');
  }

  async function confirmDelete() {
    if (!pendingDelete || deleteLock.current) return;
    deleteLock.current = true;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteReference(pendingDelete.id);
      setPendingDelete(null);
      setStatus(`“${pendingDelete.title}” foi excluída da biblioteca.`);
    } catch {
      setDeleteError('Não foi possível excluir a referência. Tente novamente.');
    } finally {
      deleteLock.current = false;
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Biblioteca de referências</h2>
          <p className="mt-1 text-sm text-text-muted">Guarde posts por estilo e imagens para orientar seus briefings.</p>
        </div>
        {!editor && (
          <button type="button" className="btn-primario" onClick={() => { setStatus(''); setEditor({ reference: null }); }}>
            <Plus size={17} aria-hidden="true" /> Nova referência
          </button>
        )}
      </header>

      {!editor && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Tipo de referência" className="flex flex-wrap gap-2">
            <button type="button" className={kind === 'post' ? 'btn-primario' : 'btn-secundario'} aria-pressed={kind === 'post'}
              onClick={() => selectKind('post')}><LayoutTemplate size={17} aria-hidden="true" /> Posts</button>
            <button type="button" className={kind === 'visual' ? 'btn-primario' : 'btn-secundario'} aria-pressed={kind === 'visual'}
              onClick={() => selectKind('visual')}><ImageIcon size={17} aria-hidden="true" /> Imagens visuais</button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              Estilo
              <select className="campo w-auto max-w-[12rem]" value={style} onChange={(event) => setStyle(event.target.value)}>
                <option value="">Todos os estilos</option>
                {styles.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            {niches.length > 0 && <label className="flex items-center gap-2 text-sm">
              Nicho
              <select className="campo w-auto max-w-[12rem]" value={niche} onChange={(event) => setNiche(event.target.value)}>
                <option value="">Todos os nichos</option>
                {niches.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>}
          </div>
        </div>
      )}

      {editor && (
        <ReferenceEditor key={editor.reference?.id ?? 'new'} kind={kind} reference={editor.reference} styles={styles}
          onClose={() => setEditor(null)} onSaved={(saved, hasPalette) => {
            selectKind(referenceKind(saved));
            setEditor(null);
            setStatus(hasPalette ? 'Referência salva com a paleta da imagem.' :
              'Referência salva. Para extrair a paleta de uma imagem cujo link bloqueia a leitura, envie o arquivo em Editar.');
          }} />
      )}

      {status && <p role="status" className="rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm">{status}</p>}

      {!filtered.length && !editor && (
        <p className="cartao p-6 text-sm text-text-muted">
          {style || niche ? 'Nenhuma referência corresponde aos filtros.' : kind === 'post'
            ? 'Adicione um post do Pinterest ou de outra fonte e marque o estilo para encontrá-lo no Copilot.'
            : 'Adicione fotos, texturas ou outras imagens para a direção visual.'}
        </p>
      )}

      <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((item) => {
          const palette = extractedReferencePalette(item);
          const source = typeof item.ai_insights?.source_url === 'string' ? referenceSourceLink(item.ai_insights.source_url) : '';
          const visualStyle = referenceStyle(item);
          return (
            <article key={item.id} className="cartao overflow-hidden min-w-0">
              <div className={kind === 'post' ? 'aspect-square bg-canvas border-b border-border-subtle' : 'aspect-[16/10] bg-canvas border-b border-border-subtle'}>
                <ReferenceImage source={item.image_url ?? ''} alt={item.title}
                  className={kind === 'post' ? 'h-full w-full object-contain' : 'h-full w-full object-cover'} />
              </div>
              <div className="p-4 sm:p-5 space-y-3">
                {(visualStyle || item.niche) && <p className="text-xs font-semibold text-accent-glow break-words">{[visualStyle, item.niche].filter(Boolean).join(' · ')}</p>}
                <h3 className="text-lg font-bold leading-tight break-words">{item.title}</h3>
                {item.notes && <p className="whitespace-pre-wrap break-words text-sm text-text-muted">{item.notes}</p>}
                {palette.length > 0 && (
                  <div className="border-t border-border-subtle pt-3">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold"><Palette size={15} aria-hidden="true" /> Paleta extraída da imagem</p>
                    <div className="flex flex-wrap gap-3">
                      {palette.map((color) => (
                        <span key={color} className="flex items-center gap-1 text-[11px] text-text-muted">
                          <span aria-hidden="true" className="inline-block h-4 w-4 rounded border border-border-subtle" style={{ backgroundColor: color }} />{color}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {item.tags?.length > 0 && <p className="text-xs text-text-muted break-words">{item.tags.join(' · ')}</p>}
                <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
                  {source && <a className="btn-secundario" href={source} target="_blank" rel="noopener noreferrer">Abrir original <ExternalLink size={14} aria-hidden="true" /></a>}
                  <button type="button" className="btn-fantasma" disabled={Boolean(editor || analyzing)} onClick={() => {
                    setStatus(''); setEditor({ reference: item }); window.scrollTo({ top: 0 });
                  }}><Pencil size={14} aria-hidden="true" /> Editar</button>
                  {!palette.length && item.image_url && (
                    <button type="button" className="btn-fantasma" disabled={Boolean(analyzing || editor)} onClick={() => void extractPalette(item)}>
                      <Palette size={14} aria-hidden="true" /> {analyzing === item.id ? 'Extraindo…' : 'Extrair paleta'}
                    </button>
                  )}
                  <button type="button" className="btn-fantasma !text-red-700 hover:!bg-red-50"
                    aria-label={`Excluir ${item.title}`} disabled={Boolean(editor || analyzing || pendingDelete)}
                    onClick={() => { setDeleteError(''); setPendingDelete(item); }}>
                    <Trash2 size={14} aria-hidden="true" /> Excluir
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <Folha aberta={Boolean(pendingDelete)} aoFechar={closeDelete} titulo="Excluir referência?" largura="md"
        rodape={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <button type="button" autoFocus className="btn-fantasma" disabled={deleting} onClick={closeDelete}>Cancelar</button>
            <button type="button" className="btn-primario !bg-red-700 hover:!bg-red-800" disabled={deleting}
              onClick={() => void confirmDelete()}>
              <Trash2 size={16} aria-hidden="true" /> {deleting ? 'Excluindo…' : 'Excluir referência'}
            </button>
          </div>
        }>
        <p className="text-sm text-text-muted break-words">
          A referência <strong className="text-text-main">“{pendingDelete?.title}”</strong> será excluída permanentemente da biblioteca da equipe.
        </p>
        {deleteError && <p role="alert" className="mt-3 text-sm text-red-700">{deleteError}</p>}
      </Folha>
    </div>
  );
}
