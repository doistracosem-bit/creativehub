export const FORMATS = {
  CARROSSEL_4x5: { label: 'Carrossel 4:5', width: 1080, height: 1350, slides: 5 },
  STORY_9x16: { label: 'Stories / Reels 9:16', width: 1080, height: 1920, slides: 3 },
  POST_1x1: { label: 'Post 1:1', width: 1080, height: 1080, slides: 1 },
} as const;

export const GOALS = ['Autoridade', 'Vendas', 'Educativo', 'Engajamento', 'Lançamento', 'Rebranding', 'Vendas/Black Friday'] as const;
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const IMAGE_LIMIT = 3 * 1024 * 1024;
export const BODY_LIMIT = Math.ceil(IMAGE_LIMIT / 3) * 4 + 64 * 1024;

export type BriefingFormat = keyof typeof FORMATS;
export type BriefingGoal = typeof GOALS[number];
export type RequestContext = {
  requestId: string;
  niche: string;
  format: BriefingFormat;
  goal: BriefingGoal;
  client: string;
  audience: string;
  prompt: string;
  project?: string;
  brandNotes?: string;
  recentPosts?: string[];
  previousHook?: string;
  reference?: { title: string; notes: string };
  image?: { mimeType: string; data: string };
};

export type BriefingContent = {
  campaign_title: string;
  magnetic_hook: string;
  alternative_hooks: string[];
  strategy: string;
  call_to_action: string;
  color_palette: { background: string; text: string; primary_accent: string; glow_accent: string };
  typography: { heading_font: string; body_font: string; notes: string };
  slides: { headline: string; body_text: string; visual_direction: string }[];
  caption: string;
  hashtags: string[];
};

export function normalizeNiche(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Objeto inválido.');
  return value as Record<string, unknown>;
}

function field(value: unknown, min: number, max: number): string {
  if (typeof value !== 'string') throw new Error('Campo de texto inválido.');
  const clean = value.trim();
  if (clean.length < min || clean.length > max) throw new Error('Tamanho de texto inválido.');
  return clean;
}

export function parseRequest(value: unknown): RequestContext {
  const input = record(value);
  const requestId = field(input.requestId, 36, 36);
  const niche = field(input.niche, 2, 120);
  const format = field(input.format, 1, 30) as BriefingFormat;
  const goal = field(input.goal, 1, 40) as BriefingGoal;
  if (!/^[a-f\d-]{36}$/i.test(requestId) || !Object.hasOwn(FORMATS, format) || !GOALS.includes(goal)) {
    throw new Error('Contexto inválido.');
  }
  const context: RequestContext = {
    requestId, niche, format, goal,
    client: field(input.client, 0, 160),
    audience: field(input.audience, 0, 400),
    prompt: field(input.prompt, 12, 4000),
  };
  if (input.project !== undefined) context.project = field(input.project, 1, 160);
  if (input.brandNotes !== undefined) context.brandNotes = field(input.brandNotes, 1, 1200);
  if (input.previousHook !== undefined) context.previousHook = field(input.previousHook, 1, 150);
  if (input.recentPosts !== undefined) {
    if (!Array.isArray(input.recentPosts) || input.recentPosts.length > 6) throw new Error('Histórico inválido.');
    context.recentPosts = input.recentPosts.map((item) => field(item, 1, 150));
  }

  if (input.reference !== undefined) {
    const reference = record(input.reference);
    context.reference = { title: field(reference.title, 1, 160), notes: field(reference.notes, 0, 1000) };
  }

  if (input.image !== undefined) {
    const { mimeType, data } = record(input.image);
    if (!IMAGE_TYPES.some((type) => type === mimeType) || typeof mimeType !== 'string' ||
        typeof data !== 'string' || !data || data.length > IMAGE_LIMIT / 3 * 4 ||
        data.length % 4 !== 0 || !/^[A-Za-z\d+/]+={0,2}$/.test(data)) {
      throw new Error('Imagem inválida.');
    }
    const signature = atob(data.slice(0, 16));
    const valid =
      (mimeType === 'image/png' && signature.startsWith('\x89PNG\r\n\x1a\n')) ||
      (mimeType === 'image/jpeg' && signature.startsWith('\xff\xd8\xff')) ||
      (mimeType === 'image/webp' && signature.startsWith('RIFF') && signature.slice(8) === 'WEBP');
    if (!valid) throw new Error('Assinatura da imagem inválida.');
    context.image = { mimeType, data };
  }

  return context;
}

const string = { type: 'string' };
const object = (properties: Record<string, unknown>) => ({
  type: 'object', properties, required: Object.keys(properties), additionalProperties: false,
});

export function responseSchema(format: BriefingFormat) {
  const count = FORMATS[format].slides;
  return object({
    campaign_title: string, magnetic_hook: string, strategy: string, call_to_action: string,
    alternative_hooks: { type: 'array', items: string, minItems: 2, maxItems: 2 },
    color_palette: object({ background: string, text: string, primary_accent: string, glow_accent: string }),
    typography: object({ heading_font: string, body_font: string, notes: string }),
    slides: {
      type: 'array', minItems: count, maxItems: count,
      items: object({ headline: string, body_text: string, visual_direction: string }),
    },
    caption: string,
    hashtags: { type: 'array', items: string, maxItems: 8 },
  });
}

export function parseContent(value: unknown, format: BriefingFormat): BriefingContent {
  const input = record(value);
  const palette = record(input.color_palette);
  const typography = record(input.typography);
  const hex = (value: unknown) => {
    const color = field(value, 7, 7);
    if (!/^#[\da-f]{6}$/i.test(color)) throw new Error('Cor inválida.');
    return color.toUpperCase();
  };
  if (!Array.isArray(input.slides) || input.slides.length !== FORMATS[format].slides ||
      !Array.isArray(input.hashtags) || input.hashtags.length > 8) {
    throw new Error('Estrutura do roteiro inválida.');
  }
  const slides = input.slides.map((value) => {
    const slide = record(value);
    return {
      headline: field(slide.headline, 1, 96),
      body_text: field(slide.body_text, 1, 280),
      visual_direction: field(slide.visual_direction, 1, 650),
    };
  });
  if (new Set(slides.map((slide) => normalizeNiche(slide.headline))).size !== slides.length) {
    throw new Error('Títulos repetidos no roteiro.');
  }
  const hashtags = Array.from(new Set(input.hashtags.map((tag) => {
    const value = field(tag, 2, 48);
    if (!/^#[\p{L}\p{N}_]+$/u.test(value)) throw new Error('Hashtag inválida.');
    return value;
  })));
  if (!Array.isArray(input.alternative_hooks) || input.alternative_hooks.length !== 2) throw new Error('Ganchos inválidos.');
  return {
    campaign_title: field(input.campaign_title, 1, 110),
    magnetic_hook: field(input.magnetic_hook, 1, 150),
    alternative_hooks: input.alternative_hooks.map((item) => field(item, 1, 150)),
    strategy: field(input.strategy, 1, 690),
    call_to_action: field(input.call_to_action, 1, 180),
    color_palette: {
      background: hex(palette.background), text: hex(palette.text),
      primary_accent: hex(palette.primary_accent), glow_accent: hex(palette.glow_accent),
    },
    typography: {
      heading_font: field(typography.heading_font, 1, 75),
      body_font: field(typography.body_font, 1, 75),
      notes: field(typography.notes, 1, 400),
    },
    slides,
    caption: field(input.caption, 1, 2000),
    hashtags,
  };
}
