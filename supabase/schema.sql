-- ==============================================================================
-- Dois Traços — Creative Hub · Banco de dados (Supabase / PostgreSQL)
-- Rode este arquivo inteiro no Supabase: SQL Editor → New query → colar → Run.
-- Pode rodar de novo sem problema (ele só cria o que estiver faltando).
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Projetos
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name TEXT NOT NULL,
    project_name TEXT NOT NULL,
    stage TEXT NOT NULL CHECK (stage IN ('BRIEFING', 'PRODUCAO', 'REVISAO', 'CONCLUIDO')),
    deadline TIMESTAMPTZ,
    progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 2. Publicações (posts do calendário)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    client_name TEXT,
    scheduled_for TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('IDEIA', 'CRIANDO', 'APROVADO', 'AGENDADO', 'POSTADO')),
    format TEXT,
    headline TEXT,
    copy_text TEXT,
    assets_ready BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Excluir um projeto NÃO apaga os posts dele (eles só ficam sem projeto)
ALTER TABLE public.publications DROP CONSTRAINT IF EXISTS publications_project_id_fkey;
ALTER TABLE public.publications ADD CONSTRAINT publications_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

-- Novos campos: responsável e lembrete
ALTER TABLE public.publications
    ADD COLUMN IF NOT EXISTS responsible_email TEXT,
    ADD COLUMN IF NOT EXISTS reminder_minutes INT NOT NULL DEFAULT 60,
    ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS due_sent BOOLEAN NOT NULL DEFAULT false;

-- ------------------------------------------------------------------------------
-- 3. Referências e sessões de IA
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    niche TEXT,
    image_url TEXT,
    notes TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    ai_insights JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt TEXT NOT NULL,
    niche TEXT,
    generated_briefing JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 3b. Clientes (aba Clientes) — compartilhados com a equipe toda
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    niche TEXT NOT NULL DEFAULT 'Geral',
    phone TEXT,
    email TEXT,
    instagram TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cadastra automaticamente os clientes que já aparecem em projetos e posts
INSERT INTO public.clients (name)
SELECT DISTINCT client_name FROM (
    SELECT client_name FROM public.projects
    UNION SELECT client_name FROM public.publications
) nomes
WHERE client_name IS NOT NULL AND client_name <> ''
ON CONFLICT (name) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. Equipe (quem pode entrar no app) — a chave é o e-mail, sempre minúsculo
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_members (
    email TEXT PRIMARY KEY CHECK (email = lower(email)),
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'membro' CHECK (role IN ('admin', 'membro')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 5. Aparelhos inscritos para receber notificações (um por celular/computador)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    email TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_projects_stage ON public.projects(stage);
CREATE INDEX IF NOT EXISTS idx_publications_project_id ON public.publications(project_id);
CREATE INDEX IF NOT EXISTS idx_publications_status ON public.publications(status);
CREATE INDEX IF NOT EXISTS idx_publications_scheduled_for ON public.publications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_push_email ON public.push_subscriptions(email);

-- ------------------------------------------------------------------------------
-- Gatilhos: updated_at automático e reprogramação dos lembretes
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER SET search_path = public AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Se a data/hora ou a antecedência do lembrete mudar, os avisos são enviados de novo
CREATE OR REPLACE FUNCTION public.reprogramar_lembretes()
RETURNS TRIGGER SET search_path = public AS $$
BEGIN
    IF NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for
       OR NEW.reminder_minutes IS DISTINCT FROM OLD.reminder_minutes THEN
        NEW.reminder_sent = false;
        NEW.due_sent = false;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_projects_updated_at ON public.projects;
CREATE TRIGGER trigger_projects_updated_at BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_publications_updated_at ON public.publications;
CREATE TRIGGER trigger_publications_updated_at BEFORE UPDATE ON public.publications
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_publications_lembretes ON public.publications;
CREATE TRIGGER trigger_publications_lembretes BEFORE UPDATE ON public.publications
    FOR EACH ROW EXECUTE FUNCTION public.reprogramar_lembretes();

DROP TRIGGER IF EXISTS trigger_clients_updated_at ON public.clients;
CREATE TRIGGER trigger_clients_updated_at BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_references_updated_at ON public.references;
CREATE TRIGGER trigger_references_updated_at BEFORE UPDATE ON public.references
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_ai_sessions_updated_at ON public.ai_sessions;
CREATE TRIGGER trigger_ai_sessions_updated_at BEFORE UPDATE ON public.ai_sessions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- Funções de permissão (quem está logado é da equipe? é admin?)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.meu_email()
RETURNS TEXT LANGUAGE sql STABLE SET search_path = public AS $$
    SELECT lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

CREATE OR REPLACE FUNCTION public.is_member()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.team_members WHERE email = public.meu_email());
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.team_members WHERE email = public.meu_email() AND role = 'admin');
$$;

