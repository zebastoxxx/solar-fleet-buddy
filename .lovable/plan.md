

## Plan: Mobile-First Responsive Optimization (PWA-Ready)

The app has several mobile pain points: fixed-width components, desktop-only layouts, tables that don't collapse on small screens, and rigid flex/grid containers. This plan addresses every module systematically.

---

### 1. Core UI Components (Foundation)

**`src/components/ui/action-bar.tsx`** — Currently a rigid `flex h-12 items-center justify-between`. On mobile, ActionBarLeft and ActionBarRight stack on top of each other and overflow.
- Change to `flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4`
- ActionBarLeft/Right: `flex flex-wrap items-center gap-2`

**`src/components/ui/search-input.tsx`** — Fixed `w-48`. 
- Change to `w-full sm:w-48` so it fills mobile width

**`src/components/ui/filter-pills.tsx`** — Horizontal row overflows.
- Add `flex-wrap` and `overflow-x-auto` for mobile scrolling

**`src/components/ui/stat-card.tsx`** — Fixed `h-[88px]` can clip on small text.
- Change to `min-h-[88px] h-auto`

**`src/components/ui/DataTable.tsx`** — Already has `overflow-x-auto` wrapper, but should ensure the wrapper is present

---

### 2. Layout (`AppLayout.tsx`, `TopHeader.tsx`)

Already mostly responsive (sidebar hidden on mobile with hamburger). Minor tweaks:
- `main` padding: change `p-5 px-6` to `p-3 sm:p-5 sm:px-6`
- Ensure SamFAB doesn't overlap bottom nav on mobile

---

### 3. Dashboard (`Dashboard.tsx`)

- StatCards grid: already `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` ✓
- Fleet grid inner: `grid-cols-2 md:grid-cols-3` — change to `grid-cols-1 xs:grid-cols-2 md:grid-cols-3`
- Row 2 split `lg:grid-cols-5`: on mobile both sections stack, which is fine ✓
- Alert items: the `flex items-center justify-between` can overflow — add `flex-wrap gap-2`
- Activity feed: ✓ already stacks

---

### 4. Máquinas (`Maquinas.tsx`)

- Cards grid: already `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` ✓
- Kanban: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` ✓
- ActionBar buttons: on mobile, view toggle + "Nueva Máquina" button should wrap — handled by ActionBar fix
- "Nueva Máquina" button: show icon-only on mobile with `<span className="hidden sm:inline">Nueva Máquina</span>`

---

### 5. MáquinaDetalle (`MaquinaDetalle.tsx`)

- Header uses `flex-col md:flex-row` ✓
- Tabs: `TabsList` should scroll horizontally on mobile — add `overflow-x-auto` and `w-full`
- Technical sheet grid: ensure `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`
- Action buttons in header: stack on mobile with `flex-wrap gap-2`

---

### 6. OrdenesTrabajo (`OrdenesTrabajo.tsx`)

This is the biggest issue — uses a raw `<Table>` with 11 columns.
- Wrap in `overflow-x-auto` (already has it)
- On mobile, hide less-important columns: Ubicación, Horas, Costo, Fecha using `hidden md:table-cell`
- Filter bar: currently `flex flex-wrap` ✓ but Select elements should be `w-full sm:w-36`
- "Nueva OT" button: icon-only on mobile

---

### 7. Clientes, Proveedores, Personal

All use `ActionBar` + `DataTable` or `<Table>`.
- ActionBar fix handles the filter/search stacking
- Tables: hide non-essential columns on mobile with `hidden sm:table-cell`
- Detail modals: ensure `DialogContent` uses `max-w-lg w-[95vw]` pattern

---

### 8. Configuración (`Configuracion.tsx`)

Uses side-by-side vertical nav (`w-[180px]`) + content. On mobile this is cramped.
- Change to: on mobile, tabs become horizontal scrollable pills at top; on desktop keep vertical sidebar
- `flex flex-col md:flex-row gap-4 md:gap-6`
- Nav: `md:w-[180px] md:shrink-0` with horizontal flex on mobile

---

### 9. Financiero (`Financiero.tsx`)

- Date filter bar: `flex flex-wrap` ✓ but date inputs need `w-full sm:w-auto`
- Period pills: `flex-wrap`
- Charts: `ResponsiveContainer` already handles width ✓
- KPIs: `grid-cols-2 lg:grid-cols-4` ✓
- Tabs: add horizontal scroll

---

### 10. Inventario (`Inventario.tsx`)

- KPI grid: `grid-cols-2 md:grid-cols-4` ✓
- Tabs: ensure horizontal scroll on mobile
- Tables inside tabs: hide non-essential columns on mobile

---

### 11. Proyectos, ProyectoDetalle, Preoperacionales

- Same ActionBar + DataTable patterns — handled by component-level fixes
- ProyectoDetalle tabs: add horizontal scroll
- Project header: ensure wrapping on mobile

---

### 12. Global CSS Adjustments (`src/index.css`)

- Add safe-area insets for PWA: `padding-bottom: env(safe-area-inset-bottom)` on the main content
- Ensure touch targets are minimum 44px on interactive elements

---

### 13. SamFAB Position

- Adjust to `bottom-[calc(1rem+env(safe-area-inset-bottom))]` for PWA bottom safe area
- Ensure it doesn't overlap action buttons on small screens

---

### Summary of Files to Modify:

**Core UI (affects all pages):**
- `src/components/ui/action-bar.tsx`
- `src/components/ui/search-input.tsx`
- `src/components/ui/filter-pills.tsx`
- `src/components/ui/stat-card.tsx`

**Layout:**
- `src/components/layout/AppLayout.tsx`
- `src/components/ai/SamFAB.tsx`

**Pages:**
- `src/pages/Dashboard.tsx`
- `src/pages/Maquinas.tsx`
- `src/pages/MaquinaDetalle.tsx`
- `src/pages/OrdenesTrabajo.tsx`
- `src/pages/Configuracion.tsx`
- `src/pages/Financiero.tsx`
- `src/pages/Inventario.tsx`
- `src/pages/Clientes.tsx`
- `src/pages/Proveedores.tsx`
- `src/pages/Personal.tsx`
- `src/pages/Proyectos.tsx`
- `src/pages/ProyectoDetalle.tsx`
- `src/pages/Preoperacionales.tsx`

**CSS:**
- `src/index.css`

No database changes needed. No new files. Pure responsive CSS/layout adjustments.

