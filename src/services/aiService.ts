import type { DesignBriefing, BriefingParams, SlideItem, BriefingFormat } from '../types';
import { supabase, isMockMode } from '../lib/supabase';

// Configurações de dimensão por formato para Photoshop/Illustrator
const FORMAT_SPECS: Record<BriefingFormat, { width: number; height: number; dpi: number; label: string }> = {
  CARROSSEL_4x5: { width: 1080, height: 1350, dpi: 300, label: 'Carrossel Retrato (4:5)' },
  STORY_9x16: { width: 1080, height: 1920, dpi: 300, label: 'Stories / Reels (9:16)' },
  POST_1x1: { width: 1080, height: 1080, dpi: 300, label: 'Feed Quadrado (1:1)' },
};

// ==============================================================================
// BASE HEURÍSTICA DE NICHO (Diretrizes de Direção de Arte e Copywriting)
// ==============================================================================

interface NichePreset {
  palette: { background: string; text: string; primary_accent: string; glow_accent: string; extra: string[] };
  typography: { heading_font: string; body_font: string; notes: string };
  hooks: string[];
  campaignTitle: string;
  slidesBlueprint: { role: 'CAPA' | 'CONTEUDO' | 'CTA_FINAL'; headline: string; body: string; visual: string }[];
  captionTemplate: (hook: string, niche: string) => string;
  hashtags: string[];
}

