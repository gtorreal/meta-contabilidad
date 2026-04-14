import { NavLink, Outlet } from "react-router-dom";

const topLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
    isActive ? "bg-slate-900 text-white" : "text-slate-100 hover:bg-slate-700"
  }`;

export function AppShell() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <span className="text-lg font-semibold tracking-tight text-white">meta-contabilidad</span>
          <nav className="flex flex-wrap gap-1">
            <NavLink to="/activos-fijos" className={topLinkClass}>
              Activos Fijos
            </NavLink>
            <NavLink to="/arriendo-inmueble" className={topLinkClass}>
              Arriendo Inmueble
            </NavLink>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
