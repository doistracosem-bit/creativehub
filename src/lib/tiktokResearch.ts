export const researchSources = [
  { name: 'Buffer', id: 'B', url: 'https://buffer.com/resources/best-time-to-post-on-tiktok/', date: 'setembro de 2026',
    base: '7,1 milhões de publicações via Buffer', signal: 'Mediana da taxa de engajamento. Domingo às 9h foi o horário mais forte da amostra.' },
  { name: 'Metricool', id: 'M', url: 'https://metricool.com/best-time-post-tiktok/', date: 'junho de 2026',
    base: '2,31 milhões de publicações em mais de 92 mil contas', signal: 'Visualizações mais concentradas entre 18h e 20h. Domingo às 20h foi o pico reportado.' },
  { name: 'Sprout Social', id: 'S', url: 'https://sproutsocial.com/insights/best-times-to-post-on-tiktok/', date: 'março de 2026',
    base: 'Cerca de 2 bilhões de interações em 307 mil perfis de várias redes', signal: 'Recorte do TikTok com força entre terça e quinta. Domingo ficou entre os dias mais fracos.' },
] as const;

export const researchSlots = [
  { day: 3, hour: 19, reason: 'Faixa com sinal de visualizações e engajamento em dois estudos.', format: 'Tutorial ou demonstração', sources: ['M', 'S'], confidence: 'Moderada' },
  { day: 5, hour: 20, reason: 'Horário destacado por dois estudos em suas análises de sexta.', format: 'Entretenimento curto', sources: ['M', 'B'], confidence: 'Moderada' },
  { day: 3, hour: 16, reason: 'Alternativa à noite no mesmo dia da semana.', format: 'Mesmo formato de quarta às 19h', sources: ['S'], confidence: 'Baixa' },
  { day: 0, hour: 20, reason: 'Pico na Metricool. Domingo foi fraco na Sprout.', format: 'História curta ou bastidores', sources: ['M', 'S'], confidence: 'Baixa' },
  { day: 0, hour: 9, reason: 'Pico no Buffer. Compare com o domingo à noite.', format: 'Mesmo formato de domingo às 20h', sources: ['B'], confidence: 'Baixa' },
] as const;

// Each cell counts sources that highlight at least one hour in the range for the specified day.
export const researchHeat = [
  { label: '06h–11h', sources: ['B', 'B', 'B', 'B', '', '', 'B'] },
  { label: '12h–14h', sources: ['B', 'S', 'S', 'BS', '', '', 'B'] },
  { label: '15h–17h', sources: ['S', 'S', 'S', 'S', 'S', 'B', ''] },
  { label: '18h–20h', sources: ['M', 'MS', 'MS', 'M', 'BM', 'M', 'M'] },
  { label: '21h–23h', sources: ['', 'B', 'B', 'B', 'B', '', ''] },
];

export const researchCalendar = [[16, 20, 9], [19, 20, 20], [19, 20, 9], [16, 20, 20]];
