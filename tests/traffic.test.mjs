import assert from 'node:assert/strict';
import test from 'node:test';
import { diagnose, parsePlan, parseSnapshot, validateRevision } from '../supabase/functions/_shared/traffic.ts';
import { handleTraffic } from '../supabase/functions/traffic-intelligence/handler.ts';
import { parseTrafficCsv } from '../src/lib/trafficCsv.ts';

const planInput = {
  name: 'Teste 01', objective: 'Validar criativos', funnel: 'whatsapp', mode: 'ABO',
  start: '2026-11-01', end: '2026-11-04', budget: 1000, reserve: 600,
  groups: [{ name: 'Teste', audience: '', budget: 400 }],
};
const plan = parsePlan(planInput);
const csv = [
  'Criativo;Gasto;Vendas;Conversas;Leads qualificados;Negociações abertas',
  '"Criativo A";"100,00";2;12;8;2',
  'Criativo B;100;0;10;7;4',
  'Criativo C;100;0;2;0;0',
  'Criativo D;100;1;9;5;3',
].join('\r\n');
const snapshot = parseSnapshot({
  start: plan.start, end: plan.end, source: 'simulated', target: 60, ticket: 100, creatives: parseTrafficCsv(csv),
}, plan);

test('valida reservas ABO em centavos e orçamento centralizado CBO', () => {
  assert.equal(plan.allocation, 400);
  assert.throws(() => parsePlan({ ...planInput, budget: 999.99 }), /ultrapassa/);
  const cbo = parsePlan({ ...planInput, mode: 'CBO', groups: [{ name: 'CBO' }] });
  assert.equal(cbo.allocation, 400);
  assert.equal(cbo.groups[0].budget, null);
  assert.throws(() => parsePlan({ ...planInput, mode: 'CBO' }), /fica na campanha/);
  assert.throws(() => parsePlan({ ...planInput, start: '2026-02-30' }), /data válida/);
});

test('reproduz os quatro criativos, o agregado e a reserva do Teste 01', () => {
  const diagnosis = diagnose(plan, snapshot);
  assert.deepEqual(diagnosis.rows.map((row) => row.color), ['green', 'yellow', 'red', 'gray']);
  assert.equal(diagnosis.total.cpa, 400 / 3);
  assert.equal(diagnosis.total.roas, 0.75);
  assert.equal(diagnosis.total.open, 9);
  assert.equal(diagnosis.total.impressions, null);
  assert.equal(diagnosis.total.mediaBalance, -100);
  assert.equal(diagnosis.contribution, null);
  assert.equal(diagnosis.additionalSalesAtTarget, 4);
  assert.equal(diagnosis.protectedReserve, 600);
  assert.equal(diagnosis.retestLimit, 0);
});

test('reavalia valores acumulados com atualização de venda e custo', () => {
  const initial = diagnose(plan, snapshot);
  assert.equal(diagnose(plan, snapshot, initial).unchanged, true);
  const creatives = snapshot.creatives.map((row, i) => i === 3 ? { ...row, sales: 2, open: 2 } : row);
  const next = parseSnapshot({ ...snapshot, creatives, unitCost: 10 }, plan);
  validateRevision(snapshot, next);
  const revised = diagnose(plan, next, initial);
  assert.equal(revised.unchanged, false);
  assert.equal(revised.total.cpa, 100);
  assert.equal(revised.rows[3].metrics.cpa, 50);
  assert.equal(revised.contribution, -40);
  assert.throws(() => validateRevision(snapshot, { ...next, source: 'manual' }), /tipo de dado/);
  assert.throws(() => validateRevision(snapshot, { ...next, creatives: creatives.slice(1) }), /Preserve os criativos/);
});

test('preserva ausência de métricas e distingue zero, ausência e receita estimada', () => {
  const rollup = diagnose(plan, parseSnapshot({
    ...snapshot, ticket: null, creatives: [snapshot.creatives[0], { ...snapshot.creatives[1], spend: 0 }],
  }, plan));
  assert.equal(rollup.total.revenue, null);
  assert.equal(rollup.total.roas, null);
  assert.equal(rollup.rows[1].metrics.revenue, 0);
  assert.equal(rollup.rows[1].metrics.cpa, null);
  assert.equal(rollup.rows[1].metrics.roas, null);
  assert.throws(() => parseSnapshot({ ...snapshot, creatives: [{ ...snapshot.creatives[0], qualified: 30 }] }, plan), /contagens/);
});

