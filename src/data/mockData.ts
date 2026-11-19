import type { Project, Publication, Reference, AISession, Client } from '../types';

export const MOCK_CLIENTS: Client[] = [
  { id: 'client-1', name: 'Urban Pulse Co.', niche: 'Moda Urbana', created_at: '2026-11-01T10:00:00.000Z' },
  { id: 'client-2', name: 'Dr. Lucas Odonto', niche: 'Odontologia', created_at: '2026-11-02T10:00:00.000Z' },
  { id: 'client-3', name: 'FitLab Academia', niche: 'Fitness', created_at: '2026-11-03T10:00:00.000Z' },
  { id: 'client-4', name: 'Apex Capital', niche: 'SaaS / Tech', created_at: '2026-11-04T10:00:00.000Z' },
];

// Helpers para datas dinâmicas e realistas
const getTodayAtHour = (hour: number, minute: number = 0): string => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const getFutureDate = (daysAhead: number, hour: number = 14): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    client_name: 'Urban Pulse Co.',
    project_name: 'Campanha Black Friday - E-commerce',
    stage: 'PRODUCAO',
    deadline: getFutureDate(7, 23),
    progress: 65,
    created_at: '2026-11-10T10:00:00.000Z',
    updated_at: '2026-11-18T16:00:00.000Z',
  },
  {
    id: 'proj-2',
    client_name: 'Dr. Lucas Odonto',
    project_name: 'Rebranding Institucional - Dr. Lucas Odonto',
    stage: 'REVISAO',
    deadline: getFutureDate(4, 18),
    progress: 85,
    created_at: '2026-11-05T14:30:00.000Z',
    updated_at: '2026-11-18T14:10:00.000Z',
  },
  {
    id: 'proj-3',
    client_name: 'FitLab Academia',
    project_name: 'Social Media Mensal - FitLab',
    stage: 'BRIEFING',
    deadline: getFutureDate(18, 12),
    progress: 25,
    created_at: '2026-11-15T09:15:00.000Z',
    updated_at: '2026-11-18T11:00:00.000Z',
  },
];

export const MOCK_PUBLICATIONS: Publication[] = [
  {
    id: 'pub-1',
    responsible_email: 'voce@doistracos.com.br',
    reminder_minutes: 60,
    project_id: 'proj-2',
    client_name: 'Dr. Lucas Odonto',
    scheduled_for: getTodayAtHour(18, 0), // Hoje às 18:00
    status: 'AGENDADO',
    format: 'Carrossel Instagram',
    headline: '5 Erros no Clareamento Dental que Destroem o Esmalte',
    copy_text: 'Muitos pacientes recorrem a receitas caseiras milagrosas que na verdade causam microfissuras irreversíveis. Deslize para entender o que a odontologia estética baseada em evidências recomenda.',
    assets_ready: true,
    created_at: '2026-11-16T11:00:00.000Z',
  },
  {
    id: 'pub-2',
    responsible_email: 'ana@doistracos.com.br',
    reminder_minutes: 15,
    project_id: 'proj-1',
    client_name: 'Urban Pulse Co.',
    scheduled_for: getFutureDate(1, 19),
    status: 'CRIANDO',
    format: 'Reels / TikTok',
    headline: 'Drop Midnight 00:00 — Streetwear Brutalista',
    copy_text: 'Preview exclusivo dos novos cortes assimétricos e tecidos técnicos impermeáveis. Lote estritamente limitado a 50 peças numeradas com certificado.',
    assets_ready: false,
    created_at: '2026-11-17T15:20:00.000Z',
  },
  {
    id: 'pub-3',
    responsible_email: 'leo@doistracos.com.br',
    reminder_minutes: 60,
    project_id: 'proj-3',
    client_name: 'FitLab Academia',
    scheduled_for: getFutureDate(3, 12),
    status: 'APROVADO',
    format: 'Post Estático',
    headline: 'Menos volume, mais intensidade: a ciência da hipertrofia',
    copy_text: 'Treinar até a falha com técnica milimétrica supera 2 horas de treinos aleatórios na academia. Conheça as métricas da metodologia FitLab.',
    assets_ready: true,
    created_at: '2026-11-17T18:45:00.000Z',
  },
  {
    id: 'pub-4',
    responsible_email: 'voce@doistracos.com.br',
    reminder_minutes: 1440,
    project_id: 'proj-1',
    client_name: 'Urban Pulse Co.',
    scheduled_for: getFutureDate(5, 17),
    status: 'IDEIA',
    format: 'Stories Interativos',
    headline: 'Enquete: Qual paleta do novo anorak deve liderar o drop?',
    copy_text: 'Engajar a comunidade com enquetes comparativas (Obsidiana vs. Azul Royal) para alimentar o algoritmo e estimar o estoque pré-lançamento.',
    assets_ready: false,
    created_at: '2026-11-18T09:00:00.000Z',
  },
];

