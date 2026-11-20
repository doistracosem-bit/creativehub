import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { NavTab, Project, Publication } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Painel } from './components/widgets/Painel';
import { CalendarView } from './components/views/CalendarView';
import { ProjectsView } from './components/views/ProjectsView';
import { ReferencesView } from './components/views/ReferencesView';
import { ClientsView } from './components/views/ClientsView';
import { AICopilotView } from './components/views/AICopilotView';
import { SettingsView } from './components/views/SettingsView';
import { PostModal } from './components/modals/PostModal';
import { NewProjectModal } from './components/modals/NewProjectModal';
import { ProjectDetailsModal } from './components/modals/ProjectDetailsModal';
import { Toast } from './components/ui/Toast';
import { UIContext } from './context/UIContext';
import { useApp } from './context/AppContext';
import { useAuth } from './context/AuthContext';
import { useLembretesLocais } from './lib/notificacoes';
import { readPortalLink } from './lib/portalLinks';

const ABAS: NavTab[] = ['dashboard', 'calendar', 'projects', 'clients', 'client-portal', 'references', 'ai-copilot', 'traffic', 'settings'];
const TrafficIntelligenceView = lazy(() => import('./components/views/TrafficIntelligenceView'));
const PortalTeamView = lazy(() => import('./components/views/portal/PortalTeamView'));

export function App() {
  const { publications, isMockMode, error } = useApp();
  const { usuario } = useAuth();

  // Permite abrir direto numa aba/post (ex.: ao tocar na notificação: /?aba=calendar&post=ID)
  const params = new URLSearchParams(window.location.search);
  const [portalTarget] = useState(readPortalLink);
  const [currentTab, setCurrentTab] = useState<NavTab>(() => {
    const a = params.get('aba') as NavTab | null;
    return portalTarget?.area === 'team' ? 'client-portal' : a && ABAS.includes(a) ? a : 'dashboard';
  });
  const [post, setPost] = useState<{ id: string | null; preset?: Partial<Publication> } | null>(() => {
    const id = params.get('post');
    return id ? { id } : null;
  });
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [clienteNovoProjeto, setClienteNovoProjeto] = useState<string | undefined>();
  const [projetoAberto, setProjetoAberto] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [currentTab]);

  const ui = useMemo(() => ({
    abrirPost: (id: string | null, preset?: Partial<Publication>) => setPost({ id, preset }),
    abrirProjeto: (p: Project) => setProjetoAberto(p),
    novoProjeto: (cliente?: string) => { setClienteNovoProjeto(cliente); setIsNewProjectOpen(true); },
    irPara: (aba: NavTab) => setCurrentTab(aba),
  }), []);

  // Modo demonstração: simula os lembretes enquanto o app está aberto
  const avisar = useCallback((titulo: string, corpo: string) => setAviso(`${titulo} — ${corpo}`), []);
  useLembretesLocais(publications, usuario?.email, avisar);

  const postAtual = post?.id ? publications.find((p) => p.id === post.id) || null : null;
  const fecharPost = useCallback(() => setPost(null), []);

  return (
    <UIContext.Provider value={ui}>
      <div className="min-h-screen bg-canvas text-text-main antialiased flex">
        <Sidebar activeTab={currentTab} setActiveTab={setCurrentTab} />

        <div className="flex-1 min-w-0 px-4 sm:px-6 lg:px-10 pb-28 md:pb-12">
          <div className="max-w-[1320px] mx-auto">
            <Header
              onNewPost={() => ui.abrirPost(null)}
              onNewProject={() => setIsNewProjectOpen(true)}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />

            {isMockMode && (
              <div className="mt-2 mb-4 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs sm:text-sm text-amber-800">
                <b>Modo demonstração:</b> os dados ficam só neste navegador<span className="hidden sm:inline">. Conecte o Supabase para a equipe compartilhar tudo</span>.
              </div>
            )}
            {error && !isMockMode && (
              <div className="mt-2 mb-4 rounded-2xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-800">
                Não foi possível carregar os dados: {error}
              </div>
            )}

            <main className="pt-2 md:pt-4 anim-surgir" key={currentTab}>
              {currentTab === 'dashboard' && <Painel />}
              {currentTab === 'calendar' && <CalendarView onNewPost={() => ui.abrirPost(null)} />}
              {currentTab === 'projects' && (
                <ProjectsView onNewProject={() => setIsNewProjectOpen(true)} onOpenDetails={(p) => setProjetoAberto(p)} />
              )}
              {currentTab === 'clients' && <ClientsView />}
              {currentTab === 'client-portal' && (
                <Suspense fallback={<p className="cartao p-5 text-sm text-text-muted" role="status">Carregando Central de Clientes…</p>}>
                  <PortalTeamView initial={portalTarget?.area === 'team' ? portalTarget : undefined} />
                </Suspense>
              )}
              {currentTab === 'references' && <ReferencesView />}
              {currentTab === 'ai-copilot' && <AICopilotView />}
              {currentTab === 'traffic' && (
                <Suspense fallback={<p className="cartao p-5 text-sm text-text-muted" role="status">Carregando Traffic Intelligence…</p>}>
                  <TrafficIntelligenceView />
                </Suspense>
              )}
              {currentTab === 'settings' && <SettingsView />}
            </main>
          </div>
        </div>

        {/* Botão flutuante (celular) */}
        {(currentTab === 'dashboard' || currentTab === 'calendar') && (
          <button onClick={() => ui.abrirPost(null)} aria-label="Novo post"
            className="md:hidden fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 w-14 h-14 rounded-2xl bg-marinho text-white grid place-items-center shadow-elevada active:scale-95 transition-transform">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        )}

        <PostModal aberto={!!post && (!post.id || !!postAtual)} publicacao={postAtual} preset={post?.preset} aoFechar={fecharPost} />
        <NewProjectModal isOpen={isNewProjectOpen} initialClientName={clienteNovoProjeto} onClose={() => { setIsNewProjectOpen(false); setClienteNovoProjeto(undefined); }} />
        <ProjectDetailsModal isOpen={!!projetoAberto} project={projetoAberto} onClose={() => setProjetoAberto(null)} />
        <Toast isOpen={!!aviso} message={aviso || ''} type="info" onClose={() => setAviso(null)} duration={8000} />
      </div>
    </UIContext.Provider>
  );
}

export default App;
