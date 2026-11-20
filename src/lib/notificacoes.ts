import { useEffect, useRef } from 'react';
import { supabase, isMockMode } from './supabase';
import type { Publication } from '../types';

const VAPID_ENV = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/** Chave pública das notificações: do .env, ou pedida ao robô "lembretes" do Supabase */
async function chavePublica(): Promise<string | undefined> {
  if (VAPID_ENV) return VAPID_ENV;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) return undefined;
  const r = await fetch(`${url}/functions/v1/lembretes`);
  if (!r.ok) return undefined;
  return (await r.json()).publicKey as string | undefined;
}

export type StatusNotificacao = 'granted' | 'denied' | 'default' | 'indisponivel';
export type ResultadoAtivacao = 'ok' | 'negado' | 'indisponivel' | 'precisa-instalar' | 'erro';

export function statusNotificacao(): StatusNotificacao {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'indisponivel';
  return Notification.permission as StatusNotificacao;
}

export const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const estaInstalado = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

function base64ParaUint8(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...b].map((c) => c.charCodeAt(0)));
}

/** Pede permissão e registra este aparelho para receber os lembretes */
export async function ativarNotificacoes(email: string, portal = false): Promise<ResultadoAtivacao> {
  try {
    if (!('Notification' in window)) return ehIOS() && !estaInstalado() ? 'precisa-instalar' : 'indisponivel';
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return 'negado';
    if (isMockMode) return 'ok';

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'indisponivel';
    const VAPID_PUBLICA = await chavePublica();
    if (!VAPID_PUBLICA) return 'erro';
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('sw')), 10000)),
    ]);
    const sub = (await reg.pushManager.getSubscription())
      || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ParaUint8(VAPID_PUBLICA) }));
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    const { error } = await supabase.from(portal ? 'portal_devices' : 'push_subscriptions').upsert({
      endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth,
      email: email.toLowerCase(), ...(portal ? {} : { user_agent: navigator.userAgent.slice(0, 200) }),
    }, { onConflict: 'endpoint' });
    if (error) throw error;
    return 'ok';
  } catch (e) {
    console.error('Falha ao ativar notificações', e);
    return 'erro';
  }
}

/** Envia uma notificação de teste para este aparelho (sem passar pelo servidor) */
export async function notificacaoTeste() {
  const titulo = 'Tudo certo! 🎉';
  const corpo = 'É assim que o lembrete de postagem vai aparecer.';
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) { await reg.showNotification(titulo, { body: corpo, icon: '/pwa-192x192.png', badge: '/badge-96.png' }); return; }
    new Notification(titulo, { body: corpo, icon: '/pwa-192x192.png' });
  } catch { /* ignore */ }
}

/**
 * Modo demonstração (sem Supabase): confere os lembretes enquanto o app está aberto.
 * Com o Supabase configurado quem faz isso é o servidor (função "lembretes"), mesmo com o app fechado.
 */
export function useLembretesLocais(publicacoes: Publication[], email: string | undefined, aoAvisar: (titulo: string, corpo: string) => void) {
  const enviados = useRef<Set<string>>(new Set(JSON.parse(localStorage.getItem('dt_lembretes_enviados') || '[]')));
  useEffect(() => {
    if (!isMockMode) return;
    const conferir = () => {
      const agora = Date.now();
      for (const p of publicacoes) {
        if (p.status === 'POSTADO') continue;
        if (p.responsible_email && p.responsible_email !== email) continue;
        const quando = new Date(p.scheduled_for).getTime();
        if (agora - quando > 3600e3) continue; // muito antigo
        const min = p.reminder_minutes ?? 60;
        const chaves: [string, number, string][] = [[`${p.id}:${p.scheduled_for}:antes`, quando - min * 60000, min ? 'Daqui a pouco' : 'Hora de postar']];
        if (min) chaves.push([`${p.id}:${p.scheduled_for}:hora`, quando, 'Hora de postar']);
        for (const [chave, em, prefixo] of chaves) {
          if (agora >= em && !enviados.current.has(chave)) {
            enviados.current.add(chave);
            const titulo = `${prefixo}: ${p.headline}`;
            const corpo = `${p.client_name} · ${p.format} às ${new Date(p.scheduled_for).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            aoAvisar(titulo, corpo);
            try { if (Notification.permission === 'granted') new Notification(titulo, { body: corpo, icon: '/pwa-192x192.png' }); } catch { /* ignore */ }
          }
        }
      }
      localStorage.setItem('dt_lembretes_enviados', JSON.stringify([...enviados.current].slice(-300)));
    };
    conferir();
    const t = setInterval(conferir, 30000);
    return () => clearInterval(t);
  }, [publicacoes, email, aoAvisar]);
}
