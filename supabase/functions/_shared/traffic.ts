export const FUNNELS = {
  whatsapp: { label: 'WhatsApp', entry: 'Conversas', qualified: 'Leads qualificados', open: 'Negociações abertas', rule: 'Avalie a qualidade das conversas e a maturação das negociações antes de sugerir mudanças de mídia.' },
  leads: { label: 'Captação de leads', entry: 'Leads', qualified: 'Leads qualificados', open: 'Negociações abertas', rule: 'Separe geração de leads, qualificação e fechamento. Considere o prazo de retorno comercial.' },
  ecommerce: { label: 'E-commerce', entry: 'Adições ao carrinho', qualified: 'Checkouts iniciados', open: 'Checkouts em aberto', rule: 'Avalie a progressão do carrinho ao checkout e a atribuição das compras. Use receita atribuída, quando disponível.' },
} as const;

export const PLAYBOOK_VERSION = '1.0.0';
const rules = { minSalesToObserve: 2, maxWeakEntries: 2, minQualifiedSignal: 3, minRetestSales: 5 };
export const MAX_CREATIVES = 40;
export const MAX_GROUPS = 20;
export const MAX_CSV_BYTES = 96_000;
export const MAX_LEADS_PER_CREATIVE = 12;
export const COUNTS = ['impressions', 'clicks', 'entries', 'qualified', 'open', 'sales'] as const;
export const VALUES = ['spend', ...COUNTS, 'revenue'] as const;
export const SOURCES = { manual: 'Real · entrada manual', csv: 'Real · CSV importado', simulated: 'Simulado' } as const;

export type Funnel = keyof typeof FUNNELS;
export type Origin = keyof typeof SOURCES;
export const LEAD_STAGES = { new: 'Novo', qualified: 'Qualificado', open: 'Em negociação', won: 'Venda confirmada', lost: 'Encerrado sem venda' } as const;
export type Lead = { contact: string; stage: keyof typeof LEAD_STAGES };
export type Creative = { name: string; format: string; angle: string; group: string; leads?: Lead[] } & Record<(typeof VALUES)[number], number | null> & { spend: number; sales: number };
export type Plan = ReturnType<typeof parsePlan>;
export type Snapshot = ReturnType<typeof parseSnapshot>;
export type Diagnosis = ReturnType<typeof diagnose>;
export type Color = 'green' | 'yellow' | 'red' | 'gray';
export type Advice = { summary: string; recommendations: { target: number; context: string; action: string; rationale: string }[]; model: string };
export type CampaignRow = { id: string; client_id: string; plan: Plan; created_at: string };
export type ReportRow = {
  id: string; client_id: string; campaign_id: string; previous_id: string | null; created_at: string;
  snapshot: Snapshot; diagnosis: Diagnosis; advice: Advice | null;
};

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Dados inválidos.');
  return value as Record<string, unknown>;
}

function label(value: unknown, field: string, optional = false, limit = 100) {
  if (optional && (value == null || value === '')) return '';
  if (typeof value !== 'string' || (!optional && !value.trim()) || value.trim().length > limit) {
    throw new Error(`${field} deve ter ${optional ? 'até' : 'entre 1 e'} ${limit} caracteres.`);
  }
  return value.trim();
}

function number(value: unknown, field: string, optional: true, money?: boolean): number | null;
function number(value: unknown, field: string, optional?: false, money?: boolean): number;
function number(value: unknown, field: string, optional = false, money = false) {
  if (optional && value == null) return null;
  const limit = money || field === 'Vendas' ? 1_000_000 : 1_000_000_000;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > limit ||
      (money ? Math.abs(value * 100 - Math.round(value * 100)) > 0.0001 : !Number.isInteger(value))) {
    throw new Error(`${field} deve ser ${money ? 'um valor com até duas casas decimais' : 'um inteiro'} entre 0 e ${limit.toLocaleString('pt-BR')}.`);
  }
  return value;
}

function member<T extends string>(value: unknown, options: readonly T[], error: string): T {
  if (!options.includes(value as T)) throw new Error(error);
  return value as T;
}

function date(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) {
    throw new Error('Informe uma data válida para o período.');
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Informe uma data válida para o período.');
  }
  return value;
}

const cents = (amount: number) => Math.round(amount * 100);
const sumMoney = (items: number[]) => items.reduce((sum, item) => sum + cents(item), 0) / 100;
const divide = (top: number | null, bottom: number | null, scale = 1) =>
  top !== null && bottom !== null && bottom > 0 ? top * scale / bottom : null;

