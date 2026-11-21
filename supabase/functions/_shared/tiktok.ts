export const TIKTOK_TIMEZONES = {
  'America/Sao_Paulo': 'Brasília',
  'America/Manaus': 'Manaus',
  'America/Rio_Branco': 'Rio Branco',
  'America/Noronha': 'Fernando de Noronha',
  'Europe/Lisbon': 'Lisboa',
  UTC: 'UTC',
} as const;
export type TikTokZone = keyof typeof TIKTOK_TIMEZONES;
export const TIKTOK_FORMATS = ['Tutorial', 'Entretenimento', 'Bastidores', 'Demonstração', 'Outro'] as const;
export const TIKTOK_DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const MAX_TIKTOK_POSTS = 300;
export type TikTokPost = {
  published: string;
  format: string;
  views: number;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  boosted: boolean;
  url: string | null;
};
export type TikTokInput = {
  handle: string;
  timezone: TikTokZone;
  reference: string;
  mode: 'seven-day' | 'lifetime';
  posts: TikTokPost[];
};
export type TikTokAdvice = { summary: string; tests: string[]; model: string };
export type TikTokReport = {
  id: string;
  client_id: string;
  input: TikTokInput;
  metrics: ReturnType<typeof analyzeTikTok>;
  advice: TikTokAdvice | null;
  created_at: string;
};

const DAY = 86_400_000;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export const tiktokHour = (hour: number) => String(hour).padStart(2, '0') + 'h';

function validDate(date: string) {
  if (!datePattern.test(date)) return false;
  const time = Date.parse(date + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date;
}

export function todayInZone(timezone: TikTokZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)?.value).join('-');
}

export function nextTikTokSlot(day: number, hour: number, timezone: TikTokZone, now = new Date()) {
  const start = Date.parse(todayInZone(timezone, now) + 'T00:00:00Z');
  for (let offset = 0; offset <= 7; offset += 1) {
    const date = new Date(start + offset * DAY);
    if (date.getUTCDay() !== day) continue;
    const desired = date.getTime() + hour * 3_600_000;
    const zoneDifference = new Intl.DateTimeFormat('en', { timeZone: timezone, timeZoneName: 'longOffset' })
      .formatToParts(desired).find((part) => part.type === 'timeZoneName')?.value.match(/GMT([+-])(\d{2}):(\d{2})/);
    const minutes = zoneDifference ? (zoneDifference[1] === '-' ? -1 : 1) * (Number(zoneDifference[2]) * 60 + Number(zoneDifference[3])) : 0;
    const instant = desired - minutes * 60_000;
    if (instant > now.getTime()) return new Date(instant).toISOString();
  }
  throw new Error('Não foi possível identificar a próxima data.');
}

function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Dados da análise inválidos.');
  return input as Record<string, unknown>;
}

function parseHandle(input: unknown) {
  let value = typeof input === 'string' ? input.trim() : '';
  if (/^https:\/\//i.test(value)) {
    const url = new URL(value);
    if (!['www.tiktok.com', 'tiktok.com'].includes(url.hostname) || !/^\/@[^/]+\/?$/.test(url.pathname)) {
      throw new Error('Use o @ da conta ou o link do perfil do TikTok.');
    }
    value = url.pathname.slice(1).replace(/\/$/, '');
  }
  if (!/^@?[a-z0-9_][a-z0-9_.]{0,23}$/i.test(value)) throw new Error('Informe um @ válido do TikTok.');
  return '@' + value.replace(/^@/, '').toLowerCase();
}

function postUrl(value: unknown, handle: string) {
  if (value == null || value === '') return null;
  const url = new URL(String(value));
  if (url.protocol !== 'https:' || !['www.tiktok.com', 'tiktok.com'].includes(url.hostname)
     || url.username || url.password || url.port || !/^\/@[a-z0-9_.]+\/(video|photo)\/\d+\/?$/i.test(url.pathname)
     || url.pathname.split('/')[1].toLowerCase() !== handle) {
    throw new Error('Use o link completo de uma publicação do perfil analisado.');
  }
  return 'https://www.tiktok.com' + url.pathname.toLowerCase().replace(/\/$/, '');
}

function count(value: unknown, label: string, optional = true) {
  if (value == null && optional) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000_000) {
    throw new Error(`${label} deve ser um número inteiro maior ou igual a zero.`);
  }
  return value;
}

