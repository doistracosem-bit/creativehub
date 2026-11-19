import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { UploadCloud } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { extractReferencePalette, referenceFileError, referenceImageTypes } from '../../lib/referenceImages';
import { extractedReferencePalette, referenceSourceLink, referenceStyle } from '../../lib/references';
import type { Reference, ReferenceKind } from '../../types';
import { ReferenceImage } from './ReferenceImage';

export function ReferenceEditor({ kind, reference, styles, onClose, onSaved }: {
  kind: ReferenceKind;
  reference: Reference | null;
  styles: string[];
  onClose: () => void;
  onSaved: (saved: Reference, hasPalette: boolean) => void;
}) {
  const { addReference, updateReference } = useApp();
  const [type, setType] = useState(kind);
  const [title, setTitle] = useState(reference?.title ?? '');
  const [niche, setNiche] = useState(reference?.niche ?? '');
  const [style, setStyle] = useState(reference ? referenceStyle(reference) : '');
  const [originalLink, setOriginalLink] = useState(reference?.ai_insights?.source_url ?? '');
  const [notes, setNotes] = useState(reference?.notes ?? '');
  const [tags, setTags] = useState(reference?.tags?.join(', ') ?? '');
  const [mode, setMode] = useState<'file' | 'link'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [imageLink, setImageLink] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const locked = useRef(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    const problem = selected ? referenceFileError(selected) : '';
    setError(problem);
    if (problem) event.target.value = '';
    setFile(selected && !problem ? selected : null);
    setPreview(selected && !problem ? URL.createObjectURL(selected) : '');
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (locked.current) return;
    const source = type === 'post' && originalLink.trim() ? referenceSourceLink(originalLink) : '';
    if (type === 'post' && originalLink.trim() && !source) {
      setError('Informe um link válido para a publicação original.');
      return;
    }
    let replacement: File | string | undefined = file ?? undefined;
    if (mode === 'link') {
      const link = referenceSourceLink(imageLink);
      if (imageLink.trim() && !link) {
        setError('Informe um link direto de imagem começando com https:// ou http://.');
        return;
      }
      if (link) {
        const host = new URL(link).hostname;
        if (host === 'pin.it' || /(^|\.)pinterest\.[a-z.]+$/i.test(host)) {
          setError('Cole a página do Pin em “Link da publicação original” e use um arquivo ou link direto para a imagem.');
          return;
        }
        replacement = link;
      }
    }
    const image = replacement ?? reference?.image_url;
    if (!title.trim() || (type === 'post' && !style.trim()) || !image) {
      setError('Preencha o título, o estilo do post e a imagem quando aplicável.');
      return;
    }
    locked.current = true;
    setSaving(true);
    setError('');
    try {
      const previous = reference && !replacement ? extractedReferencePalette(reference) : [];
      const palette = previous.length ? previous : await extractReferencePalette(image).catch(() => []);
      const fields = {
        title: title.trim(), niche: niche.trim(), notes: notes.trim(),
        tags: [...new Set(tags.split(',').map((tag) => tag.trim()).filter(Boolean))],
        ai_insights: {
          ...reference?.ai_insights,
          reference_kind: type,
          visual_style: style.trim() || undefined,
          source_url: source || undefined,
          color_palette: palette.length ? palette : undefined,
          palette_source: palette.length ? 'image' as const : undefined,
        },
      };
      const saved = reference
        ? await updateReference(reference.id, fields, replacement)
        : await addReference(fields, image);
      onSaved(saved, palette.length > 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a referência.');
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="cartao p-4 sm:p-6 space-y-4" aria-busy={saving}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold">{reference ? 'Editar referência' : 'Nova referência'}</h3>
        <button type="button" className="btn-fantasma" disabled={saving} onClick={onClose}>Fechar</button>
      </div>
      <fieldset disabled={saving} className="space-y-4 min-w-0">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm font-semibold">Tipo de referência
            <select className="campo mt-1" value={type} onChange={(event) => setType(event.target.value as ReferenceKind)}>
              <option value="post">Post</option>
              <option value="visual">Imagem visual</option>
            </select>
          </label>
          <label className="text-sm font-semibold">Título da referência
            <input className="campo mt-1" required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="text-sm font-semibold">Estilo visual
            <input className="campo mt-1" list="reference-editor-styles" placeholder="Ex. Moderno" maxLength={80}
              required={type === 'post'} value={style} onChange={(event) => setStyle(event.target.value)} />
            <datalist id="reference-editor-styles">{styles.map((option) => <option key={option} value={option} />)}</datalist>
          </label>
          <label className="text-sm font-semibold">Nicho <span className="font-normal text-text-muted">opcional</span>
            <input className="campo mt-1" placeholder="Ex. Gastronomia" maxLength={120} value={niche} onChange={(event) => setNiche(event.target.value)} />
          </label>
          {type === 'post' && (
            <label className="text-sm font-semibold sm:col-span-2">Link da publicação original <span className="font-normal text-text-muted">opcional</span>
              <input className="campo mt-1" type="url" placeholder="Link do Pin no Pinterest ou de outro site"
                value={originalLink} onChange={(event) => setOriginalLink(event.target.value)} />
            </label>
          )}
        </div>

        <fieldset className="rounded-2xl border border-border-subtle bg-canvas/40 p-3 sm:p-4 min-w-0">
          <legend className="px-1 text-sm font-semibold">Imagem da referência</legend>
          {type === 'post' && <p className="mb-3 text-sm text-text-muted">Anexe a imagem ou um print do post para o Copilot analisar o layout.</p>}
          <div className="flex flex-wrap gap-4 mb-3 text-sm">
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="reference-image-mode" checked={mode === 'file'} onChange={() => setMode('file')} /> Enviar arquivo
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="reference-image-mode" checked={mode === 'link'}
                onChange={() => { setMode('link'); setFile(null); setPreview(''); }} /> Usar link
            </label>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            {(preview || reference?.image_url) && (
              <div className="w-28 aspect-[4/3] bg-surface rounded-lg overflow-hidden border border-border-subtle shrink-0">
                <ReferenceImage source={preview || reference?.image_url || ''} alt={preview ? 'Prévia do arquivo selecionado' : 'Imagem atual'}
                  className="w-full h-full object-contain" />
              </div>
            )}
            <div className="min-w-0 w-full">
              {mode === 'file' ? (
                <>
                  <label htmlFor="reference-file" className="rotulo flex items-center gap-1.5">
                    <UploadCloud size={16} aria-hidden="true" /> Escolher imagem
                  </label>
                  <input id="reference-file" type="file" accept={referenceImageTypes.join(',')} aria-describedby="reference-file-help"
                    onChange={chooseFile} className="campo file:mr-3 file:cursor-pointer file:border-0 file:rounded-md file:bg-gelo file:px-2 file:py-1 file:font-semibold file:text-accent-primary" />
                  <p id="reference-file-help" className="mt-1 text-xs text-text-muted">JPG, PNG, WebP, GIF ou AVIF de até 5 MB.</p>
                </>
              ) : (
                <label className="text-sm font-semibold">Link direto da imagem
                  <input type="url" className="campo mt-1" placeholder="https://exemplo.com/imagem.jpg" value={imageLink}
                    onChange={(event) => setImageLink(event.target.value)} />
                </label>
              )}
            </div>
          </div>
        </fieldset>

        <label className="block text-sm font-semibold">Direção visual <span className="font-normal text-text-muted">opcional</span>
          <textarea className="campo mt-1" rows={3} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)}
            placeholder={type === 'post' ? 'O que vale aproveitar? Ex. fundo claro, título grande alinhado à esquerda, foto recortada e margens amplas.' : 'Ex. luz lateral, textura fosca e tons terrosos.'} />
        </label>
        <label className="block text-sm font-semibold">Tags <span className="font-normal text-text-muted">separadas por vírgula</span>
          <input className="campo mt-1" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Ex. grid, contraste, editorial" />
        </label>
      </fieldset>
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="btn-primario">{saving ? 'Salvando…' : 'Salvar referência'}</button>
      </div>
    </form>
  );
}
