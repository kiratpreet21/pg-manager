"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BarChart3, Download, Printer, Search, Plus, ArrowRight, MessageCircle } from "lucide-react";
import { formatDate } from "@/lib/billing-cycle";
import { formatINR } from "@/lib/decimal";
import { formatWhatsAppReminderMessage, getWhatsAppShareUrl } from "@/lib/upi";

interface ReportRow {
  residentId: number;
  name: string;
  phone: string | null;
  isActive: boolean;
  roomName: string;
  portionName: string;
  totalBilled: string;
  totalPaid: string;
  outstanding: string;
  lastPaymentDate: string | null;
  lastPaymentAmount: string | null;
}

export default function OutstandingReportPage() {
  const [data, setData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "pending" | "settled" | "advance">("pending");

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/outstanding");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const totalPendingDues = data
    .filter((r) => Number(r.outstanding) > 0)
    .reduce((acc, r) => acc + Number(r.outstanding), 0);

  const totalAdvanceCredits = data
    .filter((r) => Number(r.outstanding) < 0)
    .reduce((acc, r) => acc + Math.abs(Number(r.outstanding)), 0);

  const totalRevenueCollected = data.reduce(
    (acc, r) => acc + Number(r.totalPaid),
    0
  );

  const filtered = data.filter((r) => {
    const bal = Number(r.outstanding);
    if (filterType === "pending" && bal <= 0) return false;
    if (filterType === "settled" && bal !== 0) return false;
    if (filterType === "advance" && bal >= 0) return false;

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.name.toLowerCase().includes(term) ||
      r.roomName.toLowerCase().includes(term) ||
      (r.phone && r.phone.toLowerCase().includes(term))
    );
  });

  function exportCSV() {
    const headers = [
      "Resident Name",
      "Room",
      "Portion",
      "Status",
      "Total Billed",
      "Total Paid",
      "Outstanding Balance",
      "Last Payment Date",
    ];
    const rows = filtered.map((r) => [
      `"${r.name}"`,
      `"${r.roomName}"`,
      `"${r.portionName}"`,
      r.isActive ? "Active" : "Moved Out",
      r.totalBilled,
      r.totalPaid,
      r.outstanding,
      r.lastPaymentDate ? formatDate(r.lastPaymentDate) : "None",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pg_outstanding_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Outstanding Balances Report
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Live account balances computed from all finalized bills and payments
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-muted text-foreground transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={exportCSV}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-muted text-foreground transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground">Total Pending Dues</div>
            <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
              {formatINR(totalPendingDues)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Across {data.filter((r) => Number(r.outstanding) > 0).length} resident(s)
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground">Total Advance Credits</div>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {formatINR(totalAdvanceCredits)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Overpaid or advance payments held
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground">All-Time Revenue Collected</div>
            <div className="text-2xl font-bold font-mono text-foreground mt-1">
              {formatINR(totalRevenueCollected)}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 print:hidden">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, room, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex items-center gap-1 border border-border rounded-md bg-card p-1">
            <button
              onClick={() => setFilterType("pending")}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                filterType === "pending"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pending Dues Only
            </button>
            <button
              onClick={() => setFilterType("advance")}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                filterType === "advance"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Advance Credits
            </button>
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                filterType === "all"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Residents
            </button>
          </div>
        </div>

        {/* Report Table */}
        {loading ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
            Calculating balances...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center space-y-3">
            <div className="text-3xl">🎉</div>
            <h3 className="font-semibold text-sm text-foreground">No Records Matching Filter</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {filterType === "pending"
                ? "No residents have pending dues at this moment!"
                : "No residents match the selected filter."}
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Resident</th>
                    <th className="py-3 px-4">Room & Portion</th>
                    <th className="py-3 px-4 font-mono text-right">Total Billed</th>
                    <th className="py-3 px-4 font-mono text-right">Total Paid</th>
                    <th className="py-3 px-4 font-mono text-right">Net Balance</th>
                    <th className="py-3 px-4">Last Payment</th>
                    <th className="py-3 px-4 text-right print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((r) => {
                    const bal = Number(r.outstanding);
                    return (
                      <tr key={r.residentId} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <Link
                            href={`/residents/${r.residentId}`}
                            className="font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                          >
                            <span>{r.name}</span>
                            {!r.isActive && (
                              <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">
                                Exited
                              </span>
                            )}
                          </Link>
                          {r.phone && (
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {r.phone}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-foreground">{r.roomName}</span>
                          <span className="text-muted-foreground ml-1">({r.portionName})</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-right text-muted-foreground">
                          {formatINR(r.totalBilled)}
                        </td>
                        <td className="py-3 px-4 font-mono text-right text-emerald-600 dark:text-emerald-400">
                          {formatINR(r.totalPaid)}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-sm text-right">
                          <span
                            className={
                              bal > 0
                                ? "text-rose-600 dark:text-rose-400"
                                : bal < 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground"
                            }
                          >
                            {bal > 0 ? `+${formatINR(r.outstanding)}` : formatINR(r.outstanding)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {r.lastPaymentDate ? (
                            <div>
                              <span>{formatDate(r.lastPaymentDate)}</span>
                              <span className="font-mono text-foreground font-medium ml-1">
                                ({formatINR(r.lastPaymentAmount || "0")})
                              </span>
                            </div>
                          ) : (
                            <span className="italic text-muted-foreground">Never</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right print:hidden">
                          {bal > 0 && (
                            <div className="flex items-center justify-end gap-2">
                              <a
                                href={getWhatsAppShareUrl(
                                  r.phone,
                                  formatWhatsAppReminderMessage({
                                    residentName: r.name,
                                    outstandingAmount: r.outstanding,
                                  })
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 transition-all border border-[#25D366]/30"
                                title="Send WhatsApp payment reminder"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>Remind</span>
                              </a>
                              <Link
                                href={`/payments/record?residentId=${r.residentId}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs"
                              >
                                <span>Pay</span>
                                <ArrowRight className="w-3 h-3" />
                              </Link>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
