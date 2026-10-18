"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { AppSidebar } from "./app-sidebar";
import { 
  Menu, 
  X, 
  Plus, 
  CreditCard, 
  Calendar, 
  Zap,
  Building,
  Sparkles
} from "lucide-react";
import { getCurrentCycleStart, formatCycle } from "@/lib/billing-cycle";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentCycle = getCurrentCycleStart();
  const cycleDisplay = formatCycle(currentCycle);

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col md:flex-row">
      {/* 1. Desktop Fixed Sidebar */}
      <div className="hidden md:block fixed inset-y-0 left-0 z-40 w-64 lg:w-72">
        <AppSidebar />
      </div>

      {/* 2. Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex-1 max-w-xs w-full bg-card h-full z-10 shadow-2xl">
            <div className="absolute top-3 right-3 z-20">
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-md bg-muted text-foreground hover:bg-muted/80"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <AppSidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* 3. Main Content Container */}
      <div className="flex-1 md:pl-64 lg:pl-72 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 h-16 border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75 flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-xs">
          {/* Mobile hamburger */}
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-lg bg-muted text-foreground hover:bg-muted/80"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5 font-bold text-sm">
              <span>🏠</span>
              <span>PG Manager</span>
            </div>
          </div>

          {/* Desktop Left: Live Billing Cycle & Status Pill */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Calendar className="w-3.5 h-3.5" />
              <span>Cycle: {cycleDisplay}</span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-600 dark:text-amber-400 font-mono">
              <Zap className="w-3.5 h-3.5" />
              <span>₹10.00 / unit</span>
            </div>
          </div>

          {/* Right Action Shortcut Buttons (Maximalist) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/payments/record"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-bold text-foreground hover:bg-accent hover:border-primary/50 transition-all shadow-xs"
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Record</span> Payment
            </Link>

            <Link
              href="/residents/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground text-xs font-bold hover:brightness-110 transition-all shadow-md shadow-primary/20"
            >
              <Plus className="w-4 h-4" />
              <span>Move In Girl</span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
