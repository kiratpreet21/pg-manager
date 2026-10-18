"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ShieldCheck, Search, ArrowRight, User } from "lucide-react";
import { formatDate } from "@/lib/billing-cycle";
import { formatINR } from "@/lib/decimal";

interface DepositItem {
  id: number;
  residentId: number;
  residentName: string;
  residentIsActive: boolean;
  amountPaid: string;
  paymentDate: string;
  paymentMode: string;
  reference: string | null;
  amountRefunded: string;
  refundDate: string | null;
  refundMode: string | null;
  refundReference: string | null;
  refundNotes: string | null;
  status: "held" | "partially_refunded" | "fully_refunded";
  notes: string | null;
}

export default function SecurityDepositsPage() {
  const [deposits, setDeposits] = useState<DepositItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadDeposits();
  }, []);

  async function loadDeposits() {
    setLoading(true);
    try {
      const res = await fetch("/api/security-deposits");
      const json = await res.json();
      if (json.success) {
        setDeposits(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const totalPaid = deposits.reduce((acc, d) => acc + Number(d.amountPaid), 0);
  const totalRefunded = deposits.reduce(
    (acc, d) => acc + Number(d.amountRefunded),
    0
  );
  const totalHeld = totalPaid - totalRefunded;

  const filtered = deposits.filter((d) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      d.residentName.toLowerCase().includes(term) ||
      (d.reference && d.reference.toLowerCase().includes(term)) ||
      (d.refundNotes && d.refundNotes.toLowerCase().includes(term))
    );
  });

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Security Deposits Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track security deposits held per resident, refunds, deductions, and settlement status
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground">Currently Held Deposits</div>
            <div className="text-2xl font-bold font-mono text-primary mt-1">
              {formatINR(totalHeld)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Liability held across {deposits.filter((d) => d.status === "held").length} resident(s)
            </p>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground">Total Deposits Received</div>
            <div className="text-2xl font-bold font-mono text-foreground mt-1">
              {formatINR(totalPaid)}
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground">Total Refunded on Move-out</div>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {formatINR(totalRefunded)}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by resident name or reference..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
            Loading security deposits...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center space-y-3">
            <div className="text-3xl">🛡️</div>
            <h3 className="font-semibold text-sm text-foreground">No Security Deposits Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Security deposits can be recorded during move-in from the &quot;Move In New Resident&quot; form.
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Resident</th>
                    <th className="py-3 px-4">Paid Date</th>
                    <th className="py-3 px-4">Amount Paid</th>
                    <th className="py-3 px-4">Refunded</th>
                    <th className="py-3 px-4">Currently Held</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Deduction / Refund Notes</th>
                    <th className="py-3 px-4 text-right">Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((d) => {
                    const heldAmount = Number(d.amountPaid) - Number(d.amountRefunded);
                    return (
                      <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <Link
                            href={`/residents/${d.residentId}`}
                            className="font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                          >
                            <span>{d.residentName}</span>
                            {!d.residentIsActive && (
                              <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">
                                Exited
                              </span>
                            )}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {formatDate(d.paymentDate)}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-foreground">
                          {formatINR(d.amountPaid)}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          {Number(d.amountRefunded) > 0 ? formatINR(d.amountRefunded) : "—"}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-primary">
                          {formatINR(heldAmount)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${
                              d.status === "held"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : d.status === "fully_refunded"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {d.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground max-w-xs truncate">
                          {d.refundNotes || d.notes || "—"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/residents/${d.residentId}`}
                            className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                          >
                            <span>View</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
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