export function parseTikTok(input: unknown, now = new Date()): TikTokInput {
  const data = object(input);
  const handle = parseHandle(data.handle);
  if (typeof data.timezone !== 'string' || !Object.hasOwn(TIKTOK_TIMEZONES, data.timezone)) throw new Error('Escolha um fuso horário.');
  const timezone = data.timezone as TikTokZone;
  const reference = typeof data.reference === 'string' ? data.reference : '';
  if (!validDate(reference) || reference > todayInZone(timezone, now)) throw new Error('Informe uma data de referência válida, até hoje.');
  if (data.mode !== 'seven-day' && data.mode !== 'lifetime') throw new Error('Escolha como as visualizações foram medidas.');
  if (!Array.isArray(data.posts) || !data.posts.length || data.posts.length > MAX_TIKTOK_POSTS) {
    throw new Error(`Inclua de 1 a ${MAX_TIKTOK_POSTS} publicações.`);
  }
  const links = new Set<string>();
  const posts = data.posts.map((value, index): TikTokPost => {
    try {
      const row = object(value);
      const published = typeof row.published === 'string' ? row.published : '';
      if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(published) || !validDate(published.slice(0, 10))
        || published.slice(0, 10) > reference) throw new Error('Data ou hora inválida para a referência escolhida.');
      const format = typeof row.format === 'string' ? row.format.trim().replace(/\s+/g, ' ') : '';
      if (!format || format.length > 60) throw new Error('Informe um formato de até 60 caracteres.');
      if (typeof row.boosted !== 'boolean') throw new Error('Declare se houve impulsionamento.');
      const url = postUrl(row.url, handle);
      if (url && links.has(url)) throw new Error('Já existe uma publicação com esse link.');
      if (url) links.add(url);
      return {
        published, format, views: count(row.views, 'Visualizações', false)!, likes: count(row.likes, 'Curtidas'),
        comments: count(row.comments, 'Comentários'), shares: count(row.shares, 'Compartilhamentos'),
        saves: count(row.saves, 'Salvamentos'), boosted: row.boosted, url,
      };
    } catch (error) {
      throw new Error(`Publicação ${index + 1}. ${error instanceof Error ? error.message : 'Dados inválidos.'}`);
    }
  });
  return { handle, timezone, reference, mode: data.mode, posts };
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function formatKey(format: string) {
  return format.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function analyzeTikTok(input: TikTokInput) {
  const reference = Date.parse(input.reference);
  const posts = input.posts.map((post) => {
    const date = Date.parse(post.published.slice(0, 10));
    return { ...post, age: (reference - date) / DAY, day: new Date(date).getUTCDay(), hour: Number(post.published.slice(11, 13)) };
  });
  const organic = posts.filter((post) => !post.boosted && post.age < 90 && (input.mode === 'lifetime' || post.age >= 7));
  const canonical = organic.map((post) => {
    const peers = organic.filter((peer) => peer !== post && formatKey(peer.format) === formatKey(post.format));
    const baseline = input.mode === 'seven-day' && peers.length >= 5 ? median(peers.map((peer) => peer.views)) : null;
    const ratio = baseline ? post.views / baseline : null;
    const engagement = post.views > 0 && post.likes !== null && post.comments !== null && post.shares !== null
      ? 100 * (post.likes + post.comments + post.shares) / post.views : null;
    return { ...post, ratio, engagement };
  });

  function stats(rows: typeof canonical) {
    const views = rows.map((row) => row.views);
    const ratios = rows.flatMap((row) => row.ratio === null ? [] : [row.ratio]);
    const engagement = rows.flatMap((row) => row.engagement === null ? [] : [row.engagement]);
    const medianViews = median(views);
    const medianRatio = median(ratios);
    return {
      count: rows.length, meanViews: views.length ? views.reduce((sum, views) => sum + views, 0) / views.length : null,
      medianViews, dispersion: medianViews === null ? null : median(views.map((value) => Math.abs(value - medianViews))),
      medianRatio, ratioDispersion: medianRatio === null ? null : median(ratios.map((value) => Math.abs(value - medianRatio))),
      classified: ratios.length, viralRate: ratios.length ? 100 * ratios.filter((value) => value >= 3).length / ratios.length : null,
      engagement: median(engagement), engagementCount: engagement.length,
    };
  }

  const periods = [30, 60, 90].map((days) => ({ days, ...stats(canonical.filter((post) => post.age < days)) }));
  const total = periods[2];
  const grouped = new Map<number, typeof canonical>();
  for (const post of canonical) {
    const key = post.day * 24 + post.hour;
    const slot = grouped.get(key) ?? [];
    slot.push(post);
    grouped.set(key, slot);
  }
  const slots = [...grouped.entries()].map(([key, rows]) => {
    const evidence = stats(rows);
    const dates = new Set(rows.map((row) => row.published.slice(0, 10))).size;
    const { medianRatio, viralRate, engagement, ratioDispersion, classified, engagementCount } = evidence;
    const confidence = input.mode === 'seven-day' && classified >= 8 && dates >= 4 ? 'moderada' :
      input.mode === 'seven-day' && classified >= 3 && dates >= 3 ? 'baixa' : 'insuficiente';
    const vps = confidence === 'insuficiente' || classified !== rows.length || engagementCount !== rows.length
      || medianRatio === null || viralRate === null || !total.engagement || engagement === null || ratioDispersion === null
      ? null
      : Math.round((25 * Math.min(medianRatio / 2, 1) + 20 * viralRate / 100
        + 10 * Math.min(engagement / (2 * total.engagement), 1) + 10 / (1 + ratioDispersion)) / 65 * 100);
    return { day: Math.floor(key / 24), hour: key % 24, ...evidence, dates, confidence, vps };
  }).sort((a, b) => (b.vps ?? -1) - (a.vps ?? -1) || (b.medianRatio ?? -1) - (a.medianRatio ?? -1)
    || (b.medianViews ?? -1) - (a.medianViews ?? -1) || b.count - a.count || a.day - b.day || a.hour - b.hour);

  return {
    periods, slots, excluded: posts.length - canonical.length,
    formats: [...new Set(canonical.map((post) => formatKey(post.format)))].map((key) => {
      const rows = canonical.filter((post) => formatKey(post.format) === key);
      return { name: rows[0].format, ...stats(rows) };
    }),
  };
}
