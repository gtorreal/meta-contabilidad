import { Navigate, Route, Routes } from "react-router-dom";
import { ActivosFijosLayout } from "./layouts/ActivosFijosLayout";
import { AppShell } from "./layouts/AppShell";
import { ArriendoInmueblePage } from "./pages/ArriendoInmueblePage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/activos-fijos" replace />} />
        {/* Redirects for old flat routes */}
        <Route path="/indices" element={<Navigate to="/activos-fijos/indices" replace />} />
        <Route path="/periodos" element={<Navigate to="/activos-fijos/periodos" replace />} />
        <Route path="/categorias" element={<Navigate to="/activos-fijos/categorias" replace />} />
        <Route path="/reportes/*" element={<Navigate to="/activos-fijos/reportes/movimiento-activos" replace />} />
        <Route path="/activos-fijos/*" element={<ActivosFijosLayout />} />
        <Route path="/arriendo-inmueble" element={<ArriendoInmueblePage />} />
        {/* Catch-all: any unknown path goes to the main module */}
        <Route path="*" element={<Navigate to="/activos-fijos" replace />} />
      </Route>
    </Routes>
  );
}
