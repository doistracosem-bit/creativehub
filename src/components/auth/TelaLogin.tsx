import React, { useState } from 'react';
import { Loader2, Mail, Lock, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { MARCA } from '../../lib/marca';

type Modo = 'entrar' | 'criar' | 'recuperar';

function traduzirErro(e: unknown): string {
  const m = (e as { message?: string })?.message?.toLowerCase() || '';
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (m.includes('already registered')) return 'Esse e-mail já tem conta. Use "Entrar".';
  if (m.includes('password should be')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos e tente de novo.';
  if (m.includes('provider is not enabled')) return 'O login com Google ainda não está disponível. Use seu e-mail e senha para entrar.';
  return 'Algo deu errado. Tente de novo.';
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-canvas">
      {/* Lado da marca (desktop) */}
      <div className="hidden lg:flex relative overflow-hidden bg-marinho flex-col justify-between p-12 text-white">
        <div className="absolute -right-24 -bottom-24 w-[520px] h-[520px] rounded-full bg-white/5" />
        <div className="absolute right-40 top-24 w-40 h-40 rounded-full bg-celeste/20" />
        <img src={MARCA.logoClaro} alt="Dois Traços" className="h-10 w-auto self-start relative" />
        <img src={MARCA.mascote} alt="" className="relative self-center h-[46vh] max-h-[460px] w-auto drop-shadow-[0_30px_40px_rgba(0,0,0,0.35)]" />
        <div className="relative max-w-md">
          <p className="text-3xl font-bold leading-tight">Projetos, posts e ideias da equipe num lugar só.</p>
          <p className="text-white/70 mt-3">E o lembrete chega no seu celular na hora de postar.</p>
        </div>
      </div>
      {/* Formulário */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <img src={MARCA.logoEscuro} alt="Dois Traços" className="h-9 w-auto mb-10 lg:hidden" />
          {children}
        </div>
      </div>
    </div>
  );
}

export const TelaLogin: React.FC = () => {
  const { entrarEmail, criarConta, recuperarSenha, entrarGoogle } = useAuth();
  const [modo, setModo] = useState<Modo>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [entrandoGoogle, setEntrandoGoogle] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setCarregando(true);
    try {
      if (modo === 'entrar') await entrarEmail(email, senha);
      if (modo === 'criar') { await criarConta(email, senha, nome); setMsg({ tipo: 'ok', texto: 'Conta criada! Se pedirmos confirmação, abra o link no seu e-mail.' }); }
      if (modo === 'recuperar') { await recuperarSenha(email); setMsg({ tipo: 'ok', texto: 'Enviamos um link para redefinir sua senha.' }); }
    } catch (err) { setMsg({ tipo: 'erro', texto: traduzirErro(err) }); }
    setCarregando(false);
  }

  async function continuarComGoogle() {
    setMsg(null);
    setEntrandoGoogle(true);
    try {
      await entrarGoogle();
    } catch (err) {
      setMsg({ tipo: 'erro', texto: traduzirErro(err) });
    } finally {
      setEntrandoGoogle(false);
    }
  }

  const titulo = modo === 'criar' ? 'Primeiro acesso' : modo === 'recuperar' ? 'Recuperar senha' : 'Bem-vindo de volta';

  return (
    <Moldura>
      <h1 className="text-2xl font-bold text-text-main">{titulo}</h1>
      <p className="text-sm text-text-muted mt-1 mb-7">
        {modo === 'criar' ? 'Use o e-mail cadastrado pela Dois Traços.' : 'Entre para acessar seu espaço no Creative Hub.'}
      </p>

      {modo !== 'recuperar' && (
        <>
          <button type="button" onClick={() => void continuarComGoogle()} disabled={entrandoGoogle || carregando} aria-busy={entrandoGoogle} className="btn-secundario w-full disabled:opacity-60">
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            {entrandoGoogle ? 'Verificando login com Google…' : 'Continuar com Google'}
          </button>
          <div className="flex items-center gap-3 my-5 text-xs text-text-muted">
            <span className="flex-1 h-px bg-border-subtle" />ou<span className="flex-1 h-px bg-border-subtle" />
          </div>
        </>
      )}

      <form onSubmit={enviar} className="space-y-3">
        {modo === 'criar' && (
          <label className="relative block">
            <User className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input className="campo pl-10" placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </label>
        )}
        <label className="relative block">
          <Mail className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input className="campo pl-10" type="email" autoComplete="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {modo !== 'recuperar' && (
          <label className="relative block">
            <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input className="campo pl-10" type="password" autoComplete={modo === 'criar' ? 'new-password' : 'current-password'} placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={6} />
          </label>
        )}
        {msg && <p role={msg.tipo === 'erro' ? 'alert' : 'status'} className={msg.tipo === 'erro' ? 'text-sm text-red-700' : 'text-sm text-emerald-700'}>{msg.texto}</p>}
        <button className="btn-primario w-full" disabled={carregando || entrandoGoogle}>
          {carregando && <Loader2 className="w-4 h-4 animate-spin" />}
          {modo === 'criar' ? 'Criar acesso' : modo === 'recuperar' ? 'Enviar link' : 'Entrar'}
        </button>
      </form>

      <div className="flex justify-between mt-5 text-sm">
        {modo === 'entrar' ? (
          <>
            <button className="font-semibold text-accent-glow hover:underline" onClick={() => { setModo('criar'); setMsg(null); }}>Primeiro acesso</button>
            <button className="text-text-muted hover:text-text-main" onClick={() => { setModo('recuperar'); setMsg(null); }}>Esqueci a senha</button>
          </>
        ) : (
          <button className="font-semibold text-accent-glow hover:underline" onClick={() => { setModo('entrar'); setMsg(null); }}>← Voltar para o login</button>
        )}
      </div>
    </Moldura>
  );
};

export const TelaSemAcesso: React.FC = () => {
  const { emailLogado, sair, recarregar } = useAuth();
  return (
    <Moldura>
      <img src={MARCA.mascote} alt="" className="h-40 w-auto mb-6 lg:hidden" />
      <h1 className="text-2xl font-bold text-text-main">Acesso ainda não liberado</h1>
      <p className="text-sm text-text-muted mt-2 mb-7">
        O e-mail <b className="text-text-main">{emailLogado}</b> ainda não tem acesso nesta sessão. Se você é cliente, entre com Google usando o e-mail cadastrado pela Dois Traços.
      </p>
      <div className="space-y-2">
        <button className="btn-primario w-full" onClick={() => recarregar()}>Tentar de novo</button>
        <button className="btn-fantasma w-full" onClick={() => sair()}>Usar outra conta</button>
      </div>
    </Moldura>
  );
};

export const TelaCarregando: React.FC = () => (
  <div className="min-h-screen grid place-items-center bg-canvas">
    <img src={MARCA.marca} alt="Dois Traços" className="h-12 w-auto animate-pulse" />
  </div>
);
