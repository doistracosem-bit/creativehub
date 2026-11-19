import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verifica se as credenciais do Supabase foram preenchidas e são válidas
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http') &&
  !/placeholder|seu-projeto/i.test(supabaseUrl) &&
  supabaseAnonKey !== 'sua-chave-anon-publica' &&
  supabaseUrl !== 'https://your-project.supabase.co'
);

export const isMockMode = !isSupabaseConfigured;

if (isMockMode) {
  console.info(
    '⚡ [Creative Hub] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não detectadas no ambiente. Operando em MODO MOCK RESILIENTE (Protocolo VLAEG).'
  );
}

// Cria o cliente real ou cliente fallback resiliente para que o app nunca quebre
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient(
      'https://resilient-mock.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.resilient_mock_anon_key_for_development'
    );
