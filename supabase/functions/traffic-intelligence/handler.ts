import { diagnose, FUNNELS, parsePlan, parseSnapshot, record, validateRevision } from '../_shared/traffic.ts';
import type { Advice, CampaignRow, ReportRow } from '../_shared/traffic.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const bodyLimit = 240_000;

function reply(status: number, data: unknown) {
  return Response.json(data, { status, headers: { ...cors, 'Cache-Control': 'no-store' } });
}

class RequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function uuid(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) {
    throw new RequestError(400, 'Identificador inválido.');
  }
  return value.toLowerCase();
}

async function readBody(request: Request) {
  if (Number(request.headers.get('content-length')) > bodyLimit || !request.body) {
    throw new RequestError(413, 'O envio ultrapassa o limite permitido.');
  }
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let body = '';
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return record(JSON.parse(body + decoder.decode()));
      size += value.byteLength;
      if (size > bodyLimit) {
        await reader.cancel();
        throw new RequestError(413, 'O envio ultrapassa o limite permitido.');
      }
      body += decoder.decode(value, { stream: true });
    }
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(400, 'Envio inválido.');
  } finally {
    reader.releaseLock();
  }
}

function validate<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    throw new RequestError(400, (error as Error).message);
  }
}

function environmentKey(name: string) {
  const keys = Deno.env.get(name);
  return keys ? (JSON.parse(keys) as { default?: string }).default : undefined;
}

type RestOptions = Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };

function rest(root: string, headers: Record<string, string>) {
  return async <T>(table: string, filters: Record<string, string>, init?: RestOptions): Promise<T[]> => {
    const url = new URL(`/rest/v1/${table}`, root);
    url.search = new URLSearchParams(filters).toString();
    const response = await fetch(url, {
      ...init, signal: AbortSignal.timeout(8000),
      headers: { ...headers, ...init?.headers },
    });
    if (!response.ok) {
      if (response.status === 409) throw new RequestError(409, 'O vínculo mudou. Atualize os dados e tente novamente.');
      throw new RequestError(503, 'Não foi possível acessar os dados de tráfego.');
    }
    if (response.status === 204) return [];
    return await response.json();
  };
}

const insert = (body: object) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Prefer: 'return=representation,resolution=ignore-duplicates' },
  body: JSON.stringify(body),
});

const scope = (client: string, id: string) => ({ client_id: `eq.${client}`, id: `eq.${id}` });

const responseSchema = {
  type: 'object',
  required: ['summary', 'recommendations'],
  properties: {
    summary: { type: 'string' },
    recommendations: {
      type: 'array', minItems: 1, maxItems: 4,
      items: {
        type: 'object', required: ['target', 'context', 'action', 'rationale'],
        properties: {
          target: { type: 'integer' }, context: { type: 'string' }, action: { type: 'string' }, rationale: { type: 'string' },
        },
      },
    },
  },
};

function parseAdvice(value: unknown, model: string, creativeCount: number): Advice {
  const input = record(value);
  const validText = (text: unknown, limit: number) => {
    if (typeof text !== 'string' || !text.trim() || text.length > limit) throw new Error('Texto inválido.');
    return text.trim();
  };
  if (!Array.isArray(input.recommendations) || input.recommendations.length < 1 || input.recommendations.length > 4) {
    throw new Error('Recomendações inválidas.');
  }
  const seen = new Set<number>();
  const recommendations = input.recommendations.map((item) => {
    const row = record(item);
    const target = row.target;
    if (typeof target !== 'number' || !Number.isInteger(target) || target < 0 || target > creativeCount || seen.has(target)) {
      throw new Error('Referência inválida.');
    }
    seen.add(target);
    return {
      target, context: validText(row.context, 440), action: validText(row.action, 440), rationale: validText(row.rationale, 440),
    };
  });
  return { model, summary: validText(input.summary, 800), recommendations };
}

async function interpret(report: ReportRow, request: Request): Promise<Advice> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new RequestError(503, 'Gemini indisponível. O diagnóstico salvo continua acessível.');
  const { diagnosis, snapshot } = report;
  // Only typed evidence goes upstream. Client names, creative labels and contact data stay in Creative Hub.
  const context = {
    funnel: FUNNELS[diagnosis.funnel], version: diagnosis.version, source: snapshot.source, target: snapshot.target,
    window: [snapshot.start, snapshot.end], campaign: diagnosis.total, restrictions: diagnosis.reasons, minRetestSales: diagnosis.minRetestSales,
    creatives: diagnosis.rows.map((row, index) => ({
      target: index + 1, metrics: row.metrics, recommendation: row.action, reason: row.reason, evidence: row.evidence,
    })),
  };
  const instructions = [
    'Interprete o diagnóstico de tráfego em português do Brasil. Use somente as evidências fornecidas e preserve a classificação.',
    'Faça de uma a quatro recomendações de verificação humana. target 0 indica a campanha, 1 ou mais indica o criativo com esse índice.',
    'Explique a ação e o motivo com base nas métricas recebidas. Valor nulo significa desconhecido. Identifique amostra pequena e pendências do funil.',
    'Não recalcule, invente dados, prometa retorno, declare causalidade ou proponha executar ações externas.',
    'Se houver restrições, não proponha aumento, realocação do investimento nem pré-escala. Preserve o caráter consultivo.',
  ].join('\n');
  let model = Deno.env.get('GEMINI_MODEL')?.trim() || 'gemini-3.5-flash-lite';
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(35_000)]);
  const call = () => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instructions }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(context) }] }],
      generationConfig: { maxOutputTokens: 4096, responseMimeType: 'application/json', responseJsonSchema: responseSchema },
    }),
  });
  try {
    let response = await call();
    if (response.status === 404 && model !== 'gemini-flash-latest') {
      await response.body?.cancel();
      model = 'gemini-flash-latest';
      response = await call();
    }
    if (response.status === 429) throw new RequestError(429, 'Limite do Gemini atingido. Tente novamente em instantes.');
    if (!response.ok) throw new Error('Gemini indisponível.');
    const candidate = (await response.json()).candidates?.[0];
    if (candidate?.finishReason !== 'STOP') throw new Error('Resposta incompleta.');
    const content = candidate.content?.parts?.filter((p: { thought?: boolean }) => !p.thought)
      .map((p: { text?: string }) => p.text ?? '').join('');
    return parseAdvice(JSON.parse(content), model, diagnosis.rows.length);
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(502, 'O Gemini não concluiu a interpretação. Você pode tentar novamente pelo relatório salvo.');
  }
}