test('sugere reteste somente fora da reserva com volume configurado e receita observada', () => {
  const input = parseSnapshot({
    ...snapshot, source: 'manual', target: 60, unitCost: 20, trackingVerified: true,
    creatives: [{ name: 'Peça de teste', spend: 100, sales: 6, open: 0, revenue: 600 }],
  }, plan);
  assert.equal(diagnose(plan, input).retestLimit, 60);
  assert.equal(diagnose(parsePlan({ ...planInput, minRetestSales: 8 }), input).retestLimit, 0);
  assert.equal(diagnose(plan, { ...input, trackingVerified: false }).retestLimit, 0);
});

test('valida contatos acompanhados e exclui dados de contato das métricas', () => {
  const lead = { contact: 'CRM-privado', stage: 'open' };
  const input = parseSnapshot({ ...snapshot, creatives: [{ ...snapshot.creatives[0], leads: [lead] }] }, plan);
  assert.deepEqual(input.creatives[0].leads, [lead]);
  assert.equal(JSON.stringify(diagnose(plan, input)).includes('CRM-privado'), false);
  assert.throws(() => parseSnapshot({ ...input, creatives: [{ ...input.creatives[0], open: 0 }] }, plan), /contatos listados/);
  assert.throws(() => parseSnapshot(input, { ...plan, funnel: 'ecommerce' }), /Contatos inválidos/);
});

test('aceita CSV com BOM, aspas e vírgula e rejeita colunas ambíguas', () => {
  const rows = parseTrafficCsv('\uFEFF"Ad name","Amount spent (BRL)",Purchases,Impressions\n"Peça, ""azul""",10.25,0,12');
  assert.equal(rows[0].name, 'Peça, "azul"');
  assert.equal(rows[0].spend, 10.25);
  assert.equal(rows[0].impressions, 12);
  assert.equal(rows[0].entries, null);
  assert.throws(() => parseTrafficCsv('criativo;gasto;vendas;compras\nx;10;1;1'), /equivalentes/);
  assert.throws(() => parseTrafficCsv('name,spend,sales\nx,10,0,extra'), /colunas difere/);
});

