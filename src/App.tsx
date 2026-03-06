import { useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { useAuthStore } from '@/stores/authStore';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Clientes from './pages/Clientes';
import Proveedores from './pages/Proveedores';
import Maquinas from './pages/Maquinas';
import MaquinaDetalle from './pages/MaquinaDetalle';
import Personal from './pages/Personal';
import Proyectos from './pages/Proyectos';
import ProyectoDetalle from './pages/ProyectoDetalle';
import Preoperacionales from './pages/Preoperacionales';
import OrdenesTrabajo from './pages/OrdenesTrabajo';
import Inventario from './pages/Inventario';
import Configuracion from './pages/Configuracion';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

function AppInit({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize);
  useEffect(() => {
    initialize();
  }, [initialize]);
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppInit>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Protected routes with AppLayout */}
            <Route element={<ProtectedRoute allowedRoles={['superadmin', 'gerente', 'supervisor', 'tecnico', 'operario']} />}>
              <Route element={<AppLayout />}>
                <Route element={<ProtectedRoute allowedRoles={['superadmin', 'gerente', 'supervisor']} />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/clientes" element={<Clientes />} />
                  <Route path="/proveedores" element={<Proveedores />} />
                  <Route path="/maquinas" element={<Maquinas />} />
                  <Route path="/maquinas/:id" element={<MaquinaDetalle />} />
                  <Route path="/personal" element={<Personal />} />
                  <Route path="/proyectos" element={<Proyectos />} />
                  <Route path="/proyectos/:id" element={<ProyectoDetalle />} />
                  <Route path="/preoperacionales" element={<Preoperacionales />} />
                  <Route path="/ordenes-trabajo" element={<OrdenesTrabajo />} />
                  <Route path="/inventario" element={<Inventario />} />
                </Route>
                <Route element={<ProtectedRoute allowedRoles={['superadmin', 'gerente']} />}>
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/configuracion" element={<Configuracion />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppInit>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