export const MOCK_REFERENCES: Reference[] = [
  {
    id: 'ref-1',
    title: 'Clínica Minimalista Nórdica',
    niche: 'Odontologia',
    image_url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=80',
    notes: 'Enquadramento cinematográfico com luz difusa lateral. Transmitir autoridade médica e requinte sem a frieza hospitalar comum.',
    tags: ['minimalismo', 'clean', 'tons terrosos', 'fotografia macro'],
    ai_insights: {
      color_palette: ['#F4F1EA', '#2C3E50', '#D4AF37', '#1A252F'],
      visual_weight: 'Elegante, espaçoso e sereno',
      typography: 'Serifada editorial sofisticada combinada com grotesk contemporânea',
      key_takeaway: 'Espaços negativos amplos ancoram percepção de serviço premium de alto ticket.',
    },
    created_at: '2026-11-12T14:00:00.000Z',
  },
  {
    id: 'ref-2',
    title: 'Editorial Brutalista High-Street',
    niche: 'Moda Urbana',
    image_url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=80',
    notes: 'Cortes angulares secos, texturas de asfalto molhado e forte contraste com feixes de iluminação neon sobre silhuetas escuras.',
    tags: ['streetwear', 'brutalismo', 'alto contraste', 'tipografia pesada'],
    ai_insights: {
      color_palette: ['#0A0A0A', '#E63946', '#38BDF8', '#F1FAEE'],
      visual_weight: 'Cinético, agressivo e denso',
      typography: 'Extra bold sans-serif com tracking negativo em caixa alta',
      key_takeaway: 'Luz pontual acentua os acabamentos e recortes das peças técnicas.',
    },
    created_at: '2026-11-14T19:30:00.000Z',
  },
  {
    id: 'ref-3',
    title: 'Interface Dark Glassmorphism',
    niche: 'SaaS B2B',
    image_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
    notes: 'Sensação tátil de instrumento de precisão. Bordas translúcidas de 1px, desfoques profundos de 20px e destaques pontuais em ciano elétrico.',
    tags: ['dark mode', 'bento grid', 'gradientes ciano', 'micro-interações'],
    ai_insights: {
      color_palette: ['#06090E', '#0C1322', '#2563EB', '#38BDF8'],
      visual_weight: 'Modular, nítido e técnico',
      typography: 'Inter com números tabulares e JetBrains Mono para dados de telemetria',
      key_takeaway: 'O contraste Navy + Ciano elimina fadiga visual e destaca CTAs com precisão cirúrgica.',
    },
    created_at: '2026-11-15T08:20:00.000Z',
  },
];

export const MOCK_AI_SESSIONS: AISession[] = [
  {
    id: 'ai-session-1',
    prompt: 'Diretrizes para campanha de lançamento de clareamento a laser premium',
    niche: 'Odontologia',
    generated_briefing: {
      angle: 'Estética com respaldo científico',
      hook: 'O que o seu café da manhã faz com os seus dentes sem você perceber',
      content_pillars: ['Mitos do clareamento', 'Rotina pós-procedimento', 'Antes e depois real'],
    },
    created_at: '2026-11-18T10:00:00.000Z',
  },
];
