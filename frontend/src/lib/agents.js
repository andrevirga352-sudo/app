import { FileCheck2, AlertTriangle, Handshake, Calculator, ScrollText, Bot } from "lucide-react";

export const AGENT_ICONS = {
  A1: FileCheck2,
  A2: AlertTriangle,
  A3: Handshake,
  A4: Calculator,
  A5: ScrollText,
};

export const AGENT_COLORS = {
  A1: { text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", ring: "bg-blue-600", dot: "#2563eb" },
  A2: { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", ring: "bg-amber-500", dot: "#d97706" },
  A3: { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", ring: "bg-emerald-600", dot: "#047857" },
  A4: { text: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200", ring: "bg-rose-600", dot: "#be123c" },
  A5: { text: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200", ring: "bg-purple-600", dot: "#7c3aed" },
};

export const iconFor = (id) => AGENT_ICONS[id] || Bot;
export const colorFor = (id) => AGENT_COLORS[id] || AGENT_COLORS.A1;
