"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { 
  Home, 
  Users, 
  DoorClosed, 
  Gauge, 
  Receipt, 
  CreditCard, 
  ShieldCheck, 
  BarChart3, 
  Settings, 
  LogOut,
  Sparkles,
  Zap,
  Building2,
  ChevronRight,
  TrendingUp
} from "lucide-react";

interface NavGroup {
  title: string;
  items: {
    href: string;
    label: string;
    icon: any;
    badge?: string;
    badgeColor?: string;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "OPERATIONS",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Home },
      { href: "/residents", label: "Residents", icon: Users },
      { href: "/rooms", label: "Rooms & Portions", icon: DoorClosed, badge: "8 Rooms", badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    ],
  },
  {
    title: "FINANCIALS & METERS",
    items: [
      { href: "/meters", label: "12 Submeters", icon: Gauge, badge: "₹10/unit", badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
      { href: "/billing", label: "Monthly Bills", icon: Receipt, badge: "1st-1st", badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
      { href: "/payments", label: "Payments Ledger", icon: CreditCard },
      { href: "/security-deposits", label: "Security Deposits", icon: ShieldCheck },
      { href: "/expenses", label: "Expenses & P&L", icon: TrendingUp, badge: "P&L", badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
    ],
  },
  {
    title: "INSIGHTS & CONTROLS",
    items: [
      { href: "/reports/outstanding", label: "Outstanding Dues", icon: BarChart3 },
      { href: "/settings", label: "Rates & Audit Log", icon: Settings },
    ],
  },
];

export function AppSidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 lg:w-72 h-full flex flex-col bg-card border-r border-border select-none">
      {/* 1. Brand Header */}
      <div className="p-5 border-b border-border bg-gradient-to-br from-card via-card to-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-indigo-500 text-primary-foreground flex items-center justify-center font-black text-xl shadow-md shadow-primary/25">
            🏠
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-foreground">
                PG Manager
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wider">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
              <span>Girls PG Accommodation</span>
            </p>
          </div>
        </div>

        {/* Quick Property Chip */}
        <div className="mt-3.5 pt-3 border-t border-border/60 flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground font-medium flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-primary" />
            4 Portions · 8 Rooms
          </span>
          <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-[10px]">
            ⚡ 12 Meters
          </span>
        </div>
      </div>

      {/* 2. Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="space-y-1">
            <div className="px-3 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/80 mb-2">
              {group.title}
            </div>

            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30 font-bold translate-x-1"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/70 hover:translate-x-0.5"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                        isActive ? "text-primary-foreground" : "text-primary"
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isActive
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : item.badgeColor || "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* 3. Property Quick Config Pill Widget */}
      <div className="p-3 mx-3 mb-2 rounded-xl bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-primary/10 border border-border/80">
        <div className="flex items-center justify-between text-[11px] mb-1 font-semibold text-foreground">
          <span className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Pricing Rules
          </span>
          <span className="font-mono font-bold text-primary">₹10 / unit</span>
        </div>
        <div className="text-[10px] text-muted-foreground space-y-0.5">
          <div className="flex justify-between">
            <span>Base Rent:</span>
            <span className="font-mono font-bold text-foreground">₹5,500</span>
          </div>
          <div className="flex justify-between">
            <span>With Food:</span>
            <span className="font-mono font-bold text-foreground">₹8,000</span>
          </div>
          <div className="flex justify-between pt-0.5 border-t border-border/40 text-[9px] text-muted-foreground/80">
            <span>Billing Cycle:</span>
            <span className="font-bold">1st to 1st</span>
          </div>
        </div>
      </div>

      {/* 4. Operator Profile & Logout Footer */}
      <div className="p-3 border-t border-border bg-card">
        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30 border border-border/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-indigo-600 text-primary-foreground flex items-center justify-center font-extrabold text-xs shrink-0 shadow-sm">
              KT
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-foreground truncate">
                Kirat Tejay
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                Administrator
              </div>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
