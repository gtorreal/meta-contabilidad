import { NavLink, Route, Routes } from "react-router-dom";
import { AssetsPage } from "./pages/AssetsPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { IndicesPage } from "./pages/IndicesPage";
import { PeriodsPage } from "./pages/PeriodsPage";
import { ReportsFixedAssetMovementPage } from "./pages/ReportsFixedAssetMovementPage";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200"}`;

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <span className="text-lg font-semibold tracking-tight">meta-contabilidad</span>
          <nav className="flex flex-wrap gap-1">
            <NavLink to="/" className={linkClass} end>
              Activos
            </NavLink>
            <NavLink to="/indices" className={linkClass}>
              Índices
            </NavLink>
            <NavLink to="/periodos" className={linkClass}>
              Períodos
            </NavLink>
            <NavLink to="/categorias" className={linkClass}>
              Vida útil
            </NavLink>
            <NavLink to="/reportes/movimiento-activos" className={linkClass}>
              Reportes
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Routes>
          <Route path="/" element={<AssetsPage />} />
          <Route path="/indices" element={<IndicesPage />} />
          <Route path="/periodos" element={<PeriodsPage />} />
          <Route path="/categorias" element={<CategoriesPage />} />
          <Route path="/reportes/movimiento-activos" element={<ReportsFixedAssetMovementPage />} />
        </Routes>
      </main>
    </div>
  );
}
