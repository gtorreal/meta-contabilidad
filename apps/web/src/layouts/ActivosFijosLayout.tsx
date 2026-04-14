import { NavLink, Route, Routes } from "react-router-dom";
import { AssetsPage } from "../pages/AssetsPage";
import { CategoriesPage } from "../pages/CategoriesPage";
import { IndicesPage } from "../pages/IndicesPage";
import { PeriodsPage } from "../pages/PeriodsPage";
import { ReportsFixedAssetMovementPage } from "../pages/ReportsFixedAssetMovementPage";

const subLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200"
  }`;

export function ActivosFijosLayout() {
  return (
    <>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-2">
          <nav className="flex flex-wrap gap-1">
            <NavLink to="/activos-fijos" className={subLinkClass} end>
              Activos
            </NavLink>
            <NavLink to="/activos-fijos/indices" className={subLinkClass}>
              Índices
            </NavLink>
            <NavLink to="/activos-fijos/periodos" className={subLinkClass}>
              Períodos
            </NavLink>
            <NavLink to="/activos-fijos/categorias" className={subLinkClass}>
              Vida útil
            </NavLink>
            <NavLink to="/activos-fijos/reportes/movimiento-activos" className={subLinkClass}>
              Reportes
            </NavLink>
          </nav>
        </div>
      </div>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Routes>
          <Route index element={<AssetsPage />} />
          <Route path="indices" element={<IndicesPage />} />
          <Route path="periodos" element={<PeriodsPage />} />
          <Route path="categorias" element={<CategoriesPage />} />
          <Route path="reportes/movimiento-activos" element={<ReportsFixedAssetMovementPage />} />
        </Routes>
      </main>
    </>
  );
}
