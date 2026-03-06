

## Plan: Correcciones Visuales Globales + Logo + Skeleton Suave

### Problemas identificados:
1. **Skeleton de carga toma toda la pantalla** — El `Suspense fallback` en App.tsx muestra `PageSkeleton` que reemplaza TODO incluido sidebar/navbar. Esto es porque el `Suspense` envuelve las rutas completas, no solo el contenido dentro de `AppLayout`.
2. **Financiero** — Título "💵 Financiero" duplicado (TopHeader ya muestra el nombre del módulo). Botones de período (Mes actual, 3m...) deben reemplazarse por AdvancedFilters con date pickers.
3. **Inventario** — Layout no se ajusta visualmente al resto de módulos (posible sidebar lateral o tabs que se desalinean).
4. **Filtros AdvancedFilters** no se usan en Dashboard, Analytics, OT, Inventario, Financiero.
5. **Logo** falta en Login y Sidebar — se usa texto "U&D" en vez de la imagen real.

### Cambios planificados:

#### 1. Skeleton solo en el área de contenido (no pantalla completa)
- **App.tsx**: Mover el `Suspense` fallback para que solo aplique dentro de `AppLayout`, no alrededor de todo. El `AppLayout` siempre renderiza sidebar+header, y solo el `<Outlet>` muestra skeleton.
- **AppLayout.tsx**: Envolver `<Outlet />` con `<Suspense fallback={<PageSkeleton />}>` en vez de en App.tsx.
- Hacer el skeleton más rápido/sutil: reducir la animación `page-fade-in` y hacer el shimmer más suave.

#### 2. Financiero — Eliminar título redundante y mejorar filtros
- **Financiero.tsx**: Eliminar el bloque header `<h1>💵 Financiero</h1>` y los botones de período. Reemplazar con `AdvancedFilters` con dateRange habilitado. Usar `dateFrom`/`dateTo` como state en vez de `period`.

#### 3. Inventario — Ajustar layout
- Revisar y asegurar que Inventario no tiene sidebar lateral extra. Verificar que usa el mismo patrón `space-y-4` que otros módulos.

#### 4. Agregar logo real
- Copiar `user-uploads://Logo_Up_Down_Solar_Sin_fondo_1.png` a `src/assets/logo.png`.
- **Login.tsx**: Reemplazar el div con "U&D" por `<img src={logo} />`.
- **AppSidebar.tsx**: Reemplazar el div con "U&D" por `<img src={logo} />`.

#### 5. Filtros en módulos faltantes
- Dashboard, Analytics, OT, Inventario ya tienen sus propios filtros internos; el principal problema reportado son los filtros de Clientes/Proveedores (AdvancedFilters) que "no se visualizan bien". Revisar y corregir el rendering.

### Archivos a modificar:
- `src/App.tsx` — Simplificar Suspense
- `src/components/layout/AppLayout.tsx` — Agregar Suspense con skeleton solo en contenido
- `src/pages/Financiero.tsx` — Eliminar header redundante, reemplazar period buttons por AdvancedFilters con date range
- `src/pages/Login.tsx` — Agregar logo imagen
- `src/components/layout/AppSidebar.tsx` — Agregar logo imagen
- `src/index.css` — Suavizar animación page-fade-in
- `src/pages/Inventario.tsx` — Verificar y ajustar layout

