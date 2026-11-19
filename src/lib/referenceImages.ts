import { supabase } from './supabase';
import { dominantColors } from './referencePalette';
import { LIBRARY_IMAGE_LIMIT } from '../../supabase/functions/_shared/briefing';

const bucketName = 'reference-images';
const storagePrefix = `storage:${bucketName}/`;
const imageExtensions = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif',
} as const;

export const referenceImageTypes = Object.keys(imageExtensions);
export const maxReferenceImageSize = 5 * 1024 * 1024;

function hasKnownType(type: string): type is keyof typeof imageExtensions {
  return Object.hasOwn(imageExtensions, type);
}

export function referenceFileError(file: File) {
  if (!hasKnownType(file.type)) return 'Escolha uma imagem JPG, PNG, WebP, GIF ou AVIF.';
  if (file.size === 0) return 'O arquivo está vazio. Selecione outra imagem.';
  if (file.size > maxReferenceImageSize) return 'A imagem precisa ter até 5 MB.';
  return '';
}

function referenceImageLink(input: string) {
  const url = new URL(input.trim());
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Informe um link direto da imagem iniciado por https:// ou http://.');
  }
  return url.href;
}

export async function saveReferenceImage(image: File | string, demo: boolean): Promise<string> {
  if (typeof image === 'string') {
    try {
      return referenceImageLink(image);
    } catch {
      throw new Error('Informe um link direto da imagem iniciado por https:// ou http://.');
    }
  }

  const problem = referenceFileError(image);
  if (problem) throw new Error(problem);
  if (demo) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Não foi possível ler a imagem. Selecione o arquivo novamente.'));
      reader.readAsDataURL(image);
    });
  }

  const extension = imageExtensions[image.type as keyof typeof imageExtensions];
  const path = `${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucketName).upload(path, image, { contentType: image.type });
  if (error) throw new Error('Não foi possível enviar a imagem. Verifique sua conexão e tente novamente.');
  return storagePrefix + path;
}

export function storedReferenceImagePath(source: string) {
  return source.startsWith(storagePrefix) ? source.slice(storagePrefix.length) : null;
}

export async function downloadReferenceImage(path: string, signal: AbortSignal): Promise<Blob> {
  const { data, error } = await supabase.storage.from(bucketName).download(path, {}, { signal, cache: 'no-store' });
  if (error || !data) throw new Error('Não foi possível carregar a imagem.');
  return data;
}

export async function discardUnsavedReferenceImage(source: string) {
  const path = storedReferenceImagePath(source);
  if (path) await supabase.storage.from(bucketName).remove([path]);
}

async function referenceCanvas(source: File | string, maxSide: number, signal: AbortSignal) {
  const path = typeof source === 'string' ? storedReferenceImagePath(source) : null;
  let blob: Blob;
  if (source instanceof File) blob = source;
  else if (path) blob = await downloadReferenceImage(path, signal);
  else {
    const url = source.startsWith('data:image/') ? source : referenceImageLink(source);
    const response = await fetch(url, { signal, credentials: 'omit' });
    if (!response.ok) throw new Error('Imagem indisponível.');
    blob = await response.blob();
  }
  signal.throwIfAborted();
  if (!blob.size || blob.size > 15 * 1024 * 1024) throw new Error('Imagem fora do limite de análise.');

  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    signal.throwIfAborted();
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('O navegador não conseguiu analisar a imagem.');
    if (maxSide > 96) {
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { canvas, context };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function extractReferencePalette(source: File | string) {
  const { canvas, context } = await referenceCanvas(source, 96, AbortSignal.timeout(6000));
  return dominantColors(context.getImageData(0, 0, canvas.width, canvas.height).data);
}

export async function readLibraryReferenceImage(source: string, signal: AbortSignal) {
  const { canvas } = await referenceCanvas(source, 1280, AbortSignal.any([signal, AbortSignal.timeout(6000)]));
  for (const quality of [0.85, 0.65, 0.45]) {
    const data = canvas.toDataURL('image/jpeg', quality).split(',')[1];
    if (data && data.length <= LIBRARY_IMAGE_LIMIT / 3 * 4) return { mimeType: 'image/jpeg', data };
  }
  throw new Error('Não foi possível preparar a imagem para o Gemini.');
}
