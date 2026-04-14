import { Navigate, Route, Routes } from "react-router-dom";
import { ActivosFijosLayout } from "./layouts/ActivosFijosLayout";
import { AppShell } from "./layouts/AppShell";
import { ArriendoInmueblePage } from "./pages/ArriendoInmueblePage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/activos-fijos" replace />} />
        <Route path="/activos-fijos/*" element={<ActivosFijosLayout />} />
        <Route path="/arriendo-inmueble" element={<ArriendoInmueblePage />} />
      </Route>
    </Routes>
  );
}
