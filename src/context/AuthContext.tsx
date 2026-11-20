import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { googleSignInEnabled, supabase, isMockMode } from '../lib/supabase';
import type { TeamRole } from '../types';
import { portalMemberships } from '../services/portalService';
import type { PortalMembership } from '../services/portalService';
import { forgetPortalLink, rememberPortalLink } from '../lib/portalLinks';

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  papel: TeamRole;
}

type Estado = 'carregando' | 'deslogado' | 'sem-acesso' | 'ok' | 'cliente';

interface AuthContextType {
  estado: Estado;
  usuario: Usuario | null;
  emailLogado: string | null;
  empresas: PortalMembership[];
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
  const [empresas, setEmpresas] = useState<PortalMembership[]>([]);
  const lookup = useRef(0);

  const verificarMembro = useCallback(async (s: Session | null) => {
    const request = ++lookup.current;
    if (!s?.user?.email) { setUsuario(null); setEmpresas([]); setEstado('deslogado'); return; }
    const email = s.user.email.toLowerCase();
    const { data, error } = await supabase.from('team_members').select('email,name,role').eq('email', email).maybeSingle();
    if (request !== lookup.current) return;
    if (error || !data) {
      let memberships: PortalMembership[];
      try { memberships = await portalMemberships(); } catch { memberships = []; }
      if (request !== lookup.current) return;
      setUsuario(null);
      setEmpresas(memberships);
      setEstado(memberships.length ? 'cliente' : 'sem-acesso');
      return;
    }
    setEmpresas([]);
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
    let active = true;
    let timer = 0;
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      if (!active) return;
      window.clearTimeout(timer);
      lookup.current++;
      setSessao(s);
      // Evita chamar o banco dentro do callback do Supabase (recomendação da lib)
      timer = window.setTimeout(() => { if (active) void verificarMembro(s); }, 0);
    });
    return () => { active = false; lookup.current++; window.clearTimeout(timer); sub.subscription.unsubscribe(); };
  }, [verificarMembro]);

  const valor: AuthContextType = {
    estado,
    usuario,
    emailLogado: sessao?.user?.email ?? null,
    empresas,
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
      rememberPortalLink();
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
      if (error) throw error;
    },
    async sair() {
      forgetPortalLink();
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
