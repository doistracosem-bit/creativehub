import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Wand2, 
  CalendarPlus, 
  Download, 
  Copy, 
  Check, 
  UploadCloud, 
  X, 
  Layers, 
  Type, 
  Palette, 
  Lightbulb, 
  FileJson, 
  Clock, 
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { generateDesignBriefing, exportPhotoshopJson } from '../../services/aiService';
import type { BriefingFormat, BriefingGoal, DesignBriefing } from '../../types';
import { Toast } from '../ui/Toast';
import { cn } from '../../lib/utils';

const NICHE_OPTIONS = [
  'Odontologia',
  'Moda Urbana',
  'SaaS / Tech',
  'Gastronomia',
  'Fitness',
];

const FORMAT_OPTIONS: { id: BriefingFormat; label: string; ratio: string; iconRatio: string }[] = [
  { id: 'CARROSSEL_4x5', label: 'Carrossel Feed', ratio: '4:5 (1080x1350)', iconRatio: 'aspect-[4/5]' },
  { id: 'STORY_9x16', label: 'Stories / Reels', ratio: '9:16 (1080x1920)', iconRatio: 'aspect-[9/16]' },
  { id: 'POST_1x1', label: 'Feed Quadrado', ratio: '1:1 (1080x1080)', iconRatio: 'aspect-square' },
];

const GOAL_OPTIONS: BriefingGoal[] = [
  'Autoridade',
  'Vendas/Black Friday',
  'Educativo',
  'Rebranding',
];