export function parsePlan(input: unknown) {
  const value = record(input);
  const name = label(value.name, 'Nome da campanha');
  const objective = label(value.objective, 'Objetivo', false, 240);
  const funnel = member(value.funnel, Object.keys(FUNNELS) as Funnel[], 'Selecione um funil.');
  const mode = member(value.mode, ['ABO', 'CBO'] as const, 'Selecione ABO ou CBO.');
  const budget = number(value.budget, 'Teto planejado', false, true);
  const reserve = number(value.reserve, 'Reserva', false, true);
  const minRetestSales = number(value.minRetestSales, 'Vendas mínimas para reteste', true) ?? rules.minRetestSales;
  const start = date(value.start);
  const end = date(value.end);
  if (start > end) throw new Error('A data final deve ser igual ou posterior à inicial.');
  if (budget === 0 || reserve >= budget) throw new Error('O teto precisa ser positivo e a reserva deve ser menor que o teto.');
  if (minRetestSales < rules.minRetestSales || minRetestSales > 1000) throw new Error('Use de 5 a 1.000 vendas mínimas para reteste.');
  if (!Array.isArray(value.groups) || value.groups.length < 1 || value.groups.length > MAX_GROUPS) {
    throw new Error(`Inclua de 1 a ${MAX_GROUPS} conjuntos.`);
  }
  const groups = value.groups.map((item) => {
    const group = record(item);
    const budget = mode === 'CBO'
      ? number(group.budget, 'Orçamento do conjunto', true, true)
      : number(group.budget, 'Orçamento do conjunto', false, true);
    if (mode === 'ABO' && !budget) throw new Error('Informe um orçamento positivo para cada conjunto ABO.');
    if (mode === 'CBO' && budget !== null) throw new Error('O orçamento CBO fica na campanha.');
    return { name: label(group.name, 'Nome do conjunto'), audience: label(group.audience, 'Público', true, 240), budget };
  });
  uniqueNames(groups, 'conjuntos');
  const available = (cents(budget) - cents(reserve)) / 100;
  const allocation = mode === 'CBO' ? available : sumMoney(groups.map((group) => group.budget ?? 0));
  if (allocation > available) throw new Error('A soma dos conjuntos ABO ultrapassa o teto menos a reserva.');
  return { name, objective, funnel, mode, budget, reserve, minRetestSales, start, end, groups, allocation, unallocated: sumMoney([available, -allocation]) };
}

function uniqueNames(rows: { name: string }[], kind: string) {
  const names = new Set(rows.map(({ name }) => name.toLocaleLowerCase('pt-BR')));
  if (names.size !== rows.length) throw new Error(`Use nomes únicos para os ${kind}.`);
}

function parseLeads(input: unknown, funnel: Funnel) {
  if (input == null) return [];
  if (!Array.isArray(input) || input.length > MAX_LEADS_PER_CREATIVE || (funnel === 'ecommerce' && input.length)) {
    throw new Error('Contatos inválidos para este funil.');
  }
  return input.map((item): Lead => {
    const lead = record(item);
    return {
      contact: label(lead.contact, 'Referência do contato'),
      stage: member(lead.stage, Object.keys(LEAD_STAGES) as Lead['stage'][], 'Selecione o estágio do contato.'),
    };
  });
}

function parseCreative(input: unknown, index: number, funnel: Funnel): Creative {
  try {
    const row = record(input);
    const name = label(row.name, 'Nome do criativo');
    const format = label(row.format, 'Formato', true);
    const angle = label(row.angle, 'Ângulo', true, 240);
    const group = label(row.group, 'Conjunto', true);
    const spend = number(row.spend, 'Gasto', false, true);
    const sales = number(row.sales, 'Vendas');
    const impressions = number(row.impressions, 'Impressões', true);
    const clicks = number(row.clicks, 'Cliques', true);
    const entries = number(row.entries, FUNNELS[funnel].entry, true);
    const qualified = number(row.qualified, FUNNELS[funnel].qualified, true);
    const open = number(row.open, FUNNELS[funnel].open, true);
    const revenue = number(row.revenue, 'Receita atribuída', true, true);
    const leads = parseLeads(row.leads, funnel);
    if ((clicks !== null && impressions !== null && clicks > impressions) ||
        (qualified !== null && entries !== null && qualified > entries) ||
        (open !== null && qualified !== null && open > qualified)) {
      throw new Error('Confira cliques, impressões e as contagens das etapas do funil.');
    }
    if (revenue && !sales) throw new Error('Receita de vendas exige pelo menos uma venda.');
    if (leads.filter((lead) => lead.stage === 'won').length > sales ||
        (open !== null && leads.filter((lead) => lead.stage === 'open').length > open)) {
      throw new Error('Os contatos listados precisam caber nas contagens de vendas e negociações abertas.');
    }
    return { name, format, angle, group, spend, sales, impressions, clicks, entries, qualified, open, revenue, leads };
  } catch (error) {
    throw new Error(`Criativo ${index + 1}. ${(error as Error).message}`);
  }
}

