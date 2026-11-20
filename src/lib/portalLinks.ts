const KEY = 'creative-hub:portal-destination';
export type PortalLink = { area: 'client' | 'team'; clientId?: string; postId?: string; batchId?: string; pendingOnly: boolean };

export function portalLink(params = new URLSearchParams(window.location.search)): PortalLink | undefined {
  const area = params.get('area') === 'clientes' ? 'client' : params.get('aba') === 'client-portal' ? 'team' : undefined;
  if (!area) return undefined;
  return {
    area, clientId: params.get('cliente') ?? undefined, postId: params.get('portalPost') ?? undefined,
    batchId: params.get('envio') ?? undefined, pendingOnly: params.get('pendentes') === '1',
  };
}

export function readPortalLink() {
  const direct = portalLink();
  if (direct) return direct;
  try { return portalLink(new URLSearchParams(sessionStorage.getItem(KEY) ?? '')); }
  catch { return undefined; }
}

export function rememberPortalLink() {
  const params = new URLSearchParams(window.location.search);
  if (!portalLink(params)) return;
  try { sessionStorage.setItem(KEY, params.toString()); } catch { /* private browsing */ }
}

export function forgetPortalLink() {
  try { sessionStorage.removeItem(KEY); } catch { /* private browsing */ }
}
