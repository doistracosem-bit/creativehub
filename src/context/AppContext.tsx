import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { 
  Project, 
  Publication, 
  Reference, 
  Stage, 
  PublicationStatus, 
  CreateProjectInput, 
  CreatePublicationInput, 
  CreateReferenceInput,
  Client,
  TeamMember,
  TeamRole
} from '../types';
import { 
  MOCK_PROJECTS, 
  MOCK_PUBLICATIONS, 
  MOCK_REFERENCES,
  MOCK_CLIENTS 
} from '../data/mockData';
import { supabase, isMockMode } from '../lib/supabase';
import { discardUnsavedReferenceImage, saveReferenceImage } from '../lib/referenceImages';

interface AppContextType {
  projects: Project[];
  publications: Publication[];
  references: Reference[];
  clients: Client[];
  isMockMode: boolean;
  loading: boolean;
  error: string | null;
  addProject: (input: CreateProjectInput) => Promise<Project>;
  updateProjectStage: (id: string, stage: Stage, progress?: number) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  addPublication: (input: CreatePublicationInput) => Promise<Publication>;
  updatePublicationStatus: (id: string, status: PublicationStatus) => Promise<void>;
  updatePublication: (id: string, data: Partial<Publication>) => Promise<void>;
  deletePublication: (id: string) => Promise<void>;
  addReference: (input: Omit<CreateReferenceInput, 'image_url'>, image: File | string) => Promise<Reference>;
  addClient: (name: string, niche: string, extra?: Partial<Client>) => Client;
  updateClient: (id: string, patch: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  addNewIdea: (idea: {
    client_name: string;
    format: string;
    headline: string;
    copy_text?: string;
    project_id?: string | null;
  }) => Promise<Publication>;
  refreshData: () => Promise<void>;
  team: TeamMember[];
  addMember: (email: string, name: string, role: TeamRole) => Promise<void>;
  updateMemberRole: (email: string, role: TeamRole) => Promise<void>;
  removeMember: (email: string) => Promise<void>;
  memberName: (email?: string | null) => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  PROJECTS: 'creative_hub_projects',
  PUBLICATIONS: 'creative_hub_publications',
  REFERENCES: 'creative_hub_references',
  CLIENTS: 'creative_hub_clients',
  TEAM: 'creative_hub_team',
};

const MOCK_TEAM: TeamMember[] = [
  { email: 'voce@doistracos.com.br', name: 'Você', role: 'admin' },
  { email: 'ana@doistracos.com.br', name: 'Ana', role: 'membro' },
  { email: 'leo@doistracos.com.br', name: 'Léo', role: 'membro' },
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>(() => {
    if (isMockMode) {
      const saved = localStorage.getItem(STORAGE_KEYS.PROJECTS);
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore */ }
      }
      return MOCK_PROJECTS;
    }
    return [];
  });

  const [publications, setPublications] = useState<Publication[]>(() => {
    if (isMockMode) {
      const saved = localStorage.getItem(STORAGE_KEYS.PUBLICATIONS);
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore */ }
      }
      return MOCK_PUBLICATIONS;
    }
    return [];
  });

  const [references, setReferences] = useState<Reference[]>(() => {
    if (isMockMode) {
      const saved = localStorage.getItem(STORAGE_KEYS.REFERENCES);
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore */ }
      }
      return MOCK_REFERENCES;
    }
    return [];
  });

  const [clients, setClients] = useState<Client[]>(() => {
    if (!isMockMode) return [];
    const saved = localStorage.getItem(STORAGE_KEYS.CLIENTS);
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return MOCK_CLIENTS;
  });

  const [team, setTeam] = useState<TeamMember[]>(() => {
    if (isMockMode) {
      const saved = localStorage.getItem(STORAGE_KEYS.TEAM);
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore */ }
      }
      return MOCK_TEAM;
    }
    return [];
  });

  const [loading, setLoading] = useState<boolean>(!isMockMode);
  const [error, setError] = useState<string | null>(null);

  // Sincroniza estado mock com localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    localStorage.setItem(STORAGE_KEYS.PUBLICATIONS, JSON.stringify(publications));
    if (isMockMode) {
      localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
      localStorage.setItem(STORAGE_KEYS.TEAM, JSON.stringify(team));
    }
  }, [projects, publications, clients, team]);

  // Carrega dados do Supabase se configurado
  const refreshData = useCallback(async () => {
    if (isMockMode) return;

    setLoading(true);
    setError(null);
    try {
      const [projRes, pubRes, refRes, teamRes, cliRes] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('publications').select('*').order('scheduled_for', { ascending: true }),
        supabase.from('references').select('*').order('created_at', { ascending: false }),
        supabase.from('team_members').select('email,name,role,created_at').order('name'),
        supabase.from('clients').select('*').order('name'),
      ]);

      if (projRes.error) throw projRes.error;
      if (pubRes.error) throw pubRes.error;
      if (refRes.error) throw refRes.error;
      if (teamRes.error) throw teamRes.error;
      if (cliRes.error) throw cliRes.error;

      setProjects(projRes.data as Project[]);
      setPublications(pubRes.data as Publication[]);
      setReferences(refRes.data as Reference[]);
      setTeam(teamRes.data as TeamMember[]);
      setClients(cliRes.data as Client[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar dados do Supabase';
      setError(msg);
      // Não mostra dados de exemplo com o banco real: melhor avisar do que confundir a equipe
      console.error('Falha ao carregar dados do Supabase:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isMockMode) {
      refreshData();
    }
  }, [refreshData]);

  // Ações: Projetos
  const addProject = async (input: CreateProjectInput): Promise<Project> => {
    const newProj: Project = {
      ...input,
      id: isMockMode ? `proj-${Date.now()}` : '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isMockMode) {
      setProjects((prev) => [newProj, ...prev]);
      return newProj;
    }

    const { data, error } = await supabase
      .from('projects')
      .insert([input])
      .select()
      .single();

    if (error) throw error;
    const created = data as Project;
    setProjects((prev) => [created, ...prev]);
    return created;
  };

  const updateProjectStage = async (id: string, stage: Stage, progress?: number): Promise<void> => {
    if (isMockMode) {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id === id) {
            return {
              ...p,
              stage,
              progress: progress !== undefined ? progress : p.progress,
              updated_at: new Date().toISOString(),
            };
          }
          return p;
        })
      );
      return;
    }

    const payload: Partial<Project> = { stage, updated_at: new Date().toISOString() };
    if (progress !== undefined) payload.progress = progress;

    const { error } = await supabase.from('projects').update(payload).eq('id', id);
    if (error) throw error;

    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...payload } : p))
    );
  };

  const deleteProject = async (id: string): Promise<void> => {
    if (!isMockMode) {
      // .select() devolve o que foi apagado: se vier vazio, o banco recusou (permissão)
      const { data, error } = await supabase.from('projects').delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Sem permissão para excluir este projeto.');
    }
    setProjects((prev) => prev.filter((p) => p.id !== id));
    // Os posts do projeto continuam, só perdem o vínculo
    setPublications((prev) => prev.map((pub) => (pub.project_id === id ? { ...pub, project_id: null } : pub)));
  };

  // Ações: Publicações
  const addPublication = async (input: CreatePublicationInput): Promise<Publication> => {
    const newPub: Publication = {
      ...input,
      id: isMockMode ? `pub-${Date.now()}` : '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isMockMode) {
      setPublications((prev) => [newPub, ...prev]);
      return newPub;
    }

    const { data, error } = await supabase
      .from('publications')
      .insert([input])
      .select()
      .single();

    if (error) throw error;
    const created = data as Publication;
    setPublications((prev) => [created, ...prev]);
    return created;
  };

  const updatePublicationStatus = async (id: string, status: PublicationStatus): Promise<void> => {
    if (isMockMode) {
      setPublications((prev) =>
        prev.map((pub) =>
          pub.id === id
            ? { ...pub, status, updated_at: new Date().toISOString() }
            : pub
        )
      );
      return;
    }

    const { error } = await supabase
      .from('publications')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    setPublications((prev) =>
      prev.map((pub) => (pub.id === id ? { ...pub, status } : pub))
    );
  };

  const updatePublication = async (id: string, data: Partial<Publication>): Promise<void> => {
    const updated = { ...data, updated_at: new Date().toISOString() };
    if (isMockMode) {
      setPublications((prev) =>
        prev.map((pub) => (pub.id === id ? { ...pub, ...updated } : pub))
      );
      return;
    }
    const { error } = await supabase.from('publications').update(updated).eq('id', id);
    if (error) throw error;
    setPublications((prev) =>
      prev.map((pub) => (pub.id === id ? { ...pub, ...updated } : pub))
    );
  };

  const deletePublication = async (id: string): Promise<void> => {
    if (isMockMode) {
      setPublications((prev) => prev.filter((pub) => pub.id !== id));
      return;
    }
    const { data, error } = await supabase.from('publications').delete().eq('id', id).select('id');
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Sem permissão para excluir este post.');
    setPublications((prev) => prev.filter((pub) => pub.id !== id));
  };

  const addNewIdea = async (idea: {
    client_name: string;
    format: string;
    headline: string;
    copy_text?: string;
    project_id?: string | null;
  }): Promise<Publication> => {
    return addPublication({
      project_id: idea.project_id || null,
      client_name: idea.client_name,
      scheduled_for: new Date(Date.now() + 86400000 * 2).toISOString(),
      status: 'IDEIA',
      format: idea.format,
      headline: idea.headline,
      copy_text: idea.copy_text || '',
      assets_ready: false,
    });
  };

  // Ações: Referências
  const addReference = async (fields: Omit<CreateReferenceInput, 'image_url'>, image: File | string): Promise<Reference> => {
    const input = { ...fields, image_url: await saveReferenceImage(image, isMockMode) };
    if (isMockMode) {
      const now = new Date().toISOString();
      const newRef: Reference = { ...input, id: crypto.randomUUID(), created_at: now, updated_at: now };
      let stored = references;
      try {
        const cached = localStorage.getItem(STORAGE_KEYS.REFERENCES);
        if (cached) stored = JSON.parse(cached) as Reference[];
      } catch { /* O estado atual cobre um cache ausente ou inválido. */ }

      const next = [newRef, ...stored];
      try {
        localStorage.setItem(STORAGE_KEYS.REFERENCES, JSON.stringify(next));
      } catch {
        throw new Error('O armazenamento da demonstração está cheio. Use um link ou uma imagem menor.');
      }
      setReferences(next);
      return newRef;
    }

    const { data, error } = await supabase
      .from('references')
      .insert([input])
      .select()
      .single();

    if (error) {
      await discardUnsavedReferenceImage(input.image_url).catch(() => undefined);
      throw new Error('Não foi possível salvar a referência. Tente novamente.');
    }
    const created = data as Reference;
    setReferences((prev) => [created, ...prev]);
    return created;
  };

  // Ações: Clientes
  const novoId = () =>
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `client-${Date.now()}`;

  const addClient = (name: string, niche: string, extra: Partial<Client> = {}): Client => {
    const nome = name.trim();
    const existente = clients.find((c) => c.name.toLowerCase() === nome.toLowerCase());
    if (existente) return existente;
    const newClient: Client = {
      phone: null, email: null, instagram: null, notes: null,
      ...extra,
      id: novoId(),
      name: nome,
      niche: (niche || 'Geral').trim(),
      created_at: new Date().toISOString(),
    };
    setClients((prev) => [...prev, newClient].sort((a, b) => a.name.localeCompare(b.name)));
    if (!isMockMode) {
      supabase.from('clients').insert(newClient).then(({ error }) => {
        if (error) console.error('Falha ao salvar cliente', error);
      });
    }
    return newClient;
  };

  const updateClient = async (id: string, patch: Partial<Client>): Promise<void> => {
    const atual = clients.find((c) => c.id === id);
    if (!atual) return;
    const novoNome = patch.name?.trim();
    const renomear = !!novoNome && novoNome !== atual.name;
    if (!isMockMode) {
      const { error } = await supabase.from('clients').update(patch).eq('id', id);
      if (error) throw error;
      if (renomear) {
        // Projetos e posts guardam o nome do cliente: atualiza junto
        await supabase.from('projects').update({ client_name: novoNome }).eq('client_name', atual.name);
        await supabase.from('publications').update({ client_name: novoNome }).eq('client_name', atual.name);
      }
    }
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)).sort((a, b) => a.name.localeCompare(b.name)));
    if (renomear) {
      setProjects((prev) => prev.map((p) => (p.client_name === atual.name ? { ...p, client_name: novoNome! } : p)));
      setPublications((prev) => prev.map((p) => (p.client_name === atual.name ? { ...p, client_name: novoNome! } : p)));
    }
  };

  const deleteClient = async (id: string): Promise<void> => {
    if (!isMockMode) {
      const { data, error } = await supabase.from('clients').delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Sem permissão para excluir este cliente.');
    }
    setClients((prev) => prev.filter((c) => c.id !== id));
  };

  // Ações: Equipe
  const addMember = async (email: string, name: string, role: TeamRole) => {
    const m: TeamMember = { email: email.trim().toLowerCase(), name: name.trim() || email.split('@')[0], role };
    if (!isMockMode) {
      const { error } = await supabase.from('team_members').upsert(m);
      if (error) throw error;
    }
    setTeam((prev) => [...prev.filter((x) => x.email !== m.email), m].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const updateMemberRole = async (email: string, role: TeamRole) => {
    if (!isMockMode) {
      const { error } = await supabase.from('team_members').update({ role }).eq('email', email);
      if (error) throw error;
    }
    setTeam((prev) => prev.map((m) => (m.email === email ? { ...m, role } : m)));
  };

  const removeMember = async (email: string) => {
    if (!isMockMode) {
      const { error } = await supabase.from('team_members').delete().eq('email', email);
      if (error) throw error;
    }
    setTeam((prev) => prev.filter((m) => m.email !== email));
  };

  const memberName = (email?: string | null) =>
    (email && (team.find((m) => m.email === email)?.name || email.split('@')[0])) || 'Equipe toda';

  return (
    <AppContext.Provider
      value={{
        team,
        addMember,
        updateMemberRole,
        removeMember,
        memberName,
        projects,
        publications,
        references,
        clients,
        isMockMode,
        loading,
        error,
        addProject,
        updateProjectStage,
        deleteProject,
        addPublication,
        updatePublicationStatus,
        updatePublication,
        deletePublication,
        addReference,
        addClient,
        updateClient,
        deleteClient,
        addNewIdea,
        refreshData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp deve ser utilizado dentro de um AppProvider');
  }
  return context;
};