export function parseSnapshot(input: unknown, plan: Plan) {
  const value = record(input);
  const start = date(value.start);
  const end = date(value.end);
  if (start > end) throw new Error('O início da análise deve ser anterior ou igual ao fim.');
  const source = member(value.source, Object.keys(SOURCES) as Origin[], 'Selecione a origem dos dados.');
  const target = number(value.target, 'CPA-teto', false, true);
  if (!target) throw new Error('Informe um CPA-teto positivo.');
  const ticket = number(value.ticket, 'Ticket por venda', true, true);
  const unitCost = number(value.unitCost, 'Custo por venda', true, true);
  if (!Array.isArray(value.creatives) || !value.creatives.length || value.creatives.length > MAX_CREATIVES) {
    throw new Error(`Inclua de 1 a ${MAX_CREATIVES} criativos.`);
  }
  const creatives = value.creatives.map((row, i) => parseCreative(row, i, plan.funnel));
  uniqueNames(creatives, 'criativos');
  for (const row of creatives) {
    if (row.group && !plan.groups.some((group) => group.name === row.group)) {
      throw new Error(`O conjunto de ${row.name} precisa existir no plano.`);
    }
  }
  return { start, end, source, target, ticket, unitCost, trackingVerified: value.trackingVerified === true, creatives };
}

export function validateRevision(previous: Snapshot, next: Snapshot) {
  if (next.start !== previous.start || next.end < previous.end ||
      (next.source === 'simulated') !== (previous.source === 'simulated')) {
    throw new Error('Mantenha o início do período e o tipo de dado na reavaliação. O fim pode avançar.');
  }
  if (previous.creatives.some((row) => !next.creatives.some((item) => item.name === row.name))) {
    throw new Error('Preserve os criativos da avaliação anterior para manter os totais acumulados.');
  }
}

function metrics(row: Pick<Creative, (typeof VALUES)[number]>, revenue: number | null) {
  return {
    ...row, revenue, ctr: divide(row.clicks, row.impressions, 100), cpc: divide(row.spend, row.clicks),
    cpm: divide(row.spend, row.impressions, 1000), costPerEntry: divide(row.spend, row.entries),
    costPerQualified: divide(row.spend, row.qualified), qualificationRate: divide(row.qualified, row.entries, 100),
    saleRate: row.entries !== null && row.sales <= row.entries ? divide(row.sales, row.entries, 100) : null,
    cpa: divide(row.spend, row.sales), roas: divide(revenue, row.spend),
    mediaBalance: revenue === null ? null : sumMoney([revenue, -row.spend]),
  };
}

function classify(row: ReturnType<typeof metrics>, target: number): { color: Color; action: string; reason: string; evidence: string } {
  if (row.spend > 0 && row.sales >= rules.minSalesToObserve && row.cpa !== null && row.cpa <= target) {
    return { color: 'green', action: 'Manter em observação', reason: `CPA dentro do teto com pelo menos ${rules.minSalesToObserve} vendas confirmadas.`, evidence: row.sales < rules.minRetestSales ? 'Amostra pequena' : 'Sinal consistente na janela' };
  }
  if (row.spend >= target && row.sales === 0 && row.entries !== null && row.entries <= rules.maxWeakEntries && row.qualified === 0 && (row.open ?? 0) === 0) {
    return { color: 'red', action: 'Considerar pausa', reason: 'Gasto chegou ao CPA-teto, com baixa entrada no funil e nenhuma qualificação ou venda.', evidence: 'Sinais convergentes no funil' };
  }
  if (row.spend > 0 && row.sales === 0 && (row.qualified ?? 0) >= rules.minQualifiedSignal) {
    return { color: 'yellow', action: 'Investigar fechamento', reason: 'Há volume na etapa intermediária sem vendas confirmadas. Verifique o que está impedindo o fechamento.', evidence: 'Sinal parcial no funil' };
  }
  if (row.sales >= rules.minSalesToObserve && row.cpa !== null && row.cpa > target && row.open === 0) {
    return { color: 'yellow', action: 'Revisar eficiência', reason: 'CPA acima do teto em mais de uma venda, com zero negociações abertas registradas.', evidence: 'Resultado observado na janela' };
  }
  return { color: 'gray', action: 'Aguardar mais evidências', reason: 'Os dados da janela ainda não sustentam uma mudança. Confirme as pendências e acompanhe o próximo fechamento.', evidence: 'Evidência insuficiente' };
}

