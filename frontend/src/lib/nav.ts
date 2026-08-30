import {
  Activity,
  BarChart2,
  CheckSquare,
  FileText,
  Package,
  Settings,
  ShoppingCart,
  ShieldAlert,
  Store,
  Wallet,
} from "lucide-react";

export type TabId =
  | "overview"
  | "live"
  | "mission"
  | "inventory"
  | "pipeline"
  | "suppliers"
  | "approvals"
  | "payments"
  | "ledger"
  | "configure";

export interface NavItem {
  id: TabId;
  label: string;
  icon: React.FC<any>;
  /** visually distinct top-level sections */
  section?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Overview", icon: BarChart2 },
  { id: "live", label: "Live Intel", icon: Activity },
  { id: "mission", label: "Mission Control", icon: ShieldAlert },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "pipeline", label: "Restock Pipeline", icon: ShoppingCart },
  { id: "suppliers", label: "Suppliers", icon: Store },
  { id: "approvals", label: "Approvals", icon: CheckSquare },
  { id: "payments", label: "Payments", icon: Wallet },
  { id: "ledger", label: "Audit Trail", icon: FileText },
  { id: "configure", label: "Configuration", icon: Settings },
];

/** legacy navigation order preserved for users who already know the tabs */
export const LEGACY_TAB_IDS: TabId[] = ["overview", "live", "mission", "approvals", "ledger", "configure"];

export function navItem(id: TabId): NavItem {
  return NAV_ITEMS.find((n) => n.id === id) ?? NAV_ITEMS[0];
}

export function tabTitle(id: TabId): string {
  return navItem(id).label;
}