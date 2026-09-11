import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Network, FileSearch, Calculator, FileSignature, Database, Scale, LogOut, Gavel,
} from "lucide-react";
import { Button } from "./ui/button";
import { Footer } from "./Legal";
import { toast } from "sonner";

const NAV = [
  { to: "/app/dashboard", label: "Quadro Generale", icon: LayoutDashboard, testid: "nav-tab-dashboard", sub: "Rischi & scadenze" },
  { to: "/app/orchestrator", label: "Console Multi-Agente", icon: Network, testid: "nav-tab-orchestrator", sub: "Bus Cluster A" },
  { to: "/app/documenti", label: "Audit Documentale", icon: FileSearch, testid: "nav-tab-document-analysis", sub: "Atti PA & contratti" },
  { to: "/app/danno", label: "Stima Peritale del Pregiudizio", icon: Calculator, testid: "nav-tab-damage-matrix", sub: "Quantificazione economica" },
  { to: "/app/generatore", label: "Generatore Bozze Tecniche", icon: FileSignature, testid: "nav-tab-generator", sub: "PEC · TAR · Corte Conti" },
  { to: "/app/vault", label: "Vault Memoria", icon: Database, testid: "nav-tab-vault", sub: "RAG & self-learning" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const doLogout = async () => {
    await logout();
    toast.success("Sessione terminata");
    nav("/login");
  };

  return (
    <div className="min-h-screen flex jp-canvas">
      <aside className="w-72 shrink-0 bg-[#0F2027] text-slate-200 hidden md:flex flex-col sticky top-0 h-screen">
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-md bg-white/10 flex items-center justify-center">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-serif font-bold text-white text-lg leading-none">JUS&#8209;PATRIMONIUM</p>
              <p className="jp-eyebrow text-white/40 mt-1">Cluster A · Legal</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto jp-scroll">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                data-testid={n.testid}
                className={({ isActive }) =>
                  `flex items-start gap-3 px-3 py-2.5 rounded-md transition-colors duration-150 ${
                    isActive ? "bg-white/12 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                <Icon className="w-[18px] h-[18px] mt-0.5 shrink-0" />
                <span>
                  <span className="block text-sm font-medium leading-tight">{n.label}</span>
                  <span className="block text-[11px] text-slate-400/80">{n.sub}</span>
                </span>
              </NavLink>
            );
          })}
          {user?.role === "admin" && (
            <NavLink to="/app/rete-legali" data-testid="nav-tab-lawyers"
              className={({ isActive }) =>
                `flex items-start gap-3 px-3 py-2.5 rounded-md transition-colors duration-150 ${
                  isActive ? "bg-white/12 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}>
              <Gavel className="w-[18px] h-[18px] mt-0.5 shrink-0" />
              <span>
                <span className="block text-sm font-medium leading-tight">Rete Legali</span>
                <span className="block text-[11px] text-slate-400/80">Avvocati convenzionati</span>
              </span>
            </NavLink>
          )}
        </nav>
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-semibold uppercase">
              {(user?.name || user?.email || "U").slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-white truncate">{user?.name || "Operatore"}</p>
              <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <Button data-testid="logout-button" onClick={doLogout} variant="ghost"
            className="w-full justify-start text-slate-300 hover:text-white hover:bg-white/10 h-9">
            <LogOut className="w-4 h-4 mr-2" /> Esci
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
          <Outlet />
          <Footer />
        </div>
      </main>
    </div>
  );
}