export const AICopilotView: React.FC = () => {
  const { addPublication } = useApp();

  // Estados de Entrada
  const [selectedNiche, setSelectedNiche] = useState<string>('Odontologia');
  const [isCustomNicheActive, setIsCustomNicheActive] = useState<boolean>(false);
  const [customNicheInput, setCustomNicheInput] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<BriefingFormat>('CARROSSEL_4x5');
  const [selectedGoal, setSelectedGoal] = useState<BriefingGoal>('Autoridade');
  const [userPrompt, setUserPrompt] = useState<string>(
    'Criar uma linha editorial cinematográfica mostrando o perigo do clareamento caseiro sem danificar o esmalte.'
  );
  const [referenceImage, setReferenceImage] = useState<string | null>(
    'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=600&q=80'
  );

  // Estados de Saída & Interação
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [currentBriefing, setCurrentBriefing] = useState<DesignBriefing | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [copiedCaption, setCopiedCaption] = useState<boolean>(false);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  // Estado do Toast de Notificação
  const [toastState, setToastState] = useState<{
    isOpen: boolean;
    message: string;
    type: 'success' | 'copilot' | 'info';
  }>({
    isOpen: false,
    message: '',
    type: 'copilot',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'copilot' | 'info' = 'copilot') => {
    setToastState({ isOpen: true, message, type });
  };

  // Gera briefing inicial ao montar
  useEffect(() => {
    let isMounted = true;
    generateDesignBriefing({
      niche: 'Odontologia',
      format: 'CARROSSEL_4x5',
      goal: 'Autoridade',
      userPrompt: '5 Erros no clareamento dental que destroem o esmalte',
    }).then((briefing) => {
      if (isMounted) {
        setCurrentBriefing(briefing);
      }
    });
    return () => { isMounted = false; };
  }, []);

  // Manipulador de Geração com IA
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    try {
      const generated = await generateDesignBriefing({
        niche: selectedNiche,
        format: selectedFormat,
        goal: selectedGoal,
        referenceImageUrl: referenceImage || undefined,
        userPrompt,
      });

      setCurrentBriefing(generated);
      setActiveSlideIndex(0);
      showToast('Briefing gerado com sucesso pelo Creative Copilot!', 'copilot');
    } catch (err) {
      console.error(err);
      showToast('Erro ao gerar briefing. Usando modelo de contingência.', 'info');
    } finally {
      setIsGenerating(false);
    }
  };

  // Upload de Imagem de Referência
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setReferenceImage(reader.result as string);
        showToast('Print de referência carregado no laboratório.', 'info');
      };
      reader.readAsDataURL(file);
    }
  };

  // Ação 1: Agendar no Calendário
  const handleScheduleToCalendar = async () => {
    if (!currentBriefing) return;

    try {
      const scheduledDate = new Date();
      scheduledDate.setHours(18, 0, 0, 0); // Horário nobre às 18:00

      await addPublication({
        project_id: null,
        client_name: currentBriefing.niche,
        format: selectedFormat === 'CARROSSEL_4x5' ? 'Carrossel 4:5' : selectedFormat === 'STORY_9x16' ? 'Stories 9:16' : 'Post 1:1',
        headline: currentBriefing.magnetic_hook,
        copy_text: currentBriefing.caption,
        status: 'CRIANDO',
        scheduled_for: scheduledDate.toISOString(),
        assets_ready: false,
      });

      showToast(
        `Agendado com sucesso no Calendário para hoje às 18:00 com status 'CRIANDO'!`,
        'success'
      );
    } catch {
      showToast('Erro ao agendar no calendário.', 'info');
    }
  };

  // Ação 2: Exportar para Photoshop / Illustrator
  const handleExportPhotoshop = () => {
    if (!currentBriefing) return;
    exportPhotoshopJson(currentBriefing);
    showToast(
      'Arquivo "briefing_autopilot.json" baixado para automação em Photoshop/Illustrator!',
      'success'
    );
  };

  // Copiar Legenda
  const handleCopyCaption = () => {
    if (!currentBriefing) return;
    const fullText = `${currentBriefing.caption}\n\n${currentBriefing.hashtags.join(' ')}`;
    navigator.clipboard.writeText(fullText);
    setCopiedCaption(true);
    showToast('Legenda e hashtags copiadas para a área de transferência!', 'copilot');
    setTimeout(() => setCopiedCaption(false), 2500);
  };

  // Copiar Cor Hexadecimal
  const handleCopyColor = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    showToast(`Cor ${hex} copiada com sucesso!`, 'info');
    setTimeout(() => setCopiedHex(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-bento bg-gradient-to-r from-gelo via-surface to-surface border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-suave relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-accent-glow/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-primary/30 border border-accent-glow/40 text-accent-glow text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Creative AI Copilot &bull; Photoshop / Illustrator Bridge</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-text-main tracking-tight">
            Laboratório de Automação de Design
          </h2>
          <p className="text-xs sm:text-sm text-text-muted mt-1 max-w-2xl leading-relaxed">
            Configure seu nicho, objetivo e diretrizes. O motor gera o roteiro slide a slide, paleta cromática e exporta a árvore de camadas em JSON para seus scripts de design.
          </p>
        </div>

        {/* Quick format spec pill */}
        <div className="z-10 self-start sm:self-auto flex items-center gap-2 p-3 rounded-2xl bg-canvas/70 border border-border-subtle text-xs font-mono">
          <FileJson className="w-4 h-4 text-accent-glow" />
          <div>
            <span className="text-text-muted text-[10px] block">Autopilot Bridge</span>
            <span className="text-text-main font-semibold">ExtendScript JSON Ready</span>
          </div>
        </div>
      </div>

      {/* Split View: Coluna da Esquerda (Entrada) vs Coluna da Direita (Saída Gerada) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* =====================================================================
            COLUNA DA ESQUERDA: PARÂMETROS DE ENTRADA (5 Colunas no Desktop)
           ===================================================================== */}
        <form
          onSubmit={handleGenerate}
          className="lg:col-span-5 p-6 rounded-bento bg-surface border border-border-subtle space-y-5 shadow-suave"
        >
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-accent-primary/20 text-accent-glow flex items-center justify-center">
                <Wand2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-text-main">Diretrizes do Briefing</h3>
            </div>
            <span className="text-[10px] font-mono text-text-muted uppercase">Input Studio</span>
          </div>

          {/* 1. Nicho com Chips Visuais & Opção + Outro Nicho */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-text-main">
                1. Selecione o Nicho do Cliente
              </label>
              {isCustomNicheActive && (
                <span className="text-[10px] font-mono text-accent-glow">
                  Nicho Personalizado
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {NICHE_OPTIONS.map((niche) => {
                const isSelected = !isCustomNicheActive && selectedNiche === niche;
                return (
                  <button
                    key={niche}
                    type="button"
                    onClick={() => {
                      setSelectedNiche(niche);
                      setIsCustomNicheActive(false);
                      setCustomNicheInput('');
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border",
                      isSelected
                        ? "bg-accent-primary text-white border-accent-glow shadow-sm shadow-accent-primary/30 font-semibold"
                        : "bg-canvas/80 text-text-muted hover:text-text-main border-border-subtle hover:bg-surface-hover"
                    )}
                  >
                    {niche}
                  </button>
                );
              })}

              {/* Botão + Outro Nicho */}
              <button
                type="button"
                onClick={() => {
                  setIsCustomNicheActive(true);
                  if (customNicheInput) {
                    setSelectedNiche(customNicheInput);
                  }
                }}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border",
                  isCustomNicheActive
                    ? "bg-accent-primary text-white border-accent-glow shadow-sm shadow-accent-primary/30 font-semibold"
                    : "bg-canvas/80 text-accent-glow border-accent-glow/40 hover:bg-surface-hover hover:border-accent-glow"
                )}
              >
                + Outro Nicho
              </button>
            </div>

            {/* Input Inline para Nicho Customizado */}
            {isCustomNicheActive && (
              <div className="mt-2.5 p-2.5 rounded-2xl bg-canvas border border-accent-glow/40 space-y-1.5 animate-in fade-in">
                <span className="text-[10px] font-mono text-text-muted block">
                  Digite o nicho livremente (ex: Advocacia, Imobiliária, Arquitetura, Pet Shop):
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nome do nicho..."
                    value={customNicheInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomNicheInput(val);
                      setSelectedNiche(val || 'Geral');
                    }}
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-surface border border-border-subtle text-text-main focus:border-accent-glow outline-none font-medium"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomNicheActive(false);
                      setCustomNicheInput('');
                      setSelectedNiche('Odontologia');
                    }}
                    className="text-xs text-text-muted hover:text-text-main px-2 py-1 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. Formato com Aspect Ratio */}
          <div>
            <label className="text-xs font-semibold text-text-main block mb-2">
              2. Formato de Exportação
            </label>
            <div className="grid grid-cols-3 gap-2">
              {FORMAT_OPTIONS.map((fmt) => {
                const isSelected = selectedFormat === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setSelectedFormat(fmt.id)}
                    className={cn(
                      "p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5",
                      isSelected
                        ? "bg-accent-primary/15 border-accent-glow text-accent-glow shadow-sm shadow-accent-primary/20"
                        : "bg-canvas/80 border-border-subtle text-text-muted hover:text-text-main hover:bg-surface-hover"
                    )}
                  >
                    <span className="text-[11px] font-bold block">{fmt.label}</span>
                    <span className="text-[9px] font-mono opacity-80 block">{fmt.ratio}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Objetivo */}
          <div>
            <label className="text-xs font-semibold text-text-main block mb-2">
              3. Objetivo da Campanha
            </label>
            <div className="grid grid-cols-2 gap-2">
              {GOAL_OPTIONS.map((goal) => {
                const isSelected = selectedGoal === goal;
                return (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => setSelectedGoal(goal)}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-medium border text-left transition-all cursor-pointer",
                      isSelected
                        ? "bg-accent-primary/20 border-accent-glow text-accent-glow font-bold"
                        : "bg-canvas/80 border-border-subtle text-text-muted hover:text-text-main"
                    )}
                  >
                    &bull; {goal}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Campo de Anotações / User Prompt */}
          <div>
            <label className="text-xs font-semibold text-text-main block mb-1.5">
              4. Anotações &amp; Direcionamento Criativo
            </label>
            <textarea
              rows={3}
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="Ex: Focar em estética silenciosa, quebra de objeções e chamada direta para agendamento..."
              className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-canvas border border-border-subtle text-text-main focus:border-accent-glow outline-none resize-none leading-relaxed placeholder:text-text-muted/60"
            />
          </div>

          {/* 5. Drag & Drop / Upload de Print de Referência */}
          <div>
            <label className="text-xs font-semibold text-text-main block mb-1.5">
              5. Print / Imagem de Referência (Opcional)
            </label>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />

            {referenceImage ? (
              <div className="relative rounded-2xl overflow-hidden border border-border-subtle bg-canvas p-2 flex items-center gap-3">
                <img
                  src={referenceImage}
                  alt="Referência Visual"
                  className="w-16 h-16 rounded-xl object-cover border border-border-subtle"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-text-main block truncate">
                    Referência Visual Ativa
                  </span>
                  <span className="text-[10px] text-accent-glow font-mono block">
                    Alimentando semiótica do briefing
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReferenceImage(null)}
                  className="w-7 h-7 rounded-lg bg-surface text-text-muted hover:text-rose-700 flex items-center justify-center cursor-pointer transition-colors"
                  title="Remover referência"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-4 rounded-2xl border border-dashed border-border-subtle hover:border-accent-primary/60 bg-canvas/60 text-center cursor-pointer transition-all hover:bg-surface-hover/60 group"
              >
                <UploadCloud className="w-6 h-6 text-accent-glow mx-auto mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-text-main block">
                  Arraste ou clique para subir print
                </span>
                <span className="text-[10px] text-text-muted block mt-0.5">
                  PNG, JPG ou WebP até 10MB
                </span>
              </div>
            )}
          </div>

          {/* Botão de Disparo Principal */}
          <button
            type="submit"
            disabled={isGenerating}
            className="w-full py-3.5 px-4 rounded-2xl bg-accent-primary hover:bg-accent-hover text-white text-xs font-bold flex items-center justify-center gap-2 shadow-suave shadow-accent-primary/30 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Wand2 className="w-4 h-4 animate-spin" />
                <span>Processando Semiótica &amp; Camadas...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Gerar Briefing Completo com IA</span>
              </>
            )}
          </button>
        </form>

        {/* =====================================================================
            COLUNA DA DIREITA: SAÍDA GERADA & EXPORTAÇÕES (7 Colunas no Desktop)
           ===================================================================== */}
        <div className="lg:col-span-7 space-y-6">
          {currentBriefing ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* Card 1: Título de Campanha e Gancho Magnético */}
              <div className="p-6 rounded-bento bg-surface border border-border-subtle shadow-suave space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-accent-primary/20 text-accent-glow border border-accent-glow/30">
                    {currentBriefing.format} &bull; {currentBriefing.goal}
                  </span>
                  <span className="text-text-muted text-[10px] font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-accent-glow" />
                    Gerado em tempo real
                  </span>
                </div>

                <div>
                  <h3 className="text-xs font-mono uppercase text-text-muted tracking-wider">
                    {currentBriefing.campaign_title}
                  </h3>
                  <h4 className="text-lg md:text-xl font-extrabold text-text-main mt-1 leading-snug">
                    "{currentBriefing.magnetic_hook}"
                  </h4>
                </div>

                {/* Barra de Ações de Saída: Agendar + Exportar JSON */}
                <div className="pt-3 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleScheduleToCalendar}
                      className="px-3.5 py-2 rounded-xl bg-accent-primary hover:bg-accent-hover text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-accent-primary/25 cursor-pointer transition-all active:scale-95"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      <span>Agendar no Calendário</span>
                    </button>

                    <button
                      onClick={handleExportPhotoshop}
                      className="px-3.5 py-2 rounded-xl bg-canvas hover:bg-surface-hover text-accent-glow border border-accent-glow/40 text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Exportar para Photoshop/Illustrator (.json)</span>
                    </button>
                  </div>

                  <span className="text-[10px] text-text-muted font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                    Camadas Prontas
                  </span>
                </div>
              </div>

              {/* Card 2: Visualizador Slide a Slide do Carrossel */}
              <div className="p-6 rounded-bento bg-surface border border-border-subtle shadow-suave space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-accent-primary/20 text-accent-glow flex items-center justify-center">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-text-main">
                        Estrutura Slide a Slide do Carrossel
                      </h4>
                      <span className="text-[10px] text-text-muted font-mono block">
                        Hierarquia de Títulos, Corpo e Direção de Arte
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-mono text-accent-glow">
                    Slide {activeSlideIndex + 1} de {currentBriefing.slides.length}
                  </span>
                </div>

                {/* Seletor de Abas de Slides */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {currentBriefing.slides.map((s, idx) => (
                    <button
                      key={s.slide_number}
                      onClick={() => setActiveSlideIndex(idx)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border",
                        activeSlideIndex === idx
                          ? "bg-accent-primary text-white border-accent-glow shadow-sm shadow-accent-primary/25"
                          : "bg-canvas text-text-muted hover:text-text-main border-border-subtle"
                      )}
                    >
                      {s.role === 'CAPA' ? 'Capa' : s.role === 'CTA_FINAL' ? 'CTA Final' : `Slide ${s.slide_number}`}
                    </button>
                  ))}
                </div>

                {/* Visualização do Slide Ativo */}
                {(() => {
                  const slide = currentBriefing.slides[activeSlideIndex] || currentBriefing.slides[0];
                  return (
                    <div className="p-5 rounded-2xl bg-canvas/90 border border-border-subtle/80 space-y-3 relative overflow-hidden">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border-subtle text-accent-glow font-bold uppercase">
                          Função: {slide.role}
                        </span>
                        <span className="text-text-muted text-[10px] font-mono">
                          {slide.layers?.length || 4} Camadas no Photoshop
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider block">
                          Headline / Título Principal:
                        </span>
                        <h5 className="text-base font-extrabold text-text-main leading-snug mt-0.5">
                          {slide.headline}
                        </h5>
                      </div>

                      <div>
                        <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider block">
                          Texto de Apoio / Conteúdo:
                        </span>
                        <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                          {slide.body_text}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-border-subtle/50">
                        <span className="text-[10px] font-mono text-accent-glow uppercase tracking-wider block">
                          Direção Visual / Assets:
                        </span>
                        <p className="text-xs text-text-main/90 italic mt-0.5">
                          "{slide.visual_direction}"
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Card 3: Paleta Cromática Interativa & Tipografia */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Paleta Hex */}
                <div className="p-5 rounded-bento bg-surface border border-border-subtle space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-accent-glow" />
                      Paleta Cromática (Clique p/ copiar)
                    </span>
                    <span className="text-[10px] font-mono text-text-muted">HEX</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Canvas', hex: currentBriefing.color_palette.background },
                      { label: 'Texto', hex: currentBriefing.color_palette.text },
                      { label: 'Acento', hex: currentBriefing.color_palette.primary_accent },
                      { label: 'Glow', hex: currentBriefing.color_palette.glow_accent },
                    ].map((c) => (
                      <button
                        key={c.label}
                        type="button"
                        onClick={() => handleCopyColor(c.hex)}
                        className="p-2 rounded-xl bg-canvas border border-border-subtle hover:border-accent-glow/50 transition-all flex flex-col items-center gap-1.5 cursor-pointer group"
                        title={`Copiar ${c.hex}`}
                      >
                        <span
                          className="w-8 h-8 rounded-lg border border-border-subtle shadow-inner group-hover:scale-105 transition-transform"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span className="text-[10px] font-mono text-text-main font-semibold">
                          {copiedHex === c.hex ? '✓ Copiado' : c.hex}
                        </span>
                        <span className="text-[9px] text-text-muted font-mono">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tipografia */}
                <div className="p-5 rounded-bento bg-surface border border-border-subtle space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5 text-accent-glow" />
                      Recomendação Tipográfica
                    </span>
                    <span className="text-[10px] font-mono text-text-muted">Fonts</span>
                  </div>

                  <div className="p-3 rounded-xl bg-canvas border border-border-subtle space-y-2 text-xs">
                    <div>
                      <span className="text-[10px] font-mono text-text-muted block">Família de Título:</span>
                      <strong className="text-text-main font-bold block">{currentBriefing.typography.heading_font}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-text-muted block">Família de Corpo:</span>
                      <strong className="text-text-main font-medium block">{currentBriefing.typography.body_font}</strong>
                    </div>
                    <p className="text-[10px] text-text-muted italic pt-1 border-t border-border-subtle/50">
                      {currentBriefing.typography.notes}
                    </p>
                  </div>
                </div>

              </div>

              {/* Card 4: Legenda Completa com Hashtags */}
              <div className="p-6 rounded-bento bg-surface border border-border-subtle shadow-suave space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-accent-glow/15 text-accent-glow flex items-center justify-center">
                      <Copy className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-bold text-text-main">
                      Legenda Completa para Redes Sociais
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyCaption}
                    className="px-3 py-1.5 rounded-xl bg-canvas hover:bg-accent-primary hover:text-white text-accent-glow border border-border-subtle text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  >
                    {copiedCaption ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Legenda</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-canvas/80 border border-border-subtle text-xs text-text-main font-sans leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto">
                  {currentBriefing.caption}
                </div>

                {/* Hashtags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {currentBriefing.hashtags.map((ht) => (
                    <span
                      key={ht}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-canvas border border-border-subtle text-accent-glow"
                    >
                      {ht}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="p-12 rounded-bento bg-surface border border-dashed border-border-subtle text-center space-y-3">
              <Lightbulb className="w-8 h-8 text-accent-glow mx-auto opacity-70 animate-pulse" />
              <h4 className="text-base font-bold text-text-main">Aguardando Parâmetros</h4>
              <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
                Preencha os campos ao lado e clique em "Gerar Briefing Completo com IA" para ativar o motor heurístico de design.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Toast de Feedback Notificacional Suave */}
      <Toast
        isOpen={toastState.isOpen}
        message={toastState.message}
        type={toastState.type}
        onClose={() => setToastState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
