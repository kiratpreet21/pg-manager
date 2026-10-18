"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ArrowLeft, CreditCard, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { formatINR } from "@/lib/decimal";

export default function RecordPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialResidentId = searchParams.get("residentId") || "";

  const [residents, setResidents] = useState<any[]>([]);
  const [selectedResidentId, setSelectedResidentId] = useState(initialResidentId);
  const [selectedResidentDetail, setSelectedResidentDetail] = useState<any>(null);

  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentMode, setPaymentMode] = useState("upi");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [billId, setBillId] = useState("");

  const [loadingResidents, setLoadingResidents] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadResidents() {
      try {
        const res = await fetch("/api/residents");
        const json = await res.json();
        if (json.success) {
          setResidents(json.data);
          if (!selectedResidentId && json.data.length > 0) {
            setSelectedResidentId(String(json.data[0].id));
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingResidents(false);
      }
    }
    loadResidents();
  }, []);

  useEffect(() => {
    if (!selectedResidentId) {
      setSelectedResidentDetail(null);
      return;
    }
    async function loadResidentInfo() {
      try {
        const res = await fetch(`/api/residents/${selectedResidentId}`);
        const json = await res.json();
        if (json.success) {
          setSelectedResidentDetail(json.data);
          // If resident has an outstanding balance > 0, prefill amount with outstanding
          if (Number(json.data.outstanding) > 0 && !amount) {
            setAmount(json.data.outstanding);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadResidentInfo();
  }, [selectedResidentId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!selectedResidentId) {
      setError("Please select a resident.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError("Please enter a valid payment amount greater than zero.");
      return;
    }
    if (!paymentDate) {
      setError("Please enter payment date.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          residentId: Number(selectedResidentId),
          billId: billId ? Number(billId) : null,
          amount: Number(amount),
          paymentDate,
          paymentMode,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to record payment");
      }

      router.push(`/residents/${selectedResidentId}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-xl mx-auto space-y-6">
        <Link
          href="/payments"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Payments</span>
        </Link>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Record Rent Payment
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Record a rent or advance payment received from a resident
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-5">
          {/* Resident Select */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Select Resident <span className="text-destructive">*</span>
            </label>
            {loadingResidents ? (
              <div className="text-xs text-muted-foreground py-2">Loading residents...</div>
            ) : (
              <select
                required
                value={selectedResidentId}
                onChange={(e) => setSelectedResidentId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:ring-2 focus:ring-ring"
              >
                {residents.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.roomName ? `(${r.roomName})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Live Outstanding Preview */}
          {selectedResidentDetail && (
            <div className="bg-muted/40 p-3 rounded-lg text-xs flex items-center justify-between">
              <div>
                <span className="text-muted-foreground">Current Outstanding Balance:</span>
                <div
                  className={`font-mono font-bold text-base ${
                    Number(selectedResidentDetail.outstanding) > 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {formatINR(selectedResidentDetail.outstanding)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAmount(selectedResidentDetail.outstanding)}
                className="text-[11px] text-primary hover:underline font-medium"
              >
                Set full amount
              </button>
            </div>
          )}

          {/* Amount and Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Payment Amount (₹) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                step="1"
                min="1"
                required
                placeholder="e.g. 8000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground font-mono focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Payment Date <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Mode and Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Payment Mode <span className="text-destructive">*</span>
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:ring-2 focus:ring-ring"
              >
                <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Reference / Transaction ID
              </label>
              <input
                type="text"
                placeholder="e.g. UPI Ref 987654321"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Paid in advance for next cycle"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/payments"
              className="px-4 py-2 border border-border rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary text-primary-foreground text-xs font-medium px-5 py-2 rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
