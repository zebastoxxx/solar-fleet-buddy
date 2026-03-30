import { useState, Suspense } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopHeader } from "./TopHeader";
import { Menu } from "lucide-react";
import { useAlerts } from "@/hooks/useAlerts";
import { SkeletonStatCards, SkeletonTableRows } from "@/components/ui/SkeletonLoaders";
import { SamFAB } from "@/components/ai/SamFAB";
import { SamChat } from "@/components/ai/SamChat";

function ContentSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="skeleton-shimmer h-8 w-40" />
      <SkeletonStatCards count={4} />
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [samOpen, setSamOpen] = useState(false);
  useAlerts(); // Initialize realtime alerts globally

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-screen w-[220px] bg-[hsl(var(--sidebar-bg))] flex flex-col
        transition-transform duration-200 ease-out will-change-transform
        md:z-30 md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <AppSidebar onClose={() => setSidebarOpen(false)} />
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0 md:ml-[220px]">
        <TopHeader onMenuClick={() => setSidebarOpen(true)} />
        <main id="main-content" className="flex-1 overflow-y-auto p-3 sm:p-5 sm:px-6 page-content pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-primary focus:text-primary-foreground focus:p-2 focus:rounded">
            Ir al contenido principal
          </a>
          <Suspense fallback={<ContentSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Sam AI Agent */}
      <SamFAB onClick={() => setSamOpen(true)} />
      <SamChat open={samOpen} onOpenChange={setSamOpen} />
    </div>
  );
}