export async function handleTraffic(request: Request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return reply(405, { error: 'Método inválido.' });
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reply(401, { error: 'Entre novamente para acessar o módulo.' });

  try {
    const root = Deno.env.get('SUPABASE_URL');
    const apikey = environmentKey('SUPABASE_PUBLISHABLE_KEYS') || Deno.env.get('SUPABASE_ANON_KEY');
    const service = environmentKey('SUPABASE_SECRET_KEYS') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!root || !apikey || !service) throw new RequestError(503, 'O armazenamento de tráfego precisa ser configurado.');
    const caller = { apikey, Authorization: authorization };
    const auth = await fetch(new URL('/auth/v1/user', root), { headers: caller, signal: AbortSignal.timeout(8000) });
    if ([401, 403].includes(auth.status)) throw new RequestError(401, 'Entre novamente para acessar o módulo.');
    if (!auth.ok) throw new RequestError(503, 'Não foi possível confirmar sua sessão.');

    const data = await readBody(request);
    const client = uuid(data.clientId);
    const id = uuid(data.id);
    const read = rest(root, caller);
    const [clientRow] = await read<{ id: string }>('clients', { id: `eq.${client}`, select: 'id', limit: '1' });
    if (!clientRow) throw new RequestError(404, 'Cliente indisponível para esta conta.');
    const write = rest(root, service.startsWith('sb_secret_') ? { apikey: service } : { apikey: service, Authorization: `Bearer ${service}` });

    if (data.action === 'plan') {
      const plan = validate(() => parsePlan(data.plan));
      const [created] = await write<CampaignRow>('traffic_campaigns', {}, insert({ id, client_id: client, plan }));
      const campaign = created ?? (await read<CampaignRow>('traffic_campaigns', scope(client, id)))[0];
      if (!campaign) throw new RequestError(409, 'Identificador de planejamento indisponível.');
      return reply(200, { campaign });
    }

    if (data.action === 'delete-campaign') {
      await write('traffic_campaigns', scope(client, id), { method: 'DELETE' });
      return reply(200, { deleted: true });
    }

    if (data.action === 'analyze' || data.action === 'advise') {
      const campaignId = uuid(data.campaignId);
      const filters = { ...scope(client, id), campaign_id: `eq.${campaignId}` };
      const [campaign] = await read<CampaignRow>('traffic_campaigns', scope(client, campaignId));
      if (!campaign) throw new RequestError(404, 'Campanha indisponível para este cliente.');

      if (data.action === 'analyze') {
        const snapshot = validate(() => parseSnapshot(data.snapshot, campaign.plan));
        const previousId = data.previousId == null ? null : uuid(data.previousId);
        const [previous] = previousId ? await read<ReportRow>('traffic_reports', { ...filters, id: `eq.${previousId}` }) : [];
        if (previousId && !previous) throw new RequestError(404, 'A avaliação anterior precisa pertencer à campanha e ao cliente.');
        if (previous) validate(() => validateRevision(previous.snapshot, snapshot));
        const diagnosis = diagnose(campaign.plan, snapshot, previous?.diagnosis);
        const [created] = await write<ReportRow>('traffic_reports', {}, insert({
          id, client_id: client, campaign_id: campaignId, previous_id: previousId, snapshot, diagnosis,
        }));
        const report = created ?? (await read<ReportRow>('traffic_reports', filters))[0];
        if (!report) throw new RequestError(409, 'Identificador de análise indisponível.');
        return reply(200, { report });
      }

      const [report] = await read<ReportRow>('traffic_reports', filters);
      if (!report) throw new RequestError(404, 'Relatório indisponível para esta campanha.');
      if (report.advice) return reply(200, { report });
      const advice = await interpret(report, request);
      const [updated] = await write<ReportRow>('traffic_reports', { ...filters, advice: 'is.null' }, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ advice }),
      });
      const saved = updated ?? (await read<ReportRow>('traffic_reports', filters))[0];
      if (!saved?.advice) throw new RequestError(409, 'O relatório ficou indisponível.');
      return reply(200, { report: saved });
    }
    return reply(400, { error: 'Operação inválida.' });
  } catch (error) {
    if (error instanceof RequestError) return reply(error.status, { error: error.message });
    return reply(503, { error: 'O serviço de tráfego está indisponível. Tente novamente.' });
  }
}
