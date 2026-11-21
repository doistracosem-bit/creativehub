import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeTikTok, nextTikTokSlot, parseTikTok } from '../supabase/functions/_shared/tiktok.ts';
import { parseTikTokCsv } from '../src/lib/tiktokCsv.ts';

const now = new Date('2026-11-21T13:00:00Z');
const setup = { handle: 'https://www.tiktok.com/@conta', timezone: 'America/Sao_Paulo', reference: '2026-11-21', mode: 'seven-day' };
const make = (published, views, fields = {}) => ({
  published, views, format: 'Tutorial', likes: 20, comments: 1, shares: 2, saves: null, boosted: false, url: null, ...fields,
});
const posts = [
  make('2026-10-14T19:02', 100), make('2026-10-21T19:34', 200), make('2026-10-28T19:48', 800),
  make('2026-10-14T16:02', 100), make('2026-10-21T16:34', 100), make('2026-10-28T16:48', 100),
  make('2026-11-18T19:35', 50000), make('2026-11-11T19:00', 50000, { boosted: true }), make('2026-07-01T19:00', 50000),
];

test('agrupa no fuso declarado e exclui posts impulsionados, imaturos e fora dos 90 dias', () => {
  const input = parseTikTok({ ...setup, posts }, now);
  const { periods, slots, excluded } = analyzeTikTok(input);
  assert.equal(input.handle, '@conta');
  assert.deepEqual(periods.map((item) => item.count), [2, 6, 6]);
  assert.equal(excluded, 3);
  const slot = slots.find((item) => item.hour === 19);
  assert.equal(slot.day, 3);
  assert.equal(slot.count, 3);
  assert.equal(slot.medianViews, 200);
  assert.equal(slot.meanViews, 1100 / 3);
  assert.equal(slot.viralRate, 100 / 3);
  assert.equal(slot.confidence, 'baixa');
  assert.ok(slot.vps > 0 && slot.vps <= 100);
});

test('dados acumulados e métricas ausentes não recebem VPS', () => {
  const lifetime = analyzeTikTok(parseTikTok({ ...setup, mode: 'lifetime', posts }, now));
  assert.equal(lifetime.periods[2].count, 7);
  assert.ok(lifetime.slots.every((item) => item.vps === null && item.viralRate === null));
  const missing = analyzeTikTok(parseTikTok({ ...setup, posts: posts.map((post) => ({ ...post, comments: null })) }, now));
  assert.ok(missing.slots.every((item) => item.vps === null && item.engagement === null));
});

test('valida data, vínculo com o perfil, métrica e link repetido', () => {
  const link = 'https://www.tiktok.com/@conta/video/123';
  assert.throws(() => parseTikTok({ ...setup, posts: [make('2026-10-14T19:02', -1)] }, now), /inteiro/);
  assert.throws(() => parseTikTok({ ...setup, posts: [make('2026-09-31T19:02', 1)] }, now), /Data ou hora/);
  assert.throws(() => parseTikTok({ ...setup, posts: [{ ...posts[0], url: link.replace('conta', 'outro') }] }, now), /perfil analisado/);
  assert.throws(() => parseTikTok({ ...setup, posts: [{ ...posts[0], url: link }, { ...posts[1], url: link + '?x=1' }] }, now), /Já existe/);
});

test('importa campos opcionais, vírgula em aspas e declaração explícita de impulsionamento', () => {
  const csv = '\uFEFFPublicado em;Formato;Visualizações;Curtidas;Impulsionado\r\n14/10/2026 19:30;"Tutorial, curto";100;;Não';
  const [post] = parseTikTokCsv(csv);
  assert.deepEqual(post, make('2026-10-14T19:30', 100, { format: 'Tutorial, curto', likes: null, comments: null, shares: null }));
  assert.throws(() => parseTikTokCsv(csv.replace('Não', '')), /impulsionado/);
  assert.throws(() => parseTikTokCsv(csv.replace('100', '1.000')), /inteiro/);
});

test('pré-preenche o próximo horário em UTC para o calendário', () => {
  assert.equal(nextTikTokSlot(3, 19, 'America/Sao_Paulo', now), '2026-11-25T22:00:00.000Z');
  assert.equal(nextTikTokSlot(6, 9, 'America/Sao_Paulo', now), '2026-11-28T12:00:00.000Z');
});
