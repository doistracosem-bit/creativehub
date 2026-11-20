import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

type Job = {
  id: string; attempts: number; channel: 'push' | 'whatsapp'; destination: string;
  kind: string; title: string; body: string; client_id: string; post_id: string | null; batch_id: string | null;
  allowed: boolean; device: { endpoint: string; p256dh: string; auth: string } | null;
};
type Result = 'sent' | 'retry' | 'skipped' | 'failed';
type Config = { cron_secret?: string; vapid_public?: string; vapid_private?: string };

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const token = Deno.env.get('PORTAL_WHATSAPP_TOKEN');
const number = Deno.env.get('PORTAL_WHATSAPP_NUMBER_ID');
const graph = Deno.env.get('PORTAL_WHATSAPP_GRAPH_VERSION');
const approval = Deno.env.get('PORTAL_WHATSAPP_APPROVAL_TEMPLATE');
const reminder = Deno.env.get('PORTAL_WHATSAPP_REMINDER_TEMPLATE');
const revision = Deno.env.get('PORTAL_WHATSAPP_REVISION_TEMPLATE');
const whatsappReady = Boolean(token && number && /^\d+$/.test(number) && graph && /^v\d+\.\d+$/.test(graph) &&
  [approval, reminder, revision].every((item) => item && /^[a-z0-9_]+$/.test(item)));
const fromTeam = (kind: string) => ['changes','rejected','review'].includes(kind);

function pathFor(job: Job) {
  const params = new URLSearchParams(fromTeam(job.kind) ? { aba:'client-portal' } : { area:'clientes' });
  params.set('cliente',job.client_id);
  if (job.post_id) params.set('portalPost',job.post_id);
  if (job.batch_id) params.set('envio',job.batch_id);
  if (job.kind==='overdue') params.set('pendentes','1');
  return `/?${params}`;
}

function allowedEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return url.protocol==='https:' && !url.username && !url.password && !url.port &&
      /^(fcm\.googleapis\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)$/.test(url.hostname);
  } catch { return false; }
}

async function sendPush(job: Job, config: Config): Promise<Result> {
  if (!job.device || !allowedEndpoint(job.device.endpoint)) return 'skipped';
  if (!config.vapid_public || !config.vapid_private) return 'retry';
  try {
    await webpush.sendNotification({ endpoint:job.device.endpoint,keys:{p256dh:job.device.p256dh,auth:job.device.auth} },
      JSON.stringify({ title:job.title, body:job.body, tag:`central-${job.id}`, url:pathFor(job) }),
      { TTL:3600,urgency:'normal',timeout:8000,vapidDetails:{ subject:'mailto:contato@doistracos.com.br', publicKey:config.vapid_public,privateKey:config.vapid_private } });
    return 'sent';
  } catch (failure) {
    const status = (failure as {statusCode?: number}).statusCode;
    if (status===404 || status===410) {
      await sb.from('portal_devices').delete().eq('endpoint',job.device.endpoint).eq('auth',job.device.auth);
      return 'skipped';
    }
    return !status || status===429 || status>=500 ? 'retry' : 'failed';
  }
}

async function sendWhatsapp(job: Job): Promise<Result> {
  if (!whatsappReady) return 'retry';
  if (!/^[1-9][0-9]{7,14}$/.test(job.destination)) return 'skipped';
  const name = job.kind==='overdue' ? reminder : fromTeam(job.kind) ? revision : approval;
  const text = `${job.title}. ${job.body}`.replace(/\s+/g,' ').slice(0,500);
  try {
    const response = await fetch(`https://graph.facebook.com/${graph}/${number}/messages`, {
      method:'POST',
      headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      signal:AbortSignal.timeout(8000),
      body:JSON.stringify({
        messaging_product:'whatsapp', to:job.destination, type:'template',
        template:{ name, language:{code:'pt_BR'}, components:[
          {type:'body',parameters:[{type:'text',text}]},
          {type:'button',sub_type:'url',index:'0',parameters:[{type:'text',text:pathFor(job).slice(2)}]},
        ] },
      }),
    });
    await response.body?.cancel();
    return response.ok ? 'sent' : response.status===429 ? 'retry' : 'failed';
  } catch {
    // A timeout pode ocorrer depois de o provedor aceitar a mensagem.
    return 'failed';
  }
}

Deno.serve(async (request) => {
  if (request.method!=='POST') return new Response(null,{status:405});
  const secret = request.headers.get('x-cron-secret');
  if (!secret) return new Response(null,{status:401});
  const { data, error } = await sb.rpc('lembretes_config');
  const config = data as Config | null;
  if (error || !config) return Response.json({ok:false},{status:503});
  if (!config.cron_secret || secret!==config.cron_secret) return new Response(null,{status:401});
  const { data:claimed,error:claimError } = await sb.rpc('portal_worker_claim',{whatsapp_ready:whatsappReady});
  if (claimError) return Response.json({ok:false},{status:503});

  const jobs = (claimed ?? []) as Job[];
  const results: Result[] = [];
  for (let offset=0;offset<jobs.length;offset+=8) {
    const chunk = await Promise.all(jobs.slice(offset,offset+8).map(async (job): Promise<Result> => {
      const result = !job.allowed ? 'skipped' : job.channel==='push' ? await sendPush(job,config) : await sendWhatsapp(job);
      const {error:finishError} = await sb.rpc('portal_worker_finish',{job:job.id,attempt:job.attempts,result});
      if (finishError) console.error('Central de Clientes: falha ao concluir entrega.',finishError.code);
      return result;
    }));
    results.push(...chunk);
  }
  return Response.json({ok:true,whatsapp_configured:whatsappReady,sent:results.filter((item)=>item==='sent').length});
});
