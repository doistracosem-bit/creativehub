// Robô de lembretes — Dois Traços · Creative Hub
//
// GET  /functions/v1/lembretes  → devolve a chave PÚBLICA das notificações (o app usa para inscrever o aparelho).
//                                  Na primeira vez, gera as chaves e guarda no cofre (Vault) do Supabase.
// POST /functions/v1/lembretes  → chamado a cada 5 min pelo pg_cron (com a senha do robô no cabeçalho
//                                  x-cron-secret). Manda as notificações dos posts que chegaram na hora.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const ATRASO_MAXIMO_MS = 2 * 60 * 60 * 1000; // não avisa posts que passaram há mais de 2h
const CONTATO = 'mailto:contato@doistracos.com.br';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-cron-secret, authorization, apikey',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type Post = {
  id: string; headline: string | null; client_name: string | null; format: string | null;
  scheduled_for: string; status: string; responsible_email: string | null;
  reminder_minutes: number | null; reminder_sent: boolean; due_sent: boolean;
};
type Aparelho = { endpoint: string; p256dh: string; auth: string; email: string };
type Config = { cron_secret: string | null; vapid_public: string | null; vapid_private: string | null };

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

async function lerConfig(): Promise<Config> {
  const { data, error } = await sb.rpc('lembretes_config');
  if (error) throw error;
  let cfg = data as Config;
  if (!cfg.vapid_public || !cfg.vapid_private) {
    const novas = webpush.generateVAPIDKeys();
    const { error: e2 } = await sb.rpc('lembretes_salvar_vapid', { publica: novas.publicKey, privada: novas.privateKey });
    if (e2) throw e2;
    const { data: d2 } = await sb.rpc('lembretes_config');
    cfg = d2 as Config;
  }
  return cfg;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  let cfg: Config;
  try { cfg = await lerConfig(); }
  catch (e) { console.error('Config', e); return Response.json({ ok: false, erro: 'configuração indisponível' }, { status: 500, headers: CORS }); }

  // Chave pública: pode ser lida por qualquer um (é pública por natureza)
  if (req.method === 'GET') {
    return Response.json({ publicKey: cfg.vapid_public }, { headers: { ...CORS, 'Cache-Control': 'public, max-age=3600' } });
  }

  if (!cfg.cron_secret || req.headers.get('x-cron-secret') !== cfg.cron_secret) {
    return new Response('não autorizado', { status: 401, headers: CORS });
  }

  webpush.setVapidDetails(CONTATO, cfg.vapid_public!, cfg.vapid_private!);

  const agora = Date.now();
  const { data: posts, error } = await sb
    .from('publications')
    .select('id,headline,client_name,format,scheduled_for,status,responsible_email,reminder_minutes,reminder_sent,due_sent')
    .neq('status', 'POSTADO')
    .not('scheduled_for', 'is', null)
    .gte('scheduled_for', new Date(agora - ATRASO_MAXIMO_MS).toISOString())
    .lte('scheduled_for', new Date(agora + 25 * 3600e3).toISOString())
    .or('reminder_sent.eq.false,due_sent.eq.false');
  if (error) return Response.json({ ok: false, erro: error.message }, { status: 500 });

  const { data: aparelhos } = await sb.from('push_subscriptions').select('endpoint,p256dh,auth,email');
  let enviados = 0;
  const processados: string[] = [];

  for (const p of (posts ?? []) as Post[]) {
    const quando = new Date(p.scheduled_for).getTime();
    const min = p.reminder_minutes ?? 60;
    const patch: Partial<Post> = {};
    let titulo = '';

    const venceuLembrete = !p.reminder_sent && agora >= quando - min * 60000;
    const venceuHora = !p.due_sent && agora >= quando;

    if (min === 0) {
      if (venceuLembrete || venceuHora) { titulo = `Hora de postar: ${p.headline}`; patch.reminder_sent = true; patch.due_sent = true; }
    } else if (venceuHora) {
      titulo = `Hora de postar: ${p.headline}`; patch.reminder_sent = true; patch.due_sent = true;
    } else if (venceuLembrete) {
      titulo = `Daqui a pouco: ${p.headline}`; patch.reminder_sent = true;
    }
    if (!titulo) continue;

    const alvos = ((aparelhos ?? []) as Aparelho[]).filter((a) => !p.responsible_email || a.email === p.responsible_email.toLowerCase());
    const payload = JSON.stringify({
      title: titulo,
      body: `${p.client_name ?? 'Dois Traços'} · ${p.format ?? 'Post'} às ${hora(p.scheduled_for)}`,
      tag: `post-${p.id}`,
      url: `/?aba=calendar&post=${p.id}`,
    });

    await Promise.all(alvos.map(async (a) => {
      try {
        await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, payload, { TTL: 3600, urgency: 'high' });
        enviados++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await sb.from('push_subscriptions').delete().eq('endpoint', a.endpoint);
        else console.error('Falha ao enviar', status, e);
      }
    }));

    await sb.from('publications').update(patch).eq('id', p.id);
    processados.push(p.id);
  }

  return Response.json({ ok: true, posts: processados.length, enviados });
});