export function diagnose(plan: Plan, snapshot: Snapshot, previous?: { rows: { name: string; color: Color }[] }) {
  const rows = snapshot.creatives.map(({ name, format, angle, group, spend, impressions, clicks, entries, qualified, open, sales, revenue: observedRevenue }) => {
    const raw = { spend, impressions, clicks, entries, qualified, open, sales, revenue: observedRevenue };
    const revenue = raw.revenue ?? (raw.sales === 0 ? 0 : snapshot.ticket === null ? null : cents(snapshot.ticket) * raw.sales / 100);
    const result = metrics(raw, revenue);
    return { name, format, angle, group, metrics: result, revenueEstimated: raw.revenue === null && raw.sales > 0 && revenue !== null, ...classify(result, snapshot.target) };
  });
  const sum = (key: (typeof VALUES)[number]) => {
    const values = rows.map((row) => row.metrics[key]);
    return values.some((v) => v === null) ? null : sumMoney(values.filter((v): v is number => v !== null));
  };
  const total = metrics({
    spend: sum('spend') ?? 0, sales: sum('sales') ?? 0, impressions: sum('impressions'), clicks: sum('clicks'),
    entries: sum('entries'), qualified: sum('qualified'), open: sum('open'), revenue: sum('revenue'),
  }, sum('revenue'));
  const reasons = [];
  const minRetestSales = plan.minRetestSales ?? rules.minRetestSales;
  if (total.sales < minRetestSales) reasons.push(`Menos de ${minRetestSales} vendas confirmadas na janela.`);
  if (total.spend === 0) reasons.push('Ainda não há gasto de mídia registrado.');
  if (total.cpa === null || total.cpa > snapshot.target) reasons.push('CPA acumulado indefinido ou acima do teto.');
  if (snapshot.unitCost === null) reasons.push('Custo por venda desconhecido.');
  if (!snapshot.trackingVerified) reasons.push('Atribuição de vendas não conferida.');
  if (total.open === null || total.open > 0) reasons.push(`${FUNNELS[plan.funnel].open} exigem revisão ou a contagem está incompleta.`);
  const estimatedRevenue = rows.some((row) => row.revenueEstimated);
  const contribution = total.mediaBalance === null || snapshot.unitCost === null ? null :
    sumMoney([total.mediaBalance, -(cents(snapshot.unitCost) * total.sales / 100)]);
  if (contribution === null || contribution <= 0 || estimatedRevenue) reasons.push('A margem após mídia e custo por venda precisa ser validada com receita observada.');
  if (snapshot.source === 'simulated') reasons.push('O cenário usa dados simulados.');
  const remaining = Math.max(0, sumMoney([plan.budget, -total.spend]));
  const protectedReserve = Math.min(remaining, plan.reserve);
  const availableForRetest = sumMoney([remaining, -protectedReserve]);
  if (!availableForRetest) reasons.push('Sem saldo disponível fora da reserva protegida.');
  const retestLimit = reasons.length ? 0 : Math.min(availableForRetest, snapshot.target, plan.allocation);
  const unchanged = previous ? previous.rows.length === rows.length &&
    rows.every((row) => previous.rows.some((old) => old.name === row.name && old.color === row.color)) : null;
  return {
    version: PLAYBOOK_VERSION, funnel: plan.funnel, funnelRule: FUNNELS[plan.funnel].rule, minRetestSales, rows, total,
    reasons, contribution, estimatedRevenue, remaining, protectedReserve, retestLimit, unchanged,
    additionalSalesAtTarget: Math.max(0, Math.ceil(cents(total.spend) / cents(snapshot.target)) - total.sales),
  };
}