const NICHE_PRESETS: Record<string, NichePreset> = {
  odontologia: {
    palette: {
      background: '#070D14',
      text: '#F8FAFC',
      primary_accent: '#1D4ED8',
      glow_accent: '#38BDF8',
      extra: ['#E2E8F0', '#0F172A'],
    },
    typography: {
      heading_font: 'Cormorant Garamond / Plus Jakarta Sans',
      body_font: 'Inter Regular',
      notes: 'Contraste entre elegância editorial clínica e precisão biomédica.',
    },
    campaignTitle: 'Protocolo Sorriso Magnético & Ciência do Esmalte',
    hooks: [
      '5 Erros no Clareamento que Desgastam o Esmalte sem Você Perceber.',
      'A Odontologia Oculta: Por que Lentes Naturais Não Precisam Parecer Chiclete.',
      'O que o Diagnóstico com Microscopia Revela Antes do Procedimento.',
    ],
    slidesBlueprint: [
      {
        role: 'CAPA',
        headline: 'O que o seu café da manhã faz com os seus dentes.',
        body: 'Deslize para descobrir a verdade científica sobre acidez e preservação dental.',
        visual: 'Fotografia macro com luz lateral difusa e acabamento cinemático frio.',
      },
      {
        role: 'CONTEUDO',
        headline: '01. A Ilusão da Abrasão Caseira',
        body: 'Receitas caseiras de bicarbonato geram ranhuras microscópicas irreversíveis onde pigmentos se fixam com mais força.',
        visual: 'Split visual comparativo em microscopia eletrônica 3D.',
      },
      {
        role: 'CONTEUDO',
        headline: '02. O Protocolo Clínico a Laser',
        body: 'O clareamento biomédico atua por oxidação seletiva nos túbulos dentinários sem agressão térmica ou química.',
        visual: 'Esquema anatômico do dente com linha de gradiente ciano elétrico.',
      },
      {
        role: 'CONTEUDO',
        headline: '03. Longevidade com Respaldo Científico',
        body: 'Procedimentos guiados por oclusão duram até 4x mais com manutenção preventiva bianual.',
        visual: 'Tabela minimalista de comparativo de retenção de cor.',
      },
      {
        role: 'CTA_FINAL',
        headline: 'Agende sua Consulta de Avaliação Digital',
        body: 'Mapeamento 3D facial e teste estético em nosso ateliê odontológico.',
        visual: 'Card central com badge dourado e botão com efeito gloss.',
      },
    ],
    captionTemplate: (hook) =>
      `A busca por um sorriso estético nunca deve custar a saúde biológica da sua dentina.\n\n${hook}\n\n` +
      `Muitas pessoas acreditam que clarear os dentes é apenas uma questão de estética rápida, mas sem o protocolo biológico correto, o dano ao esmalte é permanente.\n\n` +
      `No nosso consultório, combinamos escaneamento óptico intraoral e odontologia baseada em evidências para garantir que cada procedimento preserve a estrutura natural do seu sorriso.\n\n` +
      `Envie uma mensagem direta ou clique no link da bio para reservar sua janela de diagnóstico com câmera intraoral em alta definição.`,
    hashtags: ['#OdontologiaEstetica', '#LentesDeContatoDental', '#ClareamentoLaser', '#OdontoDeAltaPerformance', '#SaudeBucal'],
  },

  'moda urbana': {
    palette: {
      background: '#06090E',
      text: '#F1F5F9',
      primary_accent: '#2563EB',
      glow_accent: '#06B6D4',
      extra: ['#E11D48', '#111827'],
    },
    typography: {
      heading_font: 'Space Grotesk Bold / Bebas Neue',
      body_font: 'JetBrains Mono',
      notes: 'Brutalismo urbano high-contrast com texturas de asfalto e tipografia técnica.',
    },
    campaignTitle: 'Drop Midnight 00:00 — Streetwear de Alta Resistência',
    hooks: [
      'Por que a Próxima Geração do Streetwear Abandonou os Logos Gigantes.',
      'Cortes Assimétricos e Tecidos Impermeáveis: A Engenharia do Drop 03.',
      'Edição Limitada: Apenas 50 Jaquetas Numeradas com Fibra Antirrasgo.',
    ],
    slidesBlueprint: [
      {
        role: 'CAPA',
        headline: 'MIDNIGHT DROP: A Estética da Função.',
        body: 'Lookbook técnico da nova linha de silhuetas utilitárias.',
        visual: 'Modelo em fundo asfalto escuro com iluminação estroboscópica lateral.',
      },
      {
        role: 'CONTEUDO',
        headline: '01. Tecido Ripstop Hidrofóbico',
        body: 'Resistência a chuvas torrenciais sem comprometer a respirabilidade corporal.',
        visual: 'Gotas de água em relevo macro sobre a trama têxtil preta.',
      },
      {
        role: 'CONTEUDO',
        headline: '02. Fechos YKK Impermeabilizados',
        body: 'Compartimentos de segurança selados termicamente para proteger dispositivos móveis.',
        visual: 'Explosão isométrica dos componentes da jaqueta com guias técnicas em ciano.',
      },
      {
        role: 'CONTEUDO',
        headline: '03. Numeração Serial a Laser',
        body: 'Cada peça recebe placa metálica com QR code para certificado criptográfico de posse.',
        visual: 'Close-up do tag metálico gravado em relevo.',
      },
      {
        role: 'CTA_FINAL',
        headline: 'Liberação do Checkout às 00:00',
        body: 'Ative o lembrete no link da bio. Sem reposição após o esgotamento do lote.',
        visual: 'Countdown digital em tipografia monoespaçada com glow neon.',
      },
    ],
    captionTemplate: (hook) =>
      `A verdadeira vanguarda urbana não grita; ela performa.\n\n${hook}\n\n` +
      `Projetamos a nova coleção pensando na rotina de quem transita entre o caos urbano e os ambientes de inovação. Tecidos ripstop antibacterianos, caimento arquitetônico e durabilidade extrema.\n\n` +
      `Lote estritamente limitado a 50 unidades com entrega prioritária para membros do clube.\n\n` +
      `Comente "DROP" para receber o link antecipado 15 minutos antes do lançamento oficial.`,
    hashtags: ['#StreetwearBrutalista', '#ModaUrbana', '#Techwear', '#DropLimitado', '#DesignTêxtil'],
  },

  'saas / tech': {
    palette: {
      background: '#06090E',
      text: '#F8FAFC',
      primary_accent: '#2563EB',
      glow_accent: '#38BDF8',
      extra: ['#1E293B', '#10B981'],
    },
    typography: {
      heading_font: 'Inter Tight / Plus Jakarta Sans',
      body_font: 'Fira Code',
      notes: 'Dark Glassmorphism de precisão com micro-acentos de dados e métricas em tempo real.',
    },
    campaignTitle: 'Automação Operacional & Escala B2B sem Sobrecarga',
    hooks: [
      'Como Equipes de Elite Eliminam 14 Horas Semanais de Tarefas Manuais.',
      'A Morte das Planilhas Desconexas: O Dashboard Unificado para Gestores.',
      'Sincronização Bidirecional em Milissegundos com Segurança Bancária.',
    ],
    slidesBlueprint: [
      {
        role: 'CAPA',
        headline: 'Menos Ruído Operacional. Mais Lucro Líquido.',
        body: 'O playbook de automação que as empresas de maior crescimento usam.',
        visual: 'Interface de dashboard dark mode flutuando em perspectiva isométrica.',
      },
      {
        role: 'CONTEUDO',
        headline: '01. Centralize Todos os Seus Pontos de Dados',
        body: 'Conecte seu CRM, faturamento e calendário em uma única fonte da verdade determinística.',
        visual: 'Diagrama de nós e conexões de APIs com pulsos de luz.',
      },
      {
        role: 'CONTEUDO',
        headline: '02. Reduza o Tempo de Resposta em 80%',
        body: 'Gatilhos automatizados respondem leads qualificados no momento exato de maior intenção de compra.',
        visual: 'Gráfico linear ascendente com métricas tabulares.',
      },
      {
        role: 'CONTEUDO',
        headline: '03. Governança e Rastreabilidade Total',
        body: 'Logs imutáveis de cada transação e autorização por nível de cargo na organização.',
        visual: 'Ícone de escudo de segurança com camadas translúcidas de vidro.',
      },
      {
        role: 'CTA_FINAL',
        headline: 'Inicie seu Trial Grátis de 14 Dias',
        body: 'Sem necessidade de cartão de crédito. Onboarding assistido em menos de 10 minutos.',
        visual: 'Botão com gradiente Midnight Navy para Ciano Elétrico com hover magnético.',
      },
    ],
    captionTemplate: (hook) =>
      `A complexidade é o assassino silencioso do crescimento empresarial.\n\n${hook}\n\n` +
      `Quando seu time perde metade do expediente copiando dados de um software para outro, você não está escalando — está apenas aumentando o custo do retrabalho.\n\n` +
      `Nossa plataforma automatiza o pipeline de ponta a ponta, oferecendo visibilidade completa em tempo real para tomadores de decisão.\n\n` +
      `Toque no link da bio para testar gratuitamente ou agendar uma demonstração exclusiva com um de nossos arquitetos de soluções.`,
    hashtags: ['#SaaSB2B', '#ProdutividadeTech', '#AutomacaoDeProcessos', '#GestaoInteligente', '#EscalaEmpresarial'],
  },

  gastronomia: {
    palette: {
      background: '#0B0A08',
      text: '#FDFBF7',
      primary_accent: '#D97706',
      glow_accent: '#FBBF24',
      extra: ['#1C1917', '#78350F'],
    },
    typography: {
      heading_font: 'Playfair Display Italic',
      body_font: 'Outfit',
      notes: 'Sensação aconchegante, sofisticação culinária e texturas orgânicas de ingredientes frescos.',
    },
    campaignTitle: 'Menu Degustação Autoral: Experiência Sensorial Completa',
    hooks: [
      'O Segredo por Trás do Nosso Caldo Cozido Lentamente por 36 Horas.',
      'Harmonização Perfeita: Quando o Vinho Eleva Cada Nota do Prato.',
      'Ingredientes da Estação Selecionados Diretamente de Pequenos Produtores.',
    ],
    slidesBlueprint: [
      {
        role: 'CAPA',
        headline: 'Alta Gastronomia: A Arte que se Saboreia.',
        body: 'Um passeio sensorial pelos 7 passos do nosso novo menu de inverno.',
        visual: 'Foto do prato principal com iluminação quente de vela e fumaça sutil.',
      },
      {
        role: 'CONTEUDO',
        headline: '01. Origem e Respeito aos Ingredientes',
        body: 'Priorizamos insumos orgânicos colhidos a menos de 50km do nosso restaurante.',
        visual: 'Composição de ervas frescas e grãos sobre tábua de madeira rústica.',
      },
      {
        role: 'CONTEUDO',
        headline: '02. Cocção Precisa a Vácuo',
        body: 'Preservação de todos os aromas, sucos e nutrientes através de sous-vide milimétrico.',
        visual: 'Textura macia da carne cortada ao meio com suculência evidente.',
      },
      {
        role: 'CONTEUDO',
        headline: '03. Harmonização por Sommelier',
        body: 'Rótulos exclusivos selecionados para equilibrar acidez, corpo e taninos.',
        visual: 'Taça de cristal sendo servida com reflexo âmbar.',
      },
      {
        role: 'CTA_FINAL',
        headline: 'Reserve Sua Mesa Para Este Fim de Semana',
        body: 'Capacidade reduzida para garantir atendimento personalizado e exclusivo.',
        visual: 'Ambiente aconchegante do salão à meia-luz.',
      },
    ],
    captionTemplate: (hook) =>
      `Comer não é apenas suprir uma necessidade — é vivenciar uma memória afetiva.\n\n${hook}\n\n` +
      `Nosso chef executivo desenhou o novo cardápio para provocar sentidos e despertar sensações únicas em cada garfada.\n\n` +
      `Ambiente intimista, carta de vinhos premiada e hospitalidade impecável.\n\n` +
      `As reservas para as próximas semanas já estão disponíveis pelo link na biografia. Garanta a sua experiência antes de esgotar.`,
    hashtags: ['#GastronomiaAutoral', '#MenuDegustacao', '#RestauranteDeLuxo', '#CulinariaFina', '#ExperienciaGastronomica'],
  },

  fitness: {
    palette: {
      background: '#08090C',
      text: '#F8FAFC',
      primary_accent: '#2563EB',
      glow_accent: '#38BDF8',
      extra: ['#10B981', '#1E293B'],
    },
    typography: {
      heading_font: 'Sora Extra Bold',
      body_font: 'Inter Medium',
      notes: 'Biomecânica de alta performance, energia controlada e métricas fisiológicas.',
    },
    campaignTitle: 'Metodologia de Hipertrofia Científica: Menos Tempo, Mais Estímulo',
    hooks: [
      'Por que Treinar até a Falha Supera 2 Horas de Treino Disperso.',
      'O Erro de Descanso Entre Séries que Impede Seu Ganho de Massa Muscular.',
      'Volume vs. Intensidade: O Guia Fisiológico Definitivo para Resultados Rápidos.',
    ],
    slidesBlueprint: [
      {
        role: 'CAPA',
        headline: 'Hipertrofia Baseada em Evidências.',
        body: 'Pare de treinar por intuição e domine os princípios da sobrecarga progressiva.',
        visual: 'Atleta em concentração máxima com iluminação de recorte e halteres de ferro.',
      },
      {
        role: 'CONTEUDO',
        headline: '01. Tensão Mecânica é a Rainha',
        body: 'Não é o suor que constrói músculo, é a magnitude de tensão aplicada nas fibras tipo II.',
        visual: 'Gráfico 3D da curva de força e ativação muscular.',
      },
      {
        role: 'CONTEUDO',
        headline: '02. O Mito do Volume Excessivo',
        body: 'Ultrapassar 20 séries por grupamento muscular semanal gera lixo metabólico e atrasa a recuperação.',
        visual: 'Comparativo visual de recuperação celular em 24h vs 72h.',
      },
      {
        role: 'CONTEUDO',
        headline: '03. Sono e Síntese Proteica',
        body: 'É na fase REM e sono profundo que a liberação de GH e síntese de novas miofibrilas ocorre.',
        visual: 'Dashboard de monitoramento de recuperação de sono.',
      },
      {
        role: 'CTA_FINAL',
        headline: 'Conheça o Programa de Consultoria FitLab Pro',
        body: 'Periodização individualizada com acompanhamento semanal pelo app.',
        visual: 'Mockup do aplicativo no celular com badges de evolução do aluno.',
      },
    ],
    captionTemplate: (hook) =>
      `A disciplina supera a motivação, mas a ciência supera o esforço cego.\n\n${hook}\n\n` +
      `Se você frequenta a academia há meses mas o espelho continua mostrando o mesmo reflexo, o problema não é a sua genética — é o seu método.\n\n` +
      `Na nossa consultoria, desenhamos planos de treino alinhados com sua rotina, biomecânica articular e metabolismo individual.\n\n` +
      `Clique no link da nossa página para realizar seu teste de perfil e receber seu plano de treino estruturado.`,
    hashtags: ['#HipertrofiaCientifica', '#ConsultoriaFitness', '#TreinoInteligente', '#NutricaoEsportiva', '#AltaPerformance'],
  },
};

