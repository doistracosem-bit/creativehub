import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { DesignBriefing, SlideItem } from '../types';
import { FORMATS, parseContent } from '../../supabase/functions/_shared/briefing';
import type { BriefingContent, RequestContext } from '../../supabase/functions/_shared/briefing';

type BriefingIdentity = Pick<RequestContext, 'requestId' | 'niche' | 'format' | 'goal' | 'client'> & { projectId: string | null };

export function createBriefing(context: BriefingIdentity, content: BriefingContent, model: string | null): DesignBriefing {
  const { requestId, niche, format, goal, client, projectId } = context;
  const { width, height } = FORMATS[format];
  const { color_palette: palette, typography } = content;
  const slides = content.slides.map((slide, index): SlideItem => {
    const number = index + 1;
    const role = index === 0 ? 'CAPA' : number === content.slides.length ? 'CTA_FINAL' : 'CONTEUDO';
    return {
      ...slide,
      slide_number: number,
      role,
      layers: [
        { name: `Slide_${number}_Background`, type: 'shape', content: palette.background },
        { name: `Slide_${number}_Visual_Asset`, type: 'image', content: slide.visual_direction },
        { name: `Slide_${number}_Headline`, type: 'text', content: slide.headline },
        { name: `Slide_${number}_BodyCopy`, type: 'text', content: slide.body_text },
        { name: `Slide_${number}_Accent_Glow`, type: 'shape', content: palette.glow_accent },
      ],
    };
  });

  return {
    ...content,
    id: requestId, niche, format, goal, client, projectId, model, slides,
    created_at: new Date().toISOString(),
    photoshop_metadata: {
      dimensions: { width, height, dpi: 300 },
      artboard_name: `${niche.toUpperCase()}_${format}`,
      layers_tree: slides.map((slide) => ({
        artboard_index: slide.slide_number,
        name: `Artboard_${slide.slide_number}_${slide.role}`,
        headline: slide.headline,
        body: slide.body_text,
        colors: { canvas: palette.background, primary: palette.primary_accent, glow: palette.glow_accent, text: palette.text },
        fonts: { title: typography.heading_font, body: typography.body_font },
        layers: slide.layers,
      })),
    },
  };
}

export async function generateDesignBriefing(context: RequestContext, projectId: string | null, signal: AbortSignal): Promise<DesignBriefing> {
  const { data, error } = await supabase.functions.invoke<{
    requestId: string;
    model: string;
    content: unknown;
  }>('copilot-v2', { body: context, signal, timeout: 70000 });

  if (error instanceof FunctionsHttpError) {
    const response: Response = error.context;
    const payload = await response.json().catch(() => null);
    if (typeof payload?.error === 'string') throw new Error(payload.error);
    if (response.status === 404) throw new Error('A nova função do Copilot ainda precisa ser publicada no Supabase.');
    if (response.status === 401) throw new Error('Entre novamente para gerar o briefing.');
  }
  if (error) throw new Error('Não foi possível conectar ao Copiloto. Confira a conexão e tente novamente.');
  if (data?.requestId !== context.requestId || typeof data.model !== 'string' || !data.model) {
    throw new Error('O servidor devolveu uma resposta incompatível com este pedido.');
  }
  return createBriefing({ ...context, projectId }, parseContent(data.content, context.format), data.model);
}

export function exportPhotoshopJson(briefing: DesignBriefing): void {
  const exportPayload = {
    generator: 'Creative Hub - Autopilot Design Engine (Protocolo VLAEG)',
    version: '1.0.0',
    campaign: {
      id: briefing.id, title: briefing.campaign_title, niche: briefing.niche, client: briefing.client,
      format: briefing.format, goal: briefing.goal, created_at: briefing.created_at,
      model: briefing.model, strategy: briefing.strategy, call_to_action: briefing.call_to_action,
      alternative_hooks: briefing.alternative_hooks,
    },
    specs: briefing.photoshop_metadata.dimensions,
    palette: briefing.color_palette,
    typography: briefing.typography,
    artboards: briefing.photoshop_metadata.layers_tree,
    slides: briefing.slides.map((slide) => ({
      index: slide.slide_number, role: slide.role, headline: slide.headline,
      copy: slide.body_text, visual_direction: slide.visual_direction, layers: slide.layers,
    })),
    social: { caption: briefing.caption, hashtags: briefing.hashtags },
  };
  const slug = briefing.niche.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
  const url = URL.createObjectURL(new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `briefing-autopilot-${slug || 'campanha'}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readReferenceImage(file: File): Promise<NonNullable<RequestContext['image']>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem. Selecione o arquivo novamente.'));
    reader.onload = () => resolve({ mimeType: file.type, data: String(reader.result).split(',')[1] });
    reader.readAsDataURL(file);
  });
}