test('valida acesso e escopo antes de gravar e preserva diagnóstico sem Gemini', async (t) => {
  const client = '10000000-0000-0000-0000-000000000001';
  const other = '20000000-0000-0000-0000-000000000001';
  const campaign = '10000000-0000-0000-0000-000000000002';
  const id = '10000000-0000-0000-0000-000000000003';
  const mock = { SUPABASE_URL: 'https://test.invalid', SUPABASE_ANON_KEY: 'public', SUPABASE_SERVICE_ROLE_KEY: 'private', GEMINI_API_KEY: 'gemini' };
  let stored;
  let persistedPlan;
  let writes = 0;
  let geminiCalls = 0;
  let geminiAvailable = false;
  let deletes = 0;
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    const url = new URL(input);
    if (url.pathname === '/auth/v1/user') return Response.json({ id: 'team-user' });
    if (url.pathname.endsWith('/clients')) {
      assert.equal(init.headers.Authorization, 'Bearer session');
      return Response.json(url.searchParams.get('id') === `eq.${client}` ? [{ id: client }] : []);
    }
    if (url.pathname.endsWith('/traffic_campaigns')) {
      if (init.method === 'DELETE') {
        assert.equal(init.headers.Authorization, 'Bearer private');
        assert.equal(url.searchParams.get('client_id'), `eq.${client}`);
        assert.equal(url.searchParams.get('id'), `eq.${campaign}`);
        deletes++;
        persistedPlan = null;
        stored = null;
        return new Response(null, { status: 204 });
      }
      if (init.method === 'POST') {
        assert.equal(init.headers.Authorization, 'Bearer private');
        writes++;
        if (persistedPlan) return Response.json([]);
        persistedPlan = JSON.parse(init.body);
        return Response.json([persistedPlan]);
      }
      assert.equal(init.headers.Authorization, 'Bearer session');
      assert.equal(url.searchParams.get('client_id'), `eq.${client}`);
      return Response.json(persistedPlan && url.searchParams.get('id') === `eq.${campaign}` ? [persistedPlan] : []);
    }
    if (url.pathname.endsWith('/traffic_reports')) {
      if (init.method === 'POST') {
        assert.equal(init.headers.Authorization, 'Bearer private');
        writes++;
        stored = { ...JSON.parse(init.body), advice: null };
        return Response.json([stored]);
      }
      if (init.method === 'PATCH') {
        assert.equal(init.headers.Authorization, 'Bearer private');
        assert.equal(url.searchParams.get('advice'), 'is.null');
        assert.equal(url.searchParams.get('client_id'), `eq.${client}`);
        assert.equal(url.searchParams.get('campaign_id'), `eq.${campaign}`);
        stored = { ...stored, ...JSON.parse(init.body) };
        return Response.json([stored]);
      }
      assert.equal(init.headers.Authorization, 'Bearer session');
      return Response.json(stored?.id && url.searchParams.get('id') === `eq.${stored.id}` ? [stored] : []);
    }
    if (url.hostname === 'generativelanguage.googleapis.com') {
      geminiCalls++;
      const body = JSON.parse(init.body);
      const context = JSON.parse(body.contents[0].parts[0].text);
      assert.equal(context.campaign.cpa, 400 / 3);
      assert.equal(context.creatives[0].target, 1);
      assert.equal(JSON.stringify(context).includes('Criativo A'), false);
      assert.equal(JSON.stringify(context).includes('CRM-privado'), false);
      assert.equal(body.tools, undefined);
      if (!geminiAvailable) return Response.json({}, { status: 502 });
      const text = JSON.stringify({
        summary: 'CPA acima do teto nesta janela.',
        recommendations: [{ target: 2, context: 'Há propostas abertas.', action: 'Revisar o estágio das propostas.', rationale: 'A qualificação ainda não resultou em vendas.' }],
      });
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] });
    }
    throw new Error(`Unexpected URL: ${url.pathname}`);
  });
  globalThis.Deno = { env: { get: (key) => mock[key] } };
  t.after(() => delete globalThis.Deno);
  const call = (data, token = 'Bearer session') => handleTraffic(new Request('https://example.test', {
    method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }));
  const base = { id, clientId: client, campaignId: campaign };
  assert.equal((await call({ ...base, action: 'plan', plan }, '')).status, 401);
  assert.equal((await call({ ...base, action: 'plan', id: campaign, plan })).status, 200);
  assert.equal((await call({ ...base, action: 'plan', id: campaign, plan })).status, 200);
  assert.equal((await call({ ...base, clientId: other, action: 'analyze', snapshot })).status, 404);
  assert.equal((await call({ ...base, action: 'analyze', snapshot, previousId: other })).status, 404);
  assert.equal((await call({ ...base, action: 'analyze', snapshot: { ...snapshot, target: 0 } })).status, 400);
  assert.equal(writes, 2);
  const withLead = { ...snapshot, creatives: snapshot.creatives.map((row, i) => i ? row : { ...row, leads: [{ contact: 'CRM-privado', stage: 'open' }] }) };
  const analysis = await call({ ...base, action: 'analyze', snapshot: withLead });
  assert.equal(analysis.status, 200);
  assert.equal((await analysis.json()).report.diagnosis.total.roas, 0.75);
  assert.equal(stored.advice, null);
  assert.equal(geminiCalls, 0);
  assert.equal((await call({ ...base, action: 'advise' })).status, 502);
  assert.equal(stored.advice, null);
  geminiAvailable = true;
  assert.equal((await call({ ...base, action: 'advise' })).status, 200);
  assert.equal(stored.advice.recommendations[0].target, 2);
  assert.equal((await call({ ...base, action: 'advise' })).status, 200);
  assert.equal(geminiCalls, 2);
  assert.equal((await call({ ...base, id: campaign, clientId: other, action: 'delete-campaign' })).status, 404);
  assert.equal(deletes, 0);
  const deleted = await call({ ...base, id: campaign, action: 'delete-campaign' });
  assert.deepEqual(await deleted.json(), { deleted: true });
  assert.equal(deletes, 1);
  assert.equal((await call({ ...base, action: 'advise' })).status, 404);
  assert.equal((await call({ ...base, id: campaign, action: 'delete-campaign' })).status, 200);
});
