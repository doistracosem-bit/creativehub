import { supabase } from './supabase';

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
