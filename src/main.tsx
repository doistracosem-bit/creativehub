import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AppProvider } from './context/AppContext.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { TelaLogin, TelaSemAcesso, TelaCarregando } from './components/auth/TelaLogin.tsx';
const CustomerPortal = lazy(() => import('./components/views/portal/CustomerPortal'));

// Só carrega os dados da equipe depois que a pessoa entrou e está liberada
function Portao() {
  const { estado } = useAuth();
  if (estado === 'carregando') return <TelaCarregando />;
  if (estado === 'deslogado') return <TelaLogin />;
  if (estado === 'sem-acesso') return <TelaSemAcesso />;
  if (estado === 'cliente') return <Suspense fallback={<TelaCarregando />}><CustomerPortal /></Suspense>;
  return (
    <AppProvider>
      <App />
    </AppProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Portao />
    </AuthProvider>
  </StrictMode>,
);