// ==============================================================================
// FUNÇÃO DE GERAÇÃO: MOTOR IA + FALLBACK HEURÍSTICO RESILIENTE
// ==============================================================================

/** Modo demonstração (sem Supabase): modelos prontos por nicho. Com o Supabase, quem gera é o Gemini. */
function briefingDemonstracao(params: BriefingParams): DesignBriefing {
  const normalizedNiche = params.niche.toLowerCase();
  
  // Tenta encontrar preset mais próximo
  let matchedPreset: NichePreset | undefined;
  for (const [key, preset] of Object.entries(NICHE_PRESETS)) {
    if (normalizedNiche.includes(key) || key.includes(normalizedNiche)) {
      matchedPreset = preset;
      break;
    }
  }

  // Se não encontrar preset específico, usa base moderna customizada
  if (!matchedPreset) {
    matchedPreset = {
      palette: {
        background: '#06090E',
        text: '#F8FAFC',
        primary_accent: '#2563EB',
        glow_accent: '#38BDF8',
        extra: ['#111A2E', '#E2E8F0'],
      },
      typography: {
        heading_font: 'Plus Jakarta Sans Bold',
        body_font: 'Inter Regular',
        notes: 'Equilíbrio contemporâneo para produtos digitais e serviços modernos.',
      },
      campaignTitle: `Campanha Estratégica: ${params.niche}`,
      hooks: [
        `Como ${params.niche} Pode Dobrar a Conversão com Design de Alto Impacto.`,
        `O que Ninguém te Conta Sobre Estrutura de Conteúdo para ${params.niche}.`,
        `O Passo a Passo para se Posicionar como Referência Inquestionável.`,
      ],
      slidesBlueprint: [
        {
          role: 'CAPA',
          headline: `A Nova Regra do Jogo em ${params.niche}.`,
          body: 'Como se destacar em um mercado saturado utilizando autoridade visual.',
          visual: 'Composição clean com grid assimétrico e iluminação suave de acento azul.',
        },
        {
          role: 'CONTEUDO',
          headline: '01. Diagnóstico do Problema Raiz',
          body: 'Identifique o atrito invisível que faz os clientes hesitarem antes da compra.',
          visual: 'Infográfico minimalista com 3 pilares de destaque.',
        },
        {
          role: 'CONTEUDO',
          headline: '02. O Método de Transformação',
          body: 'Substitua táticas improvisadas por um fluxo validado e previsível.',
          visual: 'Esquema de fluxo linear com nós e métricas de desempenho.',
        },
        {
          role: 'CONTEUDO',
          headline: '03. Resultados Sustentáveis',
          body: 'Construa valor de longo prazo que defenda seu preço perante o mercado.',
          visual: 'Card em relevo bento com indicador de crescimento percentual.',
        },
        {
          role: 'CTA_FINAL',
          headline: 'Pronto para Transformar Seus Resultados?',
          body: 'Fale com nossa equipe agora mesmo pelo link da bio.',
          visual: 'Botão de ação central com sombra de profundidade e badge de verificação.',
        },
      ],
      captionTemplate: (hook, n) =>
        `No mercado de ${n}, percepção de valor define o limite do seu faturamento.\n\n${hook}\n\n` +
        `Quando sua marca comunica excelência através de cada ponto de contato, a negociação de preço dá lugar à decisão imediata de compra.\n\n` +
        `Confira a estrutura completa nos slides e compartilhe com quem precisa elevar o nível da sua comunicação.\n\n` +
        `Acesse o link da nossa bio para saber mais.`,
      hashtags: [`#${params.niche.replace(/\s+/g, '')}`, '#DirecaoDeArte', '#MarketingEstrategico', '#AutoridadeVisual'],
    };
  }

  // Gera o briefing combinando heurística sênior com parâmetros do usuário
  const selectedHook = matchedPreset.hooks[Math.floor(Math.random() * matchedPreset.hooks.length)];

  const specs = FORMAT_SPECS[params.format] || FORMAT_SPECS.CARROSSEL_4x5;

  const slides: SlideItem[] = matchedPreset.slidesBlueprint.map((sb, idx) => ({
    slide_number: idx + 1,
    role: sb.role,
    headline: sb.headline,
    body_text: sb.body,
    visual_direction: sb.visual,
    layers: [
      { name: `Slide_${idx + 1}_Background`, type: 'shape', content: matchedPreset.palette.background },
      { name: `Slide_${idx + 1}_Visual_Asset`, type: 'image', content: sb.visual },
      { name: `Slide_${idx + 1}_Headline`, type: 'text', content: sb.headline },
      { name: `Slide_${idx + 1}_BodyCopy`, type: 'text', content: sb.body },
      { name: `Slide_${idx + 1}_Accent_Glow`, type: 'shape', content: matchedPreset.palette.glow_accent },
    ],
  }));

  // Árvore de camadas pronta para automação Photoshop / Illustrator (ExtendScript)
  const photoshopMetadata = {
    dimensions: {
      width: specs.width,
      height: specs.height,
      dpi: specs.dpi,
    },
    artboard_name: `${params.niche.toUpperCase()}_${params.format}`,
    layers_tree: slides.map((s) => ({
      artboard_index: s.slide_number,
      name: `Artboard_${s.slide_number}_${s.role}`,
      headline: s.headline,
      body: s.body_text,
      colors: {
        canvas: matchedPreset.palette.background,
        primary: matchedPreset.palette.primary_accent,
        glow: matchedPreset.palette.glow_accent,
        text: matchedPreset.palette.text,
      },
      fonts: {
        title: matchedPreset.typography.heading_font,
        body: matchedPreset.typography.body_font,
      },
      layers: s.layers,
    })),
  };

  const briefing: DesignBriefing = {
    id: `briefing-${Date.now()}`,
    campaign_title: `${matchedPreset.campaignTitle} [${params.goal}]`,
    niche: params.niche,
    format: params.format,
    goal: params.goal,
    magnetic_hook: selectedHook,
    alternative_hooks: matchedPreset.hooks.filter((h) => h !== selectedHook),
    strategy: 'Modo demonstração: este briefing vem de um modelo pronto. Conecte o Supabase e a chave do Gemini para gerar briefings sob medida para cada cliente.',
    client_name: params.cliente?.name ?? null,
    color_palette: matchedPreset.palette,
    typography: matchedPreset.typography,
    slides,
    caption: matchedPreset.captionTemplate(selectedHook, params.niche),
    hashtags: matchedPreset.hashtags,
    photoshop_metadata: photoshopMetadata,
    created_at: new Date().toISOString(),
  };

  return briefing;
}

