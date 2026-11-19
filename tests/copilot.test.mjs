import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseContent, parseRequest } from '../supabase/functions/_shared/briefing.ts';
import { handleCopilot } from '../supabase/functions/copilot-v2/handler.ts';
import { exampleContent } from '../src/data/briefingExample.ts';

const image = {
  mimeType: 'image/png',
  data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8n8AAAAASUVORK5CYII=',
};
const context = {
  requestId: '220d5f6e-9f7f-47f2-81a8-8a124dc47cd0',
  niche: 'Livraria de bairro', format: 'CARROSSEL_4x5', goal: 'Educativo',
  client: '', audience: 'Moradores do bairro', prompt: 'Crie um convite para uma troca de livros.',
  image,
};

test('validates creative input and the uploaded image type', () => {
  assert.deepEqual(parseRequest(context), context);
  assert.throws(() => parseRequest({ ...context, niche: '' }), /Tamanho/);
  assert.throws(() => parseRequest({ ...context, format: '__proto__' }), /Contexto/);
  assert.throws(() => parseRequest({ ...context, image: { ...image, mimeType: 'image/jpeg' } }), /Assinatura/);
});

test('validates slide count for each format and rejects malformed model output', () => {
  assert.equal(parseContent(exampleContent, 'CARROSSEL_4x5').slides.length, 5);
  assert.equal(parseContent({ ...exampleContent, slides: exampleContent.slides.slice(0, 3) }, 'STORY_9x16').slides.length, 3);
  assert.equal(parseContent({ ...exampleContent, slides: exampleContent.slides.slice(0, 1) }, 'POST_1x1').slides.length, 1);
  assert.throws(() => parseContent(exampleContent, 'POST_1x1'), /Estrutura/);
  assert.throws(() => parseContent({ ...exampleContent, color_palette: { ...exampleContent.color_palette, text: 'blue' } }, 'CARROSSEL_4x5'), /texto|Cor/);
  const duplicate = { ...exampleContent, slides: Array(5).fill(exampleContent.slides[0]) };
  assert.throws(() => parseContent(duplicate, 'CARROSSEL_4x5'), /repetidos/);
});

test('authenticates the team, sends only the current context and returns Gemini output', async (t) => {
  const env = {
    SUPABASE_URL: 'https://supabase.example.test',
    SUPABASE_ANON_KEY: 'public-test-key',
    GEMINI_API_KEY: 'gemini-test-key',
    GEMINI_MODEL: 'gemini-test-model',
  };
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(input);
    if (url.pathname === '/auth/v1/user') return Response.json({ email: 'Equipe@example.test' });
    if (url.pathname === '/rest/v1/team_members') {
      assert.equal(url.searchParams.get('email'), 'eq."equipe@example.test"');
      return Response.json(options.headers.Authorization === 'Bearer member' ? [{ email: 'equipe@example.test' }] : []);
    }
    assert.equal(url.hostname, 'generativelanguage.googleapis.com');
    assert.ok(['/v1beta/models/gemini-test-model:generateContent', '/v1beta/models/gemini-flash-latest:generateContent'].includes(url.pathname));
    assert.equal(url.search, '');
    assert.equal(options.headers['x-goog-api-key'], 'gemini-test-key');
    const body = JSON.parse(options.body);
    const { requestId: _requestId, image, format: _format, ...creativeContext } = context;
    assert.equal(body.contents.length, 1);
    assert.deepEqual(JSON.parse(body.contents[0].parts[0].text), {
      ...creativeContext, format: 'Carrossel 4:5', width: 1080, height: 1350, slideCount: 5, hasImage: true,
    });
    assert.deepEqual(body.contents[0].parts[1].inlineData, image);
    assert.equal(body.generationConfig.responseJsonSchema.properties.slides.minItems, 5);
    if (fallback && url.pathname.includes('gemini-test-model')) return new Response(null, { status: 404 });
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: providerText }] } }] });
  });
  const previousDeno = globalThis.Deno;
  globalThis.Deno = { env: { get: (name) => env[name] } };
  t.after(() => { globalThis.Deno = previousDeno; });
  let providerText = JSON.stringify(exampleContent);
  let fallback = false;

  function call(token, body = context) {
    return handleCopilot(new Request('http://localhost/copilot', {
      method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(body),
    }));
  }

  assert.equal((await call()).status, 401);
  assert.equal((await call('outsider')).status, 403);
  assert.equal((await call('member', { ...context, prompt: '' })).status, 400);
  assert.equal(globalThis.fetch.mock.callCount(), 4);
  const response = await call('member');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { requestId: context.requestId, model: 'gemini-test-model', content: exampleContent });
  fallback = true;
  assert.equal((await (await call('member')).json()).model, 'gemini-flash-latest');
  providerText = '{"slides":[]}';
  assert.equal((await call('member')).status, 502);
});
