import type { Reference } from '../types';
import { normalizeNiche } from '../../supabase/functions/_shared/briefing.ts';

export const referenceStyles = ['Moderno', 'Minimalista', 'Editorial', 'Brutalista', 'Retrô', 'Orgânico', 'Premium', 'Colorido', 'Tecnológico'];

export function referenceKind(reference: Reference) {
  return reference.ai_insights?.reference_kind === 'post' ? 'post' : 'visual';
}

export function referenceStyle(reference: Reference): string {
  return typeof reference.ai_insights?.visual_style === 'string' ? reference.ai_insights.visual_style : '';
}

export function extractedReferencePalette(reference: Reference): string[] {
  const colors = reference.ai_insights?.color_palette;
  return reference.ai_insights?.palette_source === 'image' && Array.isArray(colors)
    ? colors.filter((color) => typeof color === 'string' && /^#[\da-f]{6}$/i.test(color)).slice(0, 5)
    : [];
}

export function listReferenceStyles(references: Reference[]) {
  const options = new Map(referenceStyles.map((style) => [normalizeNiche(style), style]));
  references.forEach((reference) => {
    const style = referenceStyle(reference).trim();
    const key = normalizeNiche(style);
    if (key && !options.has(key)) options.set(key, style);
  });
  return Array.from(options.values());
}

export function briefingReferences(references: Reference[], niche: string, style: string) {
  const targetNiche = normalizeNiche(niche);
  const targetStyle = normalizeNiche(style);
  const sameNiche = (reference: Reference) => Boolean(targetNiche) && normalizeNiche(reference.niche || '') === targetNiche;
  return {
    posts: references.filter((item) => referenceKind(item) === 'post' &&
      (!targetStyle || normalizeNiche(referenceStyle(item)) === targetStyle))
      .sort((a, b) => Number(sameNiche(b)) - Number(sameNiche(a))),
    visuals: references.filter((item) => referenceKind(item) === 'visual' && sameNiche(item)),
  };
}

export function referenceSourceLink(value: string) {
  try {
    const url = new URL(value.trim());
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}