// ==============================================================================
// GERAÇÃO COM IA (Gemini via função "copilot" do Supabase)
// ==============================================================================

type RespostaIA = {
  campaign_title: string; magnetic_hook: string; alternative_hooks?: string[]; strategy?: string;
  color_palette: DesignBriefing['color_palette']; typography: DesignBriefing['typography'];
  slides: { role: SlideItem['role']; headline: string; body_text: string; visual_direction: string }[];
  caption: string; hashtags: string[];
};

/** Reduz o print de referência para no máximo 1024px (envio mais rápido e barato) */
async function reduzirImagem(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith('data:')) return '';
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, 1024 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}

function montarBriefing(r: RespostaIA, params: BriefingParams): DesignBriefing {
  const specs = FORMAT_SPECS[params.format] || FORMAT_SPECS.CARROSSEL_4x5;
  const pal = { ...r.color_palette, extra: r.color_palette.extra ?? [] };
  const slides: SlideItem[] = r.slides.map((sl, idx) => ({
    slide_number: idx + 1,
    role: sl.role,
    headline: sl.headline,
    body_text: sl.body_text,
    visual_direction: sl.visual_direction,
    layers: [
      { name: `Slide_${idx + 1}_Background`, type: 'shape', content: pal.background },
      { name: `Slide_${idx + 1}_Visual_Asset`, type: 'image', content: sl.visual_direction },
      { name: `Slide_${idx + 1}_Headline`, type: 'text', content: sl.headline },
      { name: `Slide_${idx + 1}_BodyCopy`, type: 'text', content: sl.body_text },
      { name: `Slide_${idx + 1}_Accent`, type: 'shape', content: pal.primary_accent },
    ],
  }));
  const hashtags = (r.hashtags || []).map((h) => (h.startsWith('#') ? h : `#${h}`));
  return {
    id: `briefing-${Date.now()}`,
    campaign_title: r.campaign_title,
    niche: params.niche,
    format: params.format,
    goal: params.goal,
    magnetic_hook: r.magnetic_hook,
    alternative_hooks: r.alternative_hooks ?? [],
    strategy: r.strategy,
    client_name: params.cliente?.name ?? null,
    color_palette: pal,
    typography: r.typography,
    slides,
    caption: r.caption,
    hashtags,
    photoshop_metadata: {
      dimensions: { width: specs.width, height: specs.height, dpi: specs.dpi },
      artboard_name: `${(params.cliente?.name || params.niche).toUpperCase().replace(/\s+/g, '_')}_${params.format}`,
      layers_tree: slides.map((s) => ({
        artboard_index: s.slide_number,
        name: `Artboard_${s.slide_number}_${s.role}`,
        headline: s.headline,
        body: s.body_text,
        colors: { canvas: pal.background, primary: pal.primary_accent, glow: pal.glow_accent, text: pal.text },
        fonts: { title: r.typography.heading_font, body: r.typography.body_font },
        layers: s.layers,
      })),
    },
    created_at: new Date().toISOString(),
  };
}

