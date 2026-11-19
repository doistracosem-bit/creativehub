// ==============================================================================
// TYPES: Creative Hub (Protocolo VLAEG - Fase L: Link & Modelagem de Dados)
// ==============================================================================

export type Stage = 'BRIEFING' | 'PRODUCAO' | 'REVISAO' | 'CONCLUIDO';

export type PublicationStatus = 'IDEIA' | 'CRIANDO' | 'APROVADO' | 'AGENDADO' | 'POSTADO';

export type NavTab = 'dashboard' | 'calendar' | 'projects' | 'clients' | 'references' | 'ai-copilot' | 'settings';

export const STATUS_LABEL: Record<PublicationStatus, string> = {
  IDEIA: 'Ideia',
  CRIANDO: 'Em criação',
  APROVADO: 'Aprovado',
  AGENDADO: 'Agendado',
  POSTADO: 'Publicado',
};

export const STAGE_LABEL: Record<Stage, string> = {
  BRIEFING: 'Briefing',
  PRODUCAO: 'Produção',
  REVISAO: 'Revisão',
  CONCLUIDO: 'Concluído',
};

export interface Client {
  id: string;
  name: string;
  niche: string;
  /** WhatsApp / telefone */
  phone?: string | null;
  email?: string | null;
  instagram?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface Project {
  id: string;
  client_name: string;
  project_name: string;
  stage: Stage;
  deadline: string; // ISO 8601 string
  progress: number; // 0 a 100
  created_at: string;
  updated_at?: string;
}

export interface Publication {
  id: string;
  project_id: string | null;
  client_name: string;
  scheduled_for: string; // ISO 8601 string
  status: PublicationStatus;
  format: string; // ex: 'Carrossel', 'Reels', 'Post Estático', 'Story'
  headline: string;
  copy_text: string;
  assets_ready: boolean;
  /** E-mail de quem é responsável pela publicação (recebe o lembrete). Vazio = equipe toda. */
  responsible_email?: string | null;
  /** Minutos de antecedência do lembrete (0 = só na hora). */
  reminder_minutes?: number;
  /** Controle interno do robô de lembretes */
  reminder_sent?: boolean;
  due_sent?: boolean;
  created_at: string;
  updated_at?: string;
}

export type TeamRole = 'admin' | 'membro';

export interface TeamMember {
  email: string;
  name: string;
  role: TeamRole;
  created_at?: string;
}

export interface AIInsights {
  color_palette?: string[];
  visual_weight?: string;
  typography?: string;
  key_takeaway?: string;
  [key: string]: unknown;
}

export interface Reference {
  id: string;
  title: string;
  niche: string;
  image_url: string;
  notes: string;
  tags: string[];
  ai_insights: AIInsights;
  created_at: string;
  updated_at?: string;
}

export interface AISession {
  id: string;
  prompt: string;
  niche: string;
  generated_briefing: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

// DTOs auxiliares para inserção e atualização
export type CreateProjectInput = Omit<Project, 'id' | 'created_at' | 'updated_at'>;
export type UpdateProjectInput = Partial<CreateProjectInput>;

export type CreatePublicationInput = Omit<Publication, 'id' | 'created_at' | 'updated_at'>;
export type UpdatePublicationInput = Partial<CreatePublicationInput>;

export type CreateReferenceInput = Omit<Reference, 'id' | 'created_at' | 'updated_at'>;
export type UpdateReferenceInput = Partial<CreateReferenceInput>;

// ==============================================================================
// BRIEFING & AI COPILOT TYPES (Bloco 4: Motor de IA e Automação de Design)
// ==============================================================================

export type BriefingFormat = 'CARROSSEL_4x5' | 'STORY_9x16' | 'POST_1x1';

export type BriefingGoal = 'Autoridade' | 'Vendas' | 'Educativo' | 'Engajamento' | 'Lançamento' | 'Rebranding' | 'Vendas/Black Friday';

export interface SlideItem {
  slide_number: number;
  role: 'CAPA' | 'CONTEUDO' | 'CTA_FINAL';
  headline: string;
  body_text: string;
  visual_direction: string;
  layers?: {
    name: string;
    type: 'text' | 'image' | 'shape';
    content?: string;
  }[];
}

export interface DesignBriefing {
  id: string;
  campaign_title: string;
  niche: string;
  format: BriefingFormat;
  goal: BriefingGoal;
  magnetic_hook: string;
  /** Ganchos alternativos sugeridos pela IA */
  alternative_hooks?: string[];
  /** Por que essa abordagem funciona (explicação curta da IA) */
  strategy?: string;
  /** Nome do cliente para quem o briefing foi feito */
  client_name?: string | null;
  color_palette: {
    background: string;
    text: string;
    primary_accent: string;
    glow_accent: string;
    extra?: string[];
  };
  typography: {
    heading_font: string;
    body_font: string;
    notes: string;
  };
  slides: SlideItem[];
  caption: string;
  hashtags: string[];
  photoshop_metadata: {
    dimensions: {
      width: number;
      height: number;
      dpi: number;
    };
    artboard_name: string;
    layers_tree: Record<string, unknown>[];
  };
  created_at: string;
}

export interface BriefingParams {
  niche: string;
  format: BriefingFormat;
  goal: BriefingGoal;
  referenceImageUrl?: string;
  userPrompt: string;
  /** Contexto real do cliente para a IA não ser genérica */
  cliente?: { name: string; niche?: string; instagram?: string | null; notes?: string | null } | null;
  projeto?: string | null;
  postsRecentes?: string[];
  referencias?: string[];
  /** Pede uma versão com ângulo diferente */
  variacao?: boolean;
}
