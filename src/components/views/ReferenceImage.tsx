import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { downloadReferenceImage, storedReferenceImagePath } from '../../lib/referenceImages';

interface ImageProps {
  source: string;
  alt: string;
  className: string;
}

function ImageUnavailable() {
  return (
    <div className="grid h-full w-full place-content-center justify-items-center gap-1 text-xs text-text-muted">
      <ImageOff size={22} aria-hidden="true" />
      Imagem indisponível
    </div>
  );
}

function ImageThumbnail({ source, alt, className }: ImageProps) {
  const [failed, setFailed] = useState(false);
  return source && !failed
    ? <img src={source} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />
    : <ImageUnavailable />;
}

function StoredImage({ source, alt, className }: ImageProps) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;

    downloadReferenceImage(source, controller.signal).then((blob) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => {
      if (!controller.signal.aborted) setUrl('');
    });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source]);

  return url === null
    ? <p className="grid h-full place-items-center text-xs text-text-muted">Carregando imagem…</p>
    : <ImageThumbnail source={url} alt={alt} className={className} />;
}

export function ReferenceImage({ source, alt, className }: ImageProps) {
  const path = storedReferenceImagePath(source);
  return path
    ? <StoredImage key={path} source={path} alt={alt} className={className} />
    : <ImageThumbnail key={source} source={source} alt={alt} className={className} />;
}
