const Dashboard = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* StatCards placeholder */}
      {["Flota Activa", "OT Abiertas", "Gasto Mensual", "Proyectos Activos"].map((label) => (
        <div key={label} className="h-[88px] rounded-xl border border-border bg-card p-3.5 px-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-dm">{label}</p>
          <p className="mt-1 text-[28px] font-bold leading-tight font-barlow text-foreground">--</p>
        </div>
      ))}
    </div>
    <div className="rounded-xl border border-border bg-card p-6">
      <p className="text-sm text-muted-foreground font-dm">Dashboard en construcción — conectar datos de Supabase</p>
    </div>
  </div>
);
export default Dashboard;
