import { useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { ArrowRight, ImagePlus, Sparkles, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useUI } from '../../context/UIContext';
import { exampleContent } from '../../data/briefingExample';
import { createBriefing, generateDesignBriefing, readReferenceImage } from '../../services/aiService';
import { FORMATS, GOALS, IMAGE_LIMIT, IMAGE_TYPES, normalizeNiche, parseRequest } from '../../../supabase/functions/_shared/briefing';
import type { BriefingFormat, BriefingGoal } from '../../../supabase/functions/_shared/briefing';
import type { DesignBriefing } from '../../types';
import { BriefingResult, PreviewPlaceholder } from './BriefingResult';
import './copilot.css';

const niches = ['Odontologia', 'Moda Urbana', 'SaaS / Tech', 'Gastronomia', 'Fitness'];

export function AICopilotView() {
  const { clients, projects, publications, references, isMockMode } = useApp();
  const { abrirPost } = useUI();
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [manualNiche, setManualNiche] = useState('');
  const [format, setFormat] = useState<BriefingFormat>('CARROSSEL_4x5');
  const [goal, setGoal] = useState<BriefingGoal>('Autoridade');
  const [audience, setAudience] = useState('');
  const [prompt, setPrompt] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ briefing: DesignBriefing; contextKey: string } | null>(null);
  const request = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const resultPanel = useRef<HTMLElement>(null);

  const client = clients.find((item) => item.id === clientId);
  const registeredNiche = normalizeNiche(client?.niche ?? '') === 'geral' ? '' : client?.niche.trim();
  const niche = registeredNiche || manualNiche.trim();
  const clientName = client?.name.trim() || '';
  const uniqueClient = client && clients.filter((item) => item.name === client.name).length === 1;
  const clientProjects = uniqueClient ? projects.filter((item) => item.client_name === client.name) : [];
  const project = clientProjects.find((item) => item.id === projectId);
  const availableReferences = niche ? references.filter((item) => normalizeNiche(item.niche) === normalizeNiche(niche)) : [];
  const reference = availableReferences.find((item) => item.id === referenceId);
  const contextKey = JSON.stringify([clientId, clientName, niche, client?.notes, project?.id, project?.project_name, reference?.id, reference?.title, reference?.notes]);
  const liveContext = useRef(contextKey);
  useLayoutEffect(() => {
    liveContext.current = contextKey;
  }, [contextKey]);
  useLayoutEffect(() => () => request.current?.abort(), []);

  const currentResult = result?.contextKey === contextKey ? result.briefing : null;
  useLayoutEffect(() => {
    if (currentResult && window.matchMedia('(max-width: 67.99rem)').matches) {
      resultPanel.current?.scrollIntoView({ block: 'start' });
    }
  }, [currentResult]);

  function invalidate() {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setResult(null);
    setError('');
  }

  function clearImage() {
    setImage(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  function changeScope() {
    invalidate();
    setPrompt('');
    setAudience('');
    setReferenceId('');
    clearImage();
  }

  function changeNiche(value: string) {
    if (normalizeNiche(value) !== normalizeNiche(manualNiche)) changeScope();
    else invalidate();
    setManualNiche(value);
  }

  function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    invalidate();
    if (!IMAGE_TYPES.some((type) => type === file.type) || file.size > IMAGE_LIMIT || !file.size) {
      clearImage();
      setError('Escolha um arquivo PNG, JPG ou WebP de até 3 MB.');
      return;
    }
    setImage(file);
  }

  async function generate(previousHook?: string) {
    if (isMockMode || request.current) return;
    if (niche.length < 2 || prompt.trim().length < 12) {
      setError('Preencha o nicho e descreva a campanha com pelo menos 12 caracteres.');
      return;
    }

    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    if (!previousHook) setResult(null);
    setError('');
    const stillCurrent = () => request.current === controller && !controller.signal.aborted && liveContext.current === contextKey;

    try {
      const attachment = image ? await readReferenceImage(image) : undefined;
      if (!stillCurrent()) return;
      const context = parseRequest({
        requestId: crypto.randomUUID(), client: clientName, niche, format, goal, audience, prompt,
        project: project?.project_name.trim().slice(0, 160) || undefined,
        brandNotes: client?.notes?.trim().slice(0, 1200) || undefined,
        recentPosts: uniqueClient ? publications.filter((item) => item.client_name === client.name && item.headline.trim())
          .sort((a, b) => Date.parse(b.scheduled_for) - Date.parse(a.scheduled_for))
          .slice(0, 6).map((item) => item.headline.trim().slice(0, 150)) : undefined,
        previousHook,
        reference: reference ? { title: reference.title.slice(0, 160), notes: reference.notes.slice(0, 1000) } : undefined,
        image: attachment,
      });
      const briefing = await generateDesignBriefing(context, project?.id ?? null, controller.signal);
      if (stillCurrent()) setResult({ briefing, contextKey });
    } catch (cause) {
      if (stillCurrent()) setError(cause instanceof Error ? cause.message : 'A geração falhou. Tente novamente.');
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  function showExample() {
    invalidate();
    const briefing = createBriefing({
      requestId: crypto.randomUUID(), niche: 'Livraria de bairro', format: 'CARROSSEL_4x5', goal: 'Educativo', client: '', projectId: null,
    }, exampleContent, null);
    setResult({ briefing, contextKey });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void generate();
  }

  return (
    <div className="copilot-workspace">
      <header className="copilot-heading">
        <div className="copilot-heading-icon"><Sparkles aria-hidden="true" size={24} /></div>
        <div>
          <h2>Estúdio de briefing</h2>
          <p>Planeje a campanha, escreva o roteiro e visualize cada peça.</p>
        </div>
      </header>

      {isMockMode && (
        <div className="copilot-demo">
          <p>Conecte o Supabase para gerar briefings com o Gemini.</p>
          <button className="btn-secundario" type="button" onClick={showExample}>Ver exemplo <ArrowRight size={16} aria-hidden="true" /></button>
        </div>
      )}

      <div className="copilot-grid">
        <form className="cartao copilot-form" onSubmit={submit} aria-describedby={error ? 'copilot-error' : undefined}>
          <h3>Briefing da campanha</h3>

          {clients.length > 0 && (
            <div className="copilot-field">
              <label htmlFor="copilot-client">Cliente <small>opcional</small></label>
              <select id="copilot-client" className="campo" value={clientId} onChange={(event) => {
                changeScope();
                setManualNiche('');
                setProjectId('');
                setClientId(event.target.value);
              }}>
                <option value="">Sem cliente vinculado</option>
                {clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
          )}

          {clientProjects.length > 0 && (
            <div className="copilot-field">
              <label htmlFor="copilot-project">Projeto <small>opcional</small></label>
              <select id="copilot-project" className="campo" value={project?.id || ''} onChange={(event) => {
                changeScope();
                setProjectId(event.target.value);
              }}>
                <option value="">Sem projeto vinculado</option>
                {clientProjects.map((item) => <option key={item.id} value={item.id}>{item.project_name}</option>)}
              </select>
            </div>
          )}

          <label className="copilot-field">
            <span>Nicho</span>
            <input className="campo" list="copilot-niches" required maxLength={120}
              readOnly={Boolean(registeredNiche)} value={registeredNiche || manualNiche}
              onChange={(event) => changeNiche(event.target.value)} placeholder="Escolha ou digite um nicho" />
            <datalist id="copilot-niches">
              {niches.map((item) => <option key={item} value={item} />)}
            </datalist>
          </label>

          <div className="copilot-field-row">
            <div className="copilot-field">
              <label htmlFor="copilot-format">Formato</label>
              <select id="copilot-format" className="campo" value={format} onChange={(event) => { invalidate(); setFormat(event.target.value as BriefingFormat); }}>
                {Object.entries(FORMATS).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
              </select>
            </div>
            <div className="copilot-field">
              <label htmlFor="copilot-goal">Objetivo</label>
              <select id="copilot-goal" className="campo" value={goal} onChange={(event) => { invalidate(); setGoal(event.target.value as BriefingGoal); }}>
                {GOALS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
          </div>

          <label className="copilot-field">
            <span>Público <small>opcional</small></span>
            <input className="campo" value={audience} maxLength={400}
              onChange={(event) => { invalidate(); setAudience(event.target.value); }}
              placeholder="Ex. moradores que já compram no bairro" />
          </label>

          <label className="copilot-field">
            <span>O que a campanha precisa comunicar?</span>
            <textarea className="campo copilot-textarea" value={prompt} required minLength={12} maxLength={4000} rows={4}
              onChange={(event) => { invalidate(); setPrompt(event.target.value); }}
              placeholder="Inclua o tema, a oferta ou mensagem, o tom e os detalhes que precisam aparecer." />
          </label>

          <details className="copilot-references">
            <summary><ImagePlus size={18} aria-hidden="true" /> Referência criativa <small>opcional</small></summary>
            <div className="copilot-reference-fields">
              {availableReferences.length > 0 && (
                <div className="copilot-field">
                  <label htmlFor="copilot-reference">Notas da biblioteca</label>
                  <select id="copilot-reference" className="campo" value={reference?.id || ''}
                    onChange={(event) => { invalidate(); setReferenceId(event.target.value); }}>
                    <option value="">Nenhuma referência</option>
                    {availableReferences.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                </div>
              )}
              <label className="copilot-field">
                <span>Imagem de referência</span>
                <input className="campo copilot-upload" ref={fileInput} type="file" onChange={handleImage} accept={IMAGE_TYPES.join(',')} />
                <small>PNG, JPG ou WebP até 3 MB.</small>
              </label>
              {image && <button className="btn-fantasma copilot-remove" type="button" onClick={() => { invalidate(); clearImage(); }}>
                <X size={16} aria-hidden="true" /> Remover imagem
              </button>}
            </div>
          </details>

          {error && <p className="copilot-error" id="copilot-error" role="alert">{error}</p>}
          <button className="btn-primario copilot-submit" type="submit" disabled={busy || isMockMode}>
            <Sparkles size={18} aria-hidden="true" /> {busy ? 'Gerando briefing…' : 'Gerar briefing'}
          </button>
        </form>

        <section ref={resultPanel} className="copilot-output" aria-label="Prévia e roteiro" aria-busy={busy}>
          {currentResult
            ? <BriefingResult key={currentResult.id} briefing={currentResult} busy={busy}
                onVariation={() => void generate(currentResult.magnetic_hook)} abrirPost={abrirPost} />
            : <PreviewPlaceholder busy={busy} format={format} />}
        </section>
      </div>
    </div>
  );
}
