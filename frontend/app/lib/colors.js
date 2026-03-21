// Shared design tokens — single source of truth for all components
export const PALETTE = {
  base:       "#0a0a0f",
  card:       "#111827",
  cardAlt:    "#1a1a2e",
  border:     "#1f2937",
  borderHover:"#374151",
  text:       "#f9fafb",
  textMuted:  "#9ca3af",
  textDim:    "#6b7280",
  accent:     "#6366f1",
  accentLight:"#818cf8",
  green:      "#10b981",
  red:        "#ef4444",
  yellow:     "#f59e0b",
  blue:       "#38bdf8",
  purple:     "#c084fc",
  orange:     "#f97316",
};

export const CAT_COLORS = {
  trading:   { color: "#10b981", bg: "#064e3b20", pill: "#064e3b", label: "Trading",   icon: "↗" },
  analysis:  { color: "#818cf8", bg: "#1e1b4b20", pill: "#1e1b4b", label: "Analysis",  icon: "◎" },
  data:      { color: "#38bdf8", bg: "#0c1a2e20", pill: "#0c1a2e", label: "Data",      icon: "≋" },
  risk:      { color: "#c084fc", bg: "#3b076420", pill: "#3b0764", label: "Risk",      icon: "◬" },
  composite: { color: "#f97316", bg: "#43100320", pill: "#431003", label: "Composite", icon: "⬡" },
  default:   { color: "#64748b", bg: "#1e293b20", pill: "#1e293b", label: "Other",     icon: "⊕" },
};

export const GRADIENT = "linear-gradient(135deg, #818cf8, #34d399)";
