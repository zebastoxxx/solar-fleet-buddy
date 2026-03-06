import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopHeader } from "./TopHeader";
import { Menu } from "lucide-react";
import { useAlerts } from "@/hooks/useAlerts";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useAlerts(); // Initialize realtime alerts globally

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-40 h-screen w-[220px] bg-[hsl(var(--sidebar-bg))] flex flex-col
        transition-transform duration-200
        md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <AppSidebar onClose={() => setSidebarOpen(false)} />
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col md:ml-[220px]">
        <TopHeader onMenuClick={() => setSidebarOpen(true)} />
        <main id="main-content" className="flex-1 p-5 px-6 page-content">
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-primary focus:text-primary-foreground focus:p-2 focus:rounded">
            Ir al contenido principal
          </a>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