export async function generateDesignBriefing(params: BriefingParams): Promise<DesignBriefing> {
  if (isMockMode) {
    await new Promise((r) => setTimeout(r, 600));
    return briefingDemonstracao(params);
  }
  const imagem = params.referenceImageUrl ? await reduzirImagem(params.referenceImageUrl) : '';
  const { data, error } = await supabase.functions.invoke('copilot', {
    body: {
      niche: params.niche, format: params.format, goal: params.goal, userPrompt: params.userPrompt,
      cliente: params.cliente ?? null, projeto: params.projeto ?? null,
      postsRecentes: params.postsRecentes ?? [], referencias: params.referencias ?? [],
      variacao: !!params.variacao, imagem: imagem || undefined,
    },
  });
  if (error) {
    // Tenta ler a mensagem amigável que a função devolveu
    let msg = 'Não foi possível gerar o briefing agora.';
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') msg = (await ctx.json())?.erro || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (!data?.briefing) throw new Error(data?.erro || 'A IA não devolveu um briefing.');
  return montarBriefing(data.briefing as RespostaIA, params);
}

// ==============================================================================
// EXPORTADOR AUTOMATIZADO PARA PHOTOSHOP / ILLUSTRATOR (.json)
// ==============================================================================

export function exportPhotoshopJson(briefing: DesignBriefing): void {
  const exportPayload = {
    generator: 'Creative Hub - Autopilot Design Engine (Protocolo VLAEG)',
    version: '1.0.0',
    campaign: {
      id: briefing.id,
      title: briefing.campaign_title,
      niche: briefing.niche,
      format: briefing.format,
      goal: briefing.goal,
      created_at: briefing.created_at,
    },
    specs: briefing.photoshop_metadata.dimensions,
    palette: briefing.color_palette,
    typography: briefing.typography,
    artboards: briefing.photoshop_metadata.layers_tree,
    slides: briefing.slides.map((s) => ({
      index: s.slide_number,
      role: s.role,
      headline: s.headline,
      copy: s.body_text,
      visual_direction: s.visual_direction,
      layers: s.layers,
    })),
    social: {
      caption: briefing.caption,
      hashtags: briefing.hashtags,
    },
  };

  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(exportPayload, null, 2)
  )}`;

  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute('download', `briefing_autopilot_${briefing.niche.toLowerCase().replace(/\s+/g, '_')}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
