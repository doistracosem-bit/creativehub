import { createClient } from 'npm:@supabase/supabase-js@2.119.1';
import { analyzeTikTok, parseTikTok } from '../_shared/tiktok.ts';
import type { TikTokAdvice, TikTokReport } from '../_shared/tiktok.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const maxBody = 240_000;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const reply = (status: number, body: unknown) => Response.json(body, { status, headers: cors });

function key(name: string, fallback: string) {
  const configured = Deno.env.get(name);
  return (configured ? JSON.parse(configured).default : undefined) || Deno.env.get(fallback);
}

async function read(request: Request) {
  if (!request.body || Number(request.headers.get('content-length')) > maxBody) throw new Error('O envio excede o limite.');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let body = '';
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        const parsed = JSON.parse(body + decoder.decode());
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Corpo inválido.');
        return parsed as Record<string, unknown>;
      }
      size += value.byteLength;
      if (size > maxBody) {
        await reader.cancel();
        throw new Error('O envio excede o limite.');
      }
      body += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

async function interpret(report: TikTokReport, request: Request): Promise<TikTokAdvice> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini indisponível. O relatório continua salvo.');
  const { periods, slots, excluded } = report.metrics;
  const evidence = { mode: report.input.mode, periods, slots: slots.slice(0, 12), excluded };
  const instructions = [
    'Escreva em português do Brasil. Resuma a força dos dados e sugira de um a três testes de publicação para a equipe.',
    'Use apenas as métricas deste JSON, com explicação da amostra. O campo day usa 0 para domingo e 6 para sábado.',
    'Se a base histórica for pequena ou as visualizações forem acumuladas, trate os horários como hipóteses.',
    'O VPS parcial compara oportunidade no histórico, jamais probabilidade. Valor nulo significa indisponível.',
    'Não invente horário de atividade da audiência, taxas, métricas, publicações, efeitos causais ou garantias.',
  ].join('\n');
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: instructions }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(evidence) }] }],
    generationConfig: { maxOutputTokens: 4096, responseMimeType: 'application/json', responseJsonSchema: {
      type: 'object', required: ['summary', 'tests'],
      properties: {
        summary: { type: 'string' },
        tests: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string' } },
      },
    } },
  });
  let model = Deno.env.get('GEMINI_MODEL')?.trim() || 'gemini-3.5-flash-lite';
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(35_000)]);
  const generate = () => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body: payload,
  });
  let response = await generate();
  if (response.status === 404 && model !== 'gemini-flash-latest') {
    await response.body?.cancel();
    model = 'gemini-flash-latest';
    response = await generate();
  }
  if (response.status === 429) throw new Error('Limite do Gemini atingido. Tente em instantes.');
  if (!response.ok) throw new Error('Gemini indisponível. O relatório continua salvo.');
  const candidate = (await response.json()).candidates?.[0];
  if (candidate?.finishReason !== 'STOP') throw new Error('O Gemini não concluiu a resposta. Tente novamente.');
  const content = candidate.content?.parts?.filter((part: { thought?: boolean }) => !part.thought)
    .map((part: { text?: string }) => part.text ?? '').join('');
  const output = JSON.parse(content);
  const valid = (value: unknown, length: number) => typeof value === 'string' && value.trim() && value.length <= length;
  if (!valid(output?.summary, 900) || !Array.isArray(output?.tests) || output.tests.length < 1 || output.tests.length > 3
    || !output.tests.every((test: unknown) => valid(test, 440))) throw new Error('Resposta do Gemini indisponível. Tente novamente.');
  return { summary: output.summary.trim(), tests: output.tests.map((test: string) => test.trim()), model };
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return reply(405, { error: 'Método inválido.' });
  const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return reply(401, { error: 'Entre novamente para analisar contas.' });
  try {
    const root = Deno.env.get('SUPABASE_URL');
    const publicKey = key('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
    const serviceKey = key('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
    if (!root || !publicKey || !serviceKey) return reply(503, { error: 'O serviço não está configurado.' });
    const auth = { autoRefreshToken: false, persistSession: false };
    const caller = createClient(root, publicKey, { auth, global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: user, error: authError } = await caller.auth.getUser(token);
    if (authError || !user.user) return reply(401, { error: 'Entre novamente para analisar contas.' });
    const body = await read(request).catch(() => null);
    if (!body || typeof body.id !== 'string' || !uuid.test(body.id) || typeof body.clientId !== 'string' || !uuid.test(body.clientId)) {
      return reply(400, { error: 'Envio inválido ou acima do limite.' });
    }
    const { data: client, error: clientError } = await caller.from('clients').select('id').eq('id', body.clientId).maybeSingle();
    if (clientError) return reply(503, { error: 'Não foi possível verificar o cliente.' });
    if (!client) return reply(404, { error: 'Cliente indisponível para esta conta.' });
    const admin = createClient(root, serviceKey, { auth });
    const scope = { id: body.id, client_id: body.clientId };
    if (body.action === 'analyze') {
      let input;
      try {
        input = parseTikTok(body.input);
      } catch (error) {
        return reply(400, { error: (error as Error).message });
      }
      const metrics = analyzeTikTok(input);
      if (!metrics.periods[2].count) return reply(400, { error: 'Inclua pelo menos um post orgânico elegível no período de 90 dias.' });
      const { data, error } = await admin.from('tiktok_reports').upsert({ ...scope, input, metrics }, { onConflict: 'id', ignoreDuplicates: true })
        .select().maybeSingle();
      if (error) return reply(503, { error: 'Não foi possível salvar a análise.' });
      if (data) return reply(200, { report: data });
      const existing = await caller.from('tiktok_reports').select().match(scope).maybeSingle();
      return existing.data ? reply(200, { report: existing.data }) : reply(409, { error: 'O identificador já está em uso.' });
    }
    if (body.action === 'advise') {
      const { data, error } = await caller.from('tiktok_reports').select().match(scope).maybeSingle<TikTokReport>();
      if (error) return reply(503, { error: 'Não foi possível ler a análise.' });
      if (!data) return reply(404, { error: 'Análise indisponível para este cliente.' });
      if (data.advice) return reply(200, { report: data });
      let advice;
      try {
        advice = await interpret(data, request);
      } catch (error) {
        const message = error instanceof Error && /^(Gemini|Limite|O Gemini|Resposta)/.test(error.message)
          ? error.message : 'O Gemini não respondeu. O relatório continua salvo.';
        return reply(502, { error: message });
      }
      const updated = await admin.from('tiktok_reports').update({ advice }).match(scope).is('advice', null).select().maybeSingle();
      if (updated.error) return reply(503, { error: 'Não foi possível salvar a interpretação.' });
      if (updated.data) return reply(200, { report: updated.data });
      const existing = await caller.from('tiktok_reports').select().match(scope).maybeSingle();
      return existing.data ? reply(200, { report: existing.data }) : reply(404, { error: 'A análise foi excluída.' });
    }
    return reply(400, { error: 'Operação inválida.' });
  } catch {
    return reply(503, { error: 'O serviço está indisponível. Tente novamente.' });
  }
});
