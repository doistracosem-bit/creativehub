import { useEffect, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { forgetPortalLink } from '../../../lib/portalLinks';
import type { PortalLink } from '../../../lib/portalLinks';
import { PortalPanel } from './PortalPanel';

export default function PortalTeamView({ initial }: { initial?: PortalLink }) {
  const { clients, publications, isMockMode, refreshData } = useApp();
  const { usuario } = useAuth();
  const [clientId, setClient] = useState(initial?.clientId ?? '');
  const selected = clients.find((client) => client.id === clientId) ?? clients[0];
  useEffect(forgetPortalLink, []);
  if (isMockMode) return <p className="cartao p-5 text-sm">A Central de Clientes está disponível no ambiente conectado ao Supabase.</p>;
  if (!selected || !usuario) return <p className="cartao p-5 text-sm">Cadastre uma empresa em Clientes para abrir a Central.</p>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-lg font-extrabold">Central de Clientes</p>
        <label className="w-full min-w-0 sm:max-w-64">
          <span className="rotulo">Empresa</span>
          <select className="campo min-h-11" value={selected.id} onChange={(event) => setClient(event.target.value)}>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </label>
      </div>
      <PortalPanel key={selected.id} clientId={selected.id} name={selected.name} team admin={usuario.papel === 'admin'}
        role="approve" email={usuario.email} initial={initial?.clientId === selected.id ? initial : undefined}
        publications={publications} refreshed={() => { void refreshData(); }} />
    </div>
  );
}