-- ------------------------------------------------------------------------------
-- SEGURANÇA (Row Level Security)
-- Antes qualquer pessoa com o link podia ler e apagar tudo. Agora só a equipe.
-- ------------------------------------------------------------------------------
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Remove as políticas antigas (acesso público)
DROP POLICY IF EXISTS "Public access to projects" ON public.projects;
DROP POLICY IF EXISTS "Public access to publications" ON public.publications;
DROP POLICY IF EXISTS "Public access to references" ON public.references;
DROP POLICY IF EXISTS "Public access to ai_sessions" ON public.ai_sessions;

DROP POLICY IF EXISTS "Equipe acessa projetos" ON public.projects;
CREATE POLICY "Equipe acessa projetos" ON public.projects FOR ALL TO authenticated
    USING (public.is_member()) WITH CHECK (public.is_member());

DROP POLICY IF EXISTS "Equipe acessa publicacoes" ON public.publications;
CREATE POLICY "Equipe acessa publicacoes" ON public.publications FOR ALL TO authenticated
    USING (public.is_member()) WITH CHECK (public.is_member());

DROP POLICY IF EXISTS "Equipe acessa clientes" ON public.clients;
CREATE POLICY "Equipe acessa clientes" ON public.clients FOR ALL TO authenticated
    USING (public.is_member()) WITH CHECK (public.is_member());

DROP POLICY IF EXISTS "Equipe acessa referencias" ON public.references;
CREATE POLICY "Equipe acessa referencias" ON public.references FOR ALL TO authenticated
    USING (public.is_member()) WITH CHECK (public.is_member());

DROP POLICY IF EXISTS "Equipe acessa sessoes IA" ON public.ai_sessions;
CREATE POLICY "Equipe acessa sessoes IA" ON public.ai_sessions FOR ALL TO authenticated
    USING (public.is_member()) WITH CHECK (public.is_member());

-- Equipe: todo mundo da equipe vê a lista (e cada um vê o próprio cadastro); só admin altera
DROP POLICY IF EXISTS "Equipe ve equipe" ON public.team_members;
CREATE POLICY "Equipe ve equipe" ON public.team_members FOR SELECT TO authenticated
    USING (public.is_member() OR email = public.meu_email());

DROP POLICY IF EXISTS "Admin gerencia equipe" ON public.team_members;
CREATE POLICY "Admin gerencia equipe" ON public.team_members FOR ALL TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Aparelhos: cada pessoa registra/atualiza só os próprios
DROP POLICY IF EXISTS "Cada um gerencia seus aparelhos" ON public.push_subscriptions;
CREATE POLICY "Cada um gerencia seus aparelhos" ON public.push_subscriptions FOR ALL TO authenticated
    USING (email = public.meu_email() AND public.is_member())
    WITH CHECK (email = public.meu_email() AND public.is_member());

-- ------------------------------------------------------------------------------
-- PRIMEIRO ADMIN — troque SEU_EMAIL e SEU NOME abaixo (e-mail tudo minúsculo) e rode.
-- Os demais você adiciona pelo próprio app, em "Equipe e avisos".
-- ------------------------------------------------------------------------------
-- INSERT INTO public.team_members (email, name, role)
-- VALUES ('SEU_EMAIL@gmail.com', 'SEU NOME', 'admin')
-- ON CONFLICT (email) DO UPDATE SET role = 'admin';

-- ------------------------------------------------------------------------------
-- OBS.: no projeto app-lembrete o Claude aplicou, além deste arquivo, as migrações:
--   permissoes_em_esquema_privado (funções de permissão no esquema "privado"),
--   lembretes_config_e_chaves (cofre/Vault + chaves geradas pelo próprio Supabase),
--   agendar_lembretes_cron (robô a cada 5 min) e permissoes_tabelas.
-- Veja em Supabase → Database → Migrations.
-- ------------------------------------------------------------------------------
