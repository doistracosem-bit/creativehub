import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize } from 'lucide-react';
import { portalMediaUrls } from '../../../services/portalService';
import type { PortalAsset } from '../../../services/portalService';
import { Folha } from '../../ui/Folha';

export function PortalArtwork({ postId, title, version, assets }: { postId: string; title: string; version: number; assets: PortalAsset[] }) {
  const versions = [...new Set(assets.map((file) => file.version))];
  const [active, setActive] = useState(version);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<PortalAsset[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const close = useCallback(() => setExpanded(false), []);

  useEffect(() => {
    let current = true;
    const selected = assets.filter((item) => item.version === active);
    function refresh() {
      void portalMediaUrls(selected).then((files) => {
        if (current) { setItems(files); setError(''); }
      }).catch(() => { if (current) setError('Não foi possível abrir a arte.'); });
    }
    refresh();
    const timer = window.setInterval(refresh, 240_000);
    return () => { current = false; window.clearInterval(timer); };
  }, [active, assets, postId, retry]);

  const visible = items.filter((item) => item.version === active);
  const image = visible[page];
  const draw = (large = false) => {
    if (!image?.url) return <p className="p-4 text-center text-sm text-text-muted">{error || (image ? 'Arquivo indisponível.' : 'Carregando arte…')}</p>;
    const sizing = large ? 'max-h-[70vh]' : 'max-h-[420px]';
    return image.mime.startsWith('video/')
      ? <video controls playsInline preload="metadata" className={`mx-auto h-auto w-auto max-w-full object-contain ${sizing}`}
          aria-label={`Vídeo completo de ${title}`} src={image.url} />
      : <img alt={`Arte completa de ${title} · arquivo ${page + 1}`} src={image.url} className={`mx-auto h-auto w-auto max-w-full object-contain ${sizing}`} />;
  };
  const pagination = () => visible.length > 1 && <div className="flex items-center justify-center gap-3 pt-3">
    <button type="button" className="btn-secundario min-h-11 !px-2" aria-label="Arte anterior" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={18} /></button>
    <span className="text-sm font-bold" aria-live="polite">{page + 1} / {visible.length}</span>
    <button type="button" className="btn-secundario min-h-11 !px-2" aria-label="Próxima arte" disabled={page === visible.length - 1} onClick={() => setPage(page + 1)}><ChevronRight size={18} /></button>
  </div>;

  if (!version || !assets.length) return <p className="rounded-xl bg-gelo p-4 text-sm text-marinho">Nenhuma arte anexada.</p>;
  return (
    <div className="space-y-3">
      {versions.length > 1 && <label className="block text-xs font-bold text-text-muted">
        Versão da arte
        <select className="campo mt-1 min-h-11" value={active} onChange={(event) => { setActive(Number(event.target.value)); setPage(0); }}>
          {versions.map((item) => <option key={item} value={item}>v{item}{item === version ? ' · atual' : ' · anterior'}</option>)}
        </select>
      </label>}
      <div className="rounded-2xl border border-border-subtle bg-canvas p-3 text-center">
        {!expanded && draw()}
        {pagination()}
        {error || (image && !image.url) ? <button className="btn-secundario mt-3 min-h-11" onClick={() => setRetry((v) => v + 1)}>Tentar abrir novamente</button> :
          image && <button className="btn-secundario mt-3 min-h-11" aria-haspopup="dialog" onClick={() => setExpanded(true)}><Maximize size={16} /> Ampliar arte</button>}
      </div>
      <Folha aberta={expanded} aoFechar={close} titulo={`${title} · v${active}`} largura="xl">
        {expanded && <div className="rounded-xl bg-canvas p-2">{draw(true)}{pagination()}</div>}
      </Folha>
    </div>
  );
}
