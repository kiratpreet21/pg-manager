"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CreditCard, Plus, Search, Filter, Calendar } from "lucide-react";
import { formatDate } from "@/lib/billing-cycle";
import { formatINR } from "@/lib/decimal";

interface PaymentItem {
  id: number;
  residentId: number;
  residentName: string;
  billId: number | null;
  billCycleStart: string | null;
  amount: string;
  paymentDate: string;
  paymentMode: string;
  reference: string | null;
  notes: string | null;
  recordedBy: string;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMode, setSelectedMode] = useState<string>("all");

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    setLoading(true);
    try {
      const res = await fetch("/api/payments");
      const json = await res.json();
      if (json.success) {
        setPayments(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = payments.filter((p) => {
    if (selectedMode !== "all" && p.paymentMode !== selectedMode) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.residentName.toLowerCase().includes(term) ||
      (p.reference && p.reference.toLowerCase().includes(term)) ||
      (p.notes && p.notes.toLowerCase().includes(term))
    );
  });

  const totalCollected = payments.reduce((acc, p) => acc + Number(p.amount), 0);

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Payments Ledger
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Immutable ledger of all rent and advance payments received
            </p>
          </div>
          <Link
            href="/payments/record"
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground font-medium text-xs px-3.5 py-2 rounded-md hover:bg-primary/90 transition-colors shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Record Payment</span>
          </Link>
        </div>

        {/* Quick Stats Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground">Total Payments Recorded</div>
            <div className="text-2xl font-bold font-mono text-foreground mt-1">
              {payments.length}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground">Total Revenue Collected</div>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {formatINR(totalCollected)}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground">Payment Modes Tracked</div>
            <div className="text-xs font-medium text-muted-foreground mt-2 flex flex-wrap gap-1.5">
              <span className="bg-muted px-2 py-0.5 rounded">UPI</span>
              <span className="bg-muted px-2 py-0.5 rounded">Cash</span>
              <span className="bg-muted px-2 py-0.5 rounded">Bank Transfer</span>
              <span className="bg-muted px-2 py-0.5 rounded">Cheque</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by resident name, reference number, or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
              className="text-xs bg-card border border-border rounded-md px-3 py-2 text-foreground focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Payment Modes</option>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Payments Table */}
        {loading ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
            Loading payments...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center space-y-3">
            <div className="text-3xl">💳</div>
            <h3 className="font-semibold text-sm text-foreground">No Payments Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchTerm
                ? "No payments match your search criteria."
                : "No payments recorded yet. Click 'Record Payment' to record a rent payment."}
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Receipt #</th>
                    <th className="py-3 px-4">Resident</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4">Reference / Notes</th>
                    <th className="py-3 px-4 text-right">Linked Bill</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        #{p.id}
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/residents/${p.residentId}`}
                          className="font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {p.residentName}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {formatDate(p.paymentDate)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                        +{formatINR(p.amount)}
                      </td>
                      <td className="py-3 px-4 capitalize">
                        <span className="bg-muted px-2 py-0.5 rounded text-[11px] font-medium text-foreground">
                          {p.paymentMode.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground max-w-xs truncate">
                        {p.reference && (
                          <span className="font-mono text-foreground font-medium mr-1.5">
                            {p.reference}
                          </span>
                        )}
                        {p.notes && <span>({p.notes})</span>}
                        {!p.reference && !p.notes && "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {p.billId ? (
                          <Link
                            href={`/billing/${p.billCycleStart}/${p.billId}`}
                            className="text-primary hover:underline font-mono text-[11px]"
                          >
                            Bill #{p.billId}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">
                            Advance / General
                          </span>
                        )}
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
