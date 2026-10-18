"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { 
  Receipt, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ArrowRight, 
  FileText,
  Printer,
  Sparkles
} from "lucide-react";
import { formatCycle, getRecentCycles } from "@/lib/billing-cycle";
import { formatINR } from "@/lib/decimal";

interface BillItem {
  id: number;
  residentId: number;
  residentName: string;
  cycleStartDate: string;
  cycleEndDate: string;
  status: "DRAFT" | "FINALIZED" | "VOID";
  baseRent: string;
  foodCharge: string;
  hasFood: boolean;
  electricityCharge: string;
  otherCharges: string;
  otherCredits: string;
  totalAmount: string;
  finalizedAt: string | null;
}

export default function BillingPage() {
  const recentCycles = getRecentCycles(6);
  const [selectedCycle, setSelectedCycle] = useState(recentCycles[0].cycleStartDate);
  const [bills, setBills] = useState<BillItem[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [missingReadings, setMissingReadings] = useState<string[]>([]);
  const [ratePerUnit, setRatePerUnit] = useState("10.0000");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [finalizingAll, setFinalizingAll] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadBills();
  }, [selectedCycle]);

  async function loadBills() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/billing?cycleStartDate=${selectedCycle}`);
      const json = await res.json();
      if (json.success) {
        setBills(json.bills);
        setPreview(json.preview);
        setMissingReadings(json.missingReadings || []);
        setRatePerUnit(json.ratePerUnit || "10.0000");
      } else {
        setError(json.error || "Failed to load bills");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load bills");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleStartDate: selectedCycle }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to generate bills");
      }
      setMessage(json.message);
      loadBills();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setGenerating(false);
    }
  }

  async function handleFinalizeAll() {
    const draftBills = bills.filter((b) => b.status === "DRAFT");
    if (draftBills.length === 0) return;
    if (!confirm(`Are you sure you want to finalize all ${draftBills.length} draft bills? Once finalized, their numbers and rates are locked permanently.`)) {
      return;
    }

    setFinalizingAll(true);
    try {
      for (const bill of draftBills) {
        await fetch(`/api/billing/${bill.id}/finalize`, { method: "POST" });
      }
      setMessage(`Successfully finalized ${draftBills.length} bills.`);
      loadBills();
    } catch (err: any) {
      setError(err.message || "Failed to finalize bills");
    } finally {
      setFinalizingAll(false);
    }
  }

  const draftCount = bills.filter((b) => b.status === "DRAFT").length;
  const finalizedCount = bills.filter((b) => b.status === "FINALIZED").length;
  const totalBilled = bills
    .filter((b) => b.status !== "VOID")
    .reduce((acc, b) => acc + Number(b.totalAmount), 0);

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Monthly Billing
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Cycle: {formatCycle(selectedCycle)} · Electricity: ₹{Number(ratePerUnit).toFixed(2)}/unit
            </p>
          </div>

          {/* Cycle Selector */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <select
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              className="text-xs bg-card border border-border rounded-md px-3 py-1.5 font-medium text-foreground focus:ring-2 focus:ring-ring"
            >
              {recentCycles.map((c) => (
                <option key={c.cycleStartDate} value={c.cycleStartDate}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Alerts / Notices */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm rounded-md">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {missingReadings.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-400 text-xs rounded-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                <strong>Warning:</strong> {missingReadings.length} submeter(s) have missing readings for this cycle ({missingReadings.slice(0, 4).join(", ")}{missingReadings.length > 4 ? "..." : ""}). Electricity calculations will assume 0 units consumed for missing meters.
              </span>
            </div>
            <Link
              href="/meters"
              className="underline font-semibold shrink-0 ml-2 hover:text-amber-900"
            >
              Enter Readings
            </Link>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground">Total Generated Bills</div>
            <div className="text-2xl font-bold font-mono text-foreground mt-1">
              {bills.length}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground">Draft Bills (Pending)</div>
            <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
              {draftCount}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground">Finalized Bills (Locked)</div>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {finalizedCount}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground">Total Cycle Revenue</div>
            <div className="text-2xl font-bold font-mono text-primary mt-1">
              {formatINR(totalBilled)}
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">
            {bills.length === 0 ? (
              <span>No bills generated yet for this cycle. Click to calculate.</span>
            ) : (
              <span>
                {draftCount > 0
                  ? `${draftCount} draft bill(s) ready to review and finalize.`
                  : "All bills for this cycle are finalized."}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground font-medium text-xs px-4 py-2 rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {generating
                  ? "Calculating..."
                  : bills.length === 0
                  ? "Generate Draft Bills"
                  : "Refresh Draft Bills"}
              </span>
            </button>

            {draftCount > 0 && (
              <button
                onClick={handleFinalizeAll}
                disabled={finalizingAll}
                className="inline-flex items-center gap-1.5 bg-emerald-600 text-white font-medium text-xs px-4 py-2 rounded-md hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{finalizingAll ? "Finalizing..." : `Finalize All (${draftCount})`}</span>
              </button>
            )}
          </div>
        </div>

        {/* Bills Table */}
        {loading ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
            Loading bills for cycle...
          </div>
        ) : bills.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center space-y-3">
            <div className="text-3xl">🧾</div>
            <h3 className="font-semibold text-sm text-foreground">No Bills for this Cycle</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Click &quot;Generate Draft Bills&quot; above to automatically calculate base rent, food choice, and electricity shares for all active residents.
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">Resident</th>
                    <th className="py-3 px-4">Base Rent</th>
                    <th className="py-3 px-4">Food</th>
                    <th className="py-3 px-4">Electricity</th>
                    <th className="py-3 px-4">Adjustments</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bills.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <Link
                          href={`/residents/${b.residentId}`}
                          className="font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {b.residentName}
                        </Link>
                      </td>
                      <td className="py-3 px-4 font-mono">{formatINR(b.baseRent)}</td>
                      <td className="py-3 px-4">
                        {b.hasFood ? (
                          <span className="font-mono text-emerald-600 dark:text-emerald-400">
                            +{formatINR(b.foodCharge)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">No food</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-foreground">
                        {formatINR(b.electricityCharge)}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {Number(b.otherCharges) > 0 && `+${formatINR(b.otherCharges)} `}
                        {Number(b.otherCredits) > 0 && `-${formatINR(b.otherCredits)}`}
                        {Number(b.otherCharges) === 0 && Number(b.otherCredits) === 0 && "—"}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-sm text-foreground">
                        {formatINR(b.totalAmount)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                            b.status === "FINALIZED"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : b.status === "VOID"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/billing/${b.cycleStartDate}/${b.id}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                        >
                          <span>Invoice & Receipt</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
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
