import { supabase } from '../lib/supabase';

export type PortalRole = 'approve' | 'view';
export type PortalMembership = { client_id: string; name: string; role: PortalRole };
export type PortalStatus = 'pending' | 'approved' | 'changes';
export type PortalPost = {
  id: string; client_id: string; publication_id: string | null; batch_id: string | null;
  title: string; caption: string; format: string; scheduled_at: string; shared_at: string | null;
  released_at: string | null; published_at: string | null; art_status: PortalStatus; caption_status: PortalStatus;
  art_version: number; caption_version: number; revision: number; rejection: string | null;
};
export type PortalBatch = { id: string; title: string; due_at: string };
export type PortalNotice = {
  id: string; post_id: string | null; batch_id: string | null; kind: string; title: string; body: string;
  read_at: string | null; created_at: string;
};
export type PortalAccess = { email: string; name: string; role: PortalRole; phone: string | null; whatsapp_opt_in: boolean };
export type PortalAsset = { version: number; position: number; path: string; mime: string; url?: string };
export type PortalHistory = { id: string; actor: string; action: string; part: string | null; version: number | null; detail: string | null; created_at: string };
export type PortalSettings = { whatsapp_active?: boolean; phone?: string | null; google_verified?: boolean };

export async function portalMemberships(): Promise<PortalMembership[]> {
  const { data, error } = await supabase.rpc('portal_workspace');
  if (error) throw error;
  return Array.isArray(data) ? data as PortalMembership[] : [];
}

export async function portalWorkspace(clientId: string, team: boolean, signal: AbortSignal) {
  const [posts, batches, notices, access, settings] = await Promise.all([
    supabase.from('portal_posts').select('*').eq('client_id', clientId).order('scheduled_at').abortSignal(signal),
    supabase.from('portal_batches').select('id,title,due_at').eq('client_id', clientId).order('created_at', { ascending: false }).abortSignal(signal),
    supabase.from('portal_notices').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(100).abortSignal(signal),
    team ? supabase.from('portal_access').select('email,name,role,phone,whatsapp_opt_in').eq('client_id', clientId).order('name').abortSignal(signal) : null,
    team ? supabase.rpc('portal_settings').abortSignal(signal) : null,
  ]);
  const error = posts.error || batches.error || notices.error || access?.error || settings?.error;
  if (error) throw error;
  return {
    posts: posts.data as PortalPost[], batches: batches.data as PortalBatch[], notices: notices.data as PortalNotice[],
    access: (access?.data ?? []) as PortalAccess[], settings: (settings?.data ?? {}) as PortalSettings,
  };
}

export async function portalDetails(postId: string, signal: AbortSignal) {
  const [media, history] = await Promise.all([
    supabase.from('portal_assets').select('version,position,path,mime').eq('post_id', postId).order('version', { ascending: false }).order('position').abortSignal(signal),
    supabase.from('portal_history').select('*').eq('post_id', postId).order('created_at', { ascending: false }).abortSignal(signal),
  ]);
  if (media.error || history.error) throw media.error || history.error;
  return { assets: media.data as PortalAsset[], history: history.data as PortalHistory[] };
}

export async function portalMediaUrls(assets: PortalAsset[]) {
  if (!assets.length) return [];
  const { data, error } = await supabase.storage.from('portal-art').createSignedUrls(assets.map((asset) => asset.path), 300);
  if (error) throw error;
  const urls = new Map(data?.map(({path, signedUrl}) => [path, signedUrl]));
  return assets.map((asset) => ({ ...asset, url: urls.get(asset.path) || undefined }));
}

export async function portalAction<T = { id?: string; batch_id?: string }>(op: string, payload: object): Promise<T> {
  const { data, error } = await supabase.rpc('portal_action', { op, payload });
  if (error) throw error;
  return data as T;
}

const formats: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm',
};
export const PORTAL_FILE_TYPES = Object.keys(formats).join(',');

export async function portalUpload(post: PortalPost, files: File[], text: string) {
  if (files.length < 1 || files.length > 10) throw new Error('Anexe de 1 a 10 arquivos na ordem em que devem aparecer.');
  if (files.some((file) => !formats[file.type] || !file.size || file.size > 50_000_000)) {
    throw new Error('Use JPG, PNG, WebP, GIF, MP4 ou WebM de até 50 MB por arquivo.');
  }
  const paths: string[] = [];
  const bucket = supabase.storage.from('portal-art');
  try {
    for (const file of files) {
      const path = `${post.id}/${crypto.randomUUID()}.${formats[file.type]}`;
      const { error } = await bucket.upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      paths.push(path);
    }
    return await portalAction('resend', { client_id: post.client_id, post_id: post.id, revision: post.revision, files: paths, text });
  } catch (error) {
    if (paths.length) await bucket.remove(paths).catch(() => undefined);
    throw error;
  }
}
