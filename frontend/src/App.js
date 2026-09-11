import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Orchestrator from "./pages/Orchestrator";
import DocumentAnalysis from "./pages/DocumentAnalysis";
import DamageMatrix from "./pages/DamageMatrix";
import Generator from "./pages/Generator";
import Vault from "./pages/Vault";
import { Loader2 } from "lucide-react";

function Protected({ children }) {
  const { user } = useAuth();
  if (user === null)
    return (
      <div className="min-h-screen flex items-center justify-center jp-canvas">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <Toaster position="top-right" richColors closeButton />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/app"
              element={
                <Protected>
                  <Layout />
                </Protected>
              }
            >
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="orchestrator" element={<Orchestrator />} />
              <Route path="documenti" element={<DocumentAnalysis />} />
              <Route path="danno" element={<DamageMatrix />} />
              <Route path="generatore" element={<Generator />} />
              <Route path="vault" element={<Vault />} />
            </Route>
            <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
