/* Recebe os lembretes enviados pelo servidor (Supabase) e mostra a notificação,
   mesmo com o app fechado. É importado pelo service worker gerado pelo vite-plugin-pwa. */

self.addEventListener('push', (event) => {
  let dados = {};
  try { dados = event.data ? event.data.json() : {}; } catch { dados = { title: 'Lembrete', body: event.data && event.data.text() }; }
  const titulo = dados.title || 'Lembrete de publicação';
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.body || '',
      icon: '/pwa-192x192.png',
      badge: '/badge-96.png',
      tag: dados.tag,
      renotify: true,
      data: { url: dados.url || '/?aba=calendar' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const j of janelas) {
      if ('focus' in j) { try { await j.navigate(url); } catch (e) { /* ignore */ } return j.focus(); }
    }
    return self.clients.openWindow(url);
  })());
});
