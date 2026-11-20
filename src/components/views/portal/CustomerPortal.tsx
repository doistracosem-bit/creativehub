import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { MARCA } from '../../../lib/marca';
import { forgetPortalLink, readPortalLink } from '../../../lib/portalLinks';
import { PortalPanel } from './PortalPanel';

export default function CustomerPortal() {
  const { empresas, emailLogado, sair } = useAuth();
  const [link] = useState(readPortalLink);
  const [clientId, setClient] = useState(link?.clientId ?? '');
  const selected = empresas.find((item) => item.client_id === clientId) ?? empresas[0];
  useEffect(forgetPortalLink, []);
  if (!selected || !emailLogado) return null;
  return (
    <div className="min-h-screen bg-canvas pb-8 text-text-main">
      <header className="border-b border-border-subtle bg-surface">
        <div className="mx-auto flex max-w-[1130px] flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-3"><img className="h-7 w-auto" src={MARCA.logoEscuro} alt="Dois Traços" /><span className="text-xs font-bold text-text-muted">Área do Cliente</span></div>
          <button className="btn-fantasma min-h-11" onClick={() => void sair()}><LogOut size={16} /> Sair</button>
        </div>
      </header>
      <main className="mx-auto max-w-[1130px] space-y-4 px-4 pt-5 sm:px-6">
        {empresas.length > 1 && <label className="block max-w-sm"><span className="rotulo">Empresa</span>
          <select className="campo min-h-11" value={selected.client_id} onChange={(event) => setClient(event.target.value)}>
            {empresas.map((item) => <option key={item.client_id} value={item.client_id}>{item.name}</option>)}
          </select>
        </label>}
        <PortalPanel key={selected.client_id} clientId={selected.client_id} name={selected.name} role={selected.role} email={emailLogado}
          initial={selected.client_id === link?.clientId ? link : undefined} />
      </main>
    </div>
  );
}
