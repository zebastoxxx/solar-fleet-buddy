import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Clientes from "./pages/Clientes";
import Proveedores from "./pages/Proveedores";
import Maquinas from "./pages/Maquinas";
import Personal from "./pages/Personal";
import Proyectos from "./pages/Proyectos";
import Preoperacionales from "./pages/Preoperacionales";
import OrdenesTrabajo from "./pages/OrdenesTrabajo";
import Inventario from "./pages/Inventario";
import Configuracion from "./pages/Configuracion";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/proveedores" element={<Proveedores />} />
            <Route path="/maquinas" element={<Maquinas />} />
            <Route path="/personal" element={<Personal />} />
            <Route path="/proyectos" element={<Proyectos />} />
            <Route path="/preoperacionales" element={<Preoperacionales />} />
            <Route path="/ordenes-trabajo" element={<OrdenesTrabajo />} />
            <Route path="/inventario" element={<Inventario />} />
            <Route path="/configuracion" element={<Configuracion />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
