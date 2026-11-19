import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { googleSignInEnabled, supabase, isMockMode } from '../lib/supabase';
import type { TeamRole } from '../types';

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  papel: TeamRole;
}

type Estado = 'carregando' | 'deslogado' | 'sem-acesso' | 'ok';

interface AuthContextType {
  estado: Estado;
  usuario: Usuario | null;
  emailLogado: string | null;
  entrarEmail: (email: string, senha: string) => Promise<void>;
  criarConta: (email: string, senha: string, nome: string) => Promise<void>;
  recuperarSenha: (email: string) => Promise<void>;
  entrarGoogle: () => Promise<void>;
  sair: () => Promise<void>;
  recarregar: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USUARIO_DEMO: Usuario = { id: 'demo', email: 'voce@doistracos.com.br', nome: 'Você', papel: 'admin' };

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [estado, setEstado] = useState<Estado>(isMockMode ? 'ok' : 'carregando');
  const [usuario, setUsuario] = useState<Usuario | null>(isMockMode ? USUARIO_DEMO : null);
  const [sessao, setSessao] = useState<Session | null>(null);

  const verificarMembro = useCallback(async (s: Session | null) => {
    if (!s?.user?.email) { setUsuario(null); setEstado('deslogado'); return; }
    const email = s.user.email.toLowerCase();
    const { data, error } = await supabase.from('team_members').select('email,name,role').eq('email', email).maybeSingle();
    if (error || !data) { setUsuario(null); setEstado('sem-acesso'); return; }
    setUsuario({
      id: s.user.id,
      email,
      nome: data.name || (s.user.user_metadata?.full_name as string) || email.split('@')[0],
      papel: data.role as TeamRole,
    });
    setEstado('ok');
  }, []);

  useEffect(() => {
    if (isMockMode) return;
    supabase.auth.getSession().then(({ data }) => { setSessao(data.session); verificarMembro(data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSessao(s);
      // Evita chamar o banco dentro do callback do Supabase (recomendação da lib)
      setTimeout(() => verificarMembro(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [verificarMembro]);

  const valor: AuthContextType = {
    estado,
    usuario,
    emailLogado: sessao?.user?.email ?? null,
    async entrarEmail(email, senha) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error) throw error;
    },
    async criarConta(email, senha, nome) {
      const { error } = await supabase.auth.signUp({
        email: email.trim(), password: senha,
        options: { data: { full_name: nome }, emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
    },
    async recuperarSenha(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
      if (error) throw error;
    },
    async entrarGoogle() {
      if (!await googleSignInEnabled()) throw new Error('Google provider is not enabled');
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
      if (error) throw error;
    },
    async sair() {
      if (isMockMode) { localStorage.clear(); window.location.reload(); return; }
      await supabase.auth.signOut();
    },
    recarregar: () => verificarMembro(sessao),
  };

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return c;
};
