import { useEffect, lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { ScrollToTop } from '@/components/ScrollToTop';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuthStore } from '@/stores/authStore';

const Login = lazy(() => import('./pages/Login'));
const Unauthorized = lazy(() => import('./pages/Unauthorized'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Clientes = lazy(() => import('./pages/Clientes'));
const Proveedores = lazy(() => import('./pages/Proveedores'));
const Maquinas = lazy(() => import('./pages/Maquinas'));
const MaquinaDetalle = lazy(() => import('./pages/MaquinaDetalle'));
const Personal = lazy(() => import('./pages/Personal'));
const Proyectos = lazy(() => import('./pages/Proyectos'));
const ProyectoDetalle = lazy(() => import('./pages/ProyectoDetalle'));
const Preoperacionales = lazy(() => import('./pages/Preoperacionales'));
const PreoperacionalOperario = lazy(() => import('./pages/PreoperacionalOperario'));
const OrdenesTrabajo = lazy(() => import('./pages/OrdenesTrabajo'));
const MisOT = lazy(() => import('./pages/MisOT'));
const Inventario = lazy(() => import('./pages/Inventario'));
const Configuracion = lazy(() => import('./pages/Configuracion'));
const Financiero = lazy(() => import('./pages/Financiero'));
const NotFound = lazy(() => import('./pages/NotFound'));

const queryClient = new QueryClient();

function AppInit({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize);
  useEffect(() => { initialize(); }, [initialize]);
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AppInit>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              <Route element={<ProtectedRoute allowedRoles={['operario']} />}>
                <Route path="/preoperacional" element={<ErrorBoundary moduleName="Preoperacional"><PreoperacionalOperario /></ErrorBoundary>} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['tecnico']} />}>
                <Route path="/mis-ot" element={<ErrorBoundary moduleName="Mis OT"><MisOT /></ErrorBoundary>} />
                <Route path="/mis-ot/:id" element={<ErrorBoundary moduleName="Mis OT"><MisOT /></ErrorBoundary>} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['superadmin', 'gerente', 'supervisor', 'tecnico', 'operario']} />}>
                <Route element={<AppLayout />}>
                  <Route element={<ProtectedRoute allowedRoles={['superadmin', 'gerente', 'supervisor']} />}>
                    <Route path="/dashboard" element={<ErrorBoundary moduleName="Dashboard"><Dashboard /></ErrorBoundary>} />
                    <Route path="/clientes" element={<ErrorBoundary moduleName="Clientes"><Clientes /></ErrorBoundary>} />
                    <Route path="/proveedores" element={<ErrorBoundary moduleName="Proveedores"><Proveedores /></ErrorBoundary>} />
                    <Route path="/maquinas" element={<ErrorBoundary moduleName="Máquinas"><Maquinas /></ErrorBoundary>} />
                    <Route path="/maquinas/:id" element={<ErrorBoundary moduleName="Detalle Máquina"><MaquinaDetalle /></ErrorBoundary>} />
                    <Route path="/personal" element={<ErrorBoundary moduleName="Personal"><Personal /></ErrorBoundary>} />
                    <Route path="/proyectos" element={<ErrorBoundary moduleName="Proyectos"><Proyectos /></ErrorBoundary>} />
                    <Route path="/proyectos/:id" element={<ErrorBoundary moduleName="Detalle Proyecto"><ProyectoDetalle /></ErrorBoundary>} />
                    <Route path="/preoperacionales" element={<ErrorBoundary moduleName="Preoperacionales"><Preoperacionales /></ErrorBoundary>} />
                    <Route path="/ordenes-trabajo" element={<ErrorBoundary moduleName="Órdenes de Trabajo"><OrdenesTrabajo /></ErrorBoundary>} />
                    <Route path="/inventario" element={<ErrorBoundary moduleName="Inventario"><Inventario /></ErrorBoundary>} />
                  </Route>
                  <Route element={<ProtectedRoute allowedRoles={['superadmin', 'gerente']} />}>
                    <Route path="/analytics" element={<ErrorBoundary moduleName="Analytics"><Analytics /></ErrorBoundary>} />
                    <Route path="/financiero" element={<ErrorBoundary moduleName="Financiero"><Financiero /></ErrorBoundary>} />
                    <Route path="/configuracion" element={<ErrorBoundary moduleName="Configuración"><Configuracion /></ErrorBoundary>} />
                  </Route>
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AppInit>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
