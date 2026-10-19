"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { 
  Search, 
  Plus, 
  Users, 
  DoorClosed, 
  Phone, 
  ArrowRight, 
  Utensils,
  CreditCard,
  ShieldCheck,
  Building,
  Trash2
} from "lucide-react";
import { formatDate } from "@/lib/billing-cycle";

interface ResidentItem {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  idType: string | null;
  idNumber: string | null;
  isActive: boolean;
  roomName: string | null;
  portionName: string | null;
  moveInDate: string | null;
}

export default function ResidentsPage() {
  const [residents, setResidents] = useState<ResidentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("active");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchResidents();
  }, [filterActive]);

  async function fetchResidents() {
    setLoading(true);
    try {
      const includeInactive = filterActive !== "active";
      const res = await fetch(`/api/residents?includeInactive=${includeInactive}`);
      const json = await res.json();
      if (json.success) {
        setResidents(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch residents", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete resident "${name}"?\n\nThis will remove all their records, bills, payments, and room history from the database.`
      )
    ) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/residents/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        fetchResidents();
      } else {
        alert(json.error || "Failed to delete resident");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred while deleting resident");
    } finally {
      setDeletingId(null);
    }
  }

  const activeCount = residents.filter((r) => r.isActive).length;
  const inactiveCount = residents.filter((r) => !r.isActive).length;

  const filtered = residents.filter((r) => {
    if (filterActive === "active" && !r.isActive) return false;
    if (filterActive === "inactive" && r.isActive) return false;

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.name.toLowerCase().includes(term) ||
      (r.phone && r.phone.toLowerCase().includes(term)) ||
      (r.roomName && r.roomName.toLowerCase().includes(term)) ||
      (r.portionName && r.portionName.toLowerCase().includes(term))
    );
  });

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
              <Users className="w-7 h-7 text-primary" />
              <span>Residents Directory</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Active residents, room allocations, food preferences, and move-in/move-out workflows
            </p>
          </div>

          <Link
            href="/residents/new"
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground font-bold text-xs px-4 py-2.5 rounded-xl hover:brightness-110 transition-all shadow-md shadow-primary/25 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Move In New Resident</span>
          </Link>
        </div>

        {/* Quick Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border-2 border-border/80 rounded-xl p-3.5">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground">ACTIVE GIRLS</span>
            <div className="text-xl font-black font-mono text-primary mt-0.5">{activeCount}</div>
          </div>
          <div className="bg-card border-2 border-border/80 rounded-xl p-3.5">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground">MOVED OUT / PAST</span>
            <div className="text-xl font-black font-mono text-muted-foreground mt-0.5">{inactiveCount}</div>
          </div>
          <div className="bg-card border-2 border-border/80 rounded-xl p-3.5">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground">BASE RENT</span>
            <div className="text-xl font-black font-mono text-foreground mt-0.5">₹5,500</div>
          </div>
          <div className="bg-card border-2 border-border/80 rounded-xl p-3.5">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground">WITH FOOD</span>
            <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">₹8,000</div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by resident name, room, portion, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-card border-2 border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
            />
          </div>

          <div className="flex items-center gap-1 border-2 border-border/80 rounded-xl bg-card p-1 shadow-2xs">
            <button
              onClick={() => setFilterActive("active")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterActive === "active"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setFilterActive("inactive")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterActive === "inactive"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Past ({inactiveCount})
            </button>
            <button
              onClick={() => setFilterActive("all")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filterActive === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({residents.length})
            </button>
          </div>
        </div>

        {/* Table / Empty State */}
        {loading ? (
          <div className="bg-card border-2 border-border/80 rounded-2xl p-12 text-center text-sm text-muted-foreground">
            Loading resident records...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border-2 border-border/80 rounded-2xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-2xl">
              👩
            </div>
            <div className="text-base font-bold text-foreground">No residents found</div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchTerm
                ? "No residents match your search. Try another query."
                : "No residents enrolled yet. Click below to move in your first resident."}
            </p>
            {!searchTerm && (
              <Link
                href="/residents/new"
                className="inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline pt-2"
              >
                <Plus className="w-4 h-4" /> Move In New Resident
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-card border-2 border-border/80 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 border-b-2 border-border text-muted-foreground font-extrabold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">Resident</th>
                    <th className="py-3.5 px-4">Room Allocation</th>
                    <th className="py-3.5 px-4">Move-in Date</th>
                    <th className="py-3.5 px-4">Contact Phone</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/residents/${r.id}`}
                          className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-2.5"
                        >
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary/20 to-indigo-500/20 text-primary border border-primary/30 flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                            {r.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-extrabold text-sm block">{r.name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ID: #{r.id}
                            </span>
                          </div>
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        {r.roomName ? (
                          <div className="inline-flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-lg border border-border/80">
                            <DoorClosed className="w-3.5 h-3.5 text-primary" />
                            <span className="font-bold text-foreground">{r.roomName}</span>
                            <span className="text-muted-foreground text-[11px]">({r.portionName})</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">Vacated</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground font-mono">
                        {r.moveInDate ? formatDate(r.moveInDate) : "—"}
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        {r.phone ? (
                          <span className="flex items-center gap-1 text-foreground font-semibold">
                            <Phone className="w-3.5 h-3.5 text-primary" />
                            {r.phone}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">None</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                            r.isActive
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          {r.isActive ? "Active" : "Moved Out"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/residents/${r.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all shadow-2xs"
                          >
                            <span>Manage</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                          <button
                            onClick={() => handleDelete(r.id, r.name)}
                            disabled={deletingId === r.id}
                            title="Permanently Delete Resident"
                            className="p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-all disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
