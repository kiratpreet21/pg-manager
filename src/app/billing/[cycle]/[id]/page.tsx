"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { 
  ArrowLeft, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  Ban, 
  Gauge, 
  Save,
  QrCode,
  Share2
} from "lucide-react";
import { formatCycle, formatDate } from "@/lib/billing-cycle";
import { formatINR } from "@/lib/decimal";
import { 
  buildUpiUri, 
  getUpiQrCodeUrl, 
  formatWhatsAppBillMessage, 
  getWhatsAppShareUrl 
} from "@/lib/upi";

export default function BillDetailPage() {
  const params = useParams();
  const router = useRouter();
  const billId = params.id as string;

  const [bill, setBill] = useState<any>(null);
  const [configSettings, setConfigSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Adjustment states for draft bills
  const [otherCharges, setOtherCharges] = useState("0.00");
  const [otherCredits, setOtherCredits] = useState("0.00");
  const [otherNotes, setOtherNotes] = useState("");
  const [savingAdjustments, setSavingAdjustments] = useState(false);

  // Finalize / Void states
  const [finalizing, setFinalizing] = useState(false);
  const [voiding, setVoiding] = useState(false);

  useEffect(() => {
    loadBillAndConfig();
  }, [billId]);

  async function loadBillAndConfig() {
    setLoading(true);
    try {
      const [billRes, configRes] = await Promise.all([
        fetch(`/api/billing/${billId}`),
        fetch("/api/config"),
      ]);

      const billJson = await billRes.json();
      const configJson = await configRes.json();

      if (billJson.success) {
        setBill(billJson.data);
        setOtherCharges(billJson.data.otherCharges || "0.00");
        setOtherCredits(billJson.data.otherCredits || "0.00");
        setOtherNotes(billJson.data.otherNotes || "");
      } else {
        setError(billJson.error || "Failed to load bill");
      }

      if (configJson.success && Array.isArray(configJson.configs)) {
        const configMap: Record<string, string> = {};
        for (const c of configJson.configs) {
          configMap[c.key] = c.value;
        }
        setConfigSettings(configMap);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load bill");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAdjustments(e: React.FormEvent) {
    e.preventDefault();
    if (bill?.status === "FINALIZED") return;
    setSavingAdjustments(true);
    try {
      const res = await fetch(`/api/billing/${billId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otherCharges: Number(otherCharges) || 0,
          otherCredits: Number(otherCredits) || 0,
          otherNotes,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      loadBillAndConfig();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingAdjustments(false);
    }
  }

  async function handleFinalize() {
    if (!confirm("Are you sure you want to finalize this bill? Once finalized, the calculations, readings, and rates are permanently locked.")) {
      return;
    }
    setFinalizing(true);
    try {
      const res = await fetch(`/api/billing/${billId}/finalize`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      loadBillAndConfig();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setFinalizing(false);
    }
  }

  async function handleVoid() {
    const reason = prompt("Enter a reason for voiding this bill:");
    if (!reason) return;
    setVoiding(true);
    try {
      const res = await fetch(`/api/billing/${billId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      loadBillAndConfig();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setVoiding(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="p-12 text-center text-sm text-muted-foreground">Loading bill details...</div>
      </AppShell>
    );
  }

  if (error || !bill) {
    return (
      <AppShell>
        <div className="p-12 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <div className="text-sm font-medium text-destructive">{error || "Bill not found"}</div>
          <Link href="/billing" className="text-xs text-primary underline">Back to Billing</Link>
        </div>
      </AppShell>
    );
  }

  const isFinalized = bill.status === "FINALIZED";
  const isVoid = bill.status === "VOID";

  const upiId = configSettings.upi_id || "kirattejay@upi";
  const payeeName = configSettings.payee_name || "Kirat Tejay";
  const pgName = configSettings.pg_name || "Girls PG Accommodation";

  // Build UPI URI & QR Code
  const upiUri = buildUpiUri({
    upiId,
    payeeName,
    amount: bill.totalAmount,
    transactionNote: `PG Rent Bill #${bill.id}`,
  });
  const upiQrCodeUrl = getUpiQrCodeUrl(upiUri, 180);

  // Build WhatsApp Share URL
  const whatsAppMessage = formatWhatsAppBillMessage({
    residentName: bill.resident.name,
    cycleText: formatCycle(bill.cycleStartDate),
    baseRent: bill.baseRent,
    foodCharge: bill.foodCharge,
    hasFood: bill.hasFood,
    electricityCharge: bill.electricityCharge,
    totalAmount: bill.totalAmount,
    upiId,
    payeeName,
    lineItems: bill.lineItems,
  });
  const whatsAppShareUrl = getWhatsAppShareUrl(bill.resident.phone, whatsAppMessage);

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
          <Link
            href="/billing"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Billing</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {/* WhatsApp Share Button */}
            <a
              href={whatsAppShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 text-xs font-bold bg-[#25D366] text-white rounded-lg hover:bg-[#20ba59] transition-all flex items-center gap-1.5 shadow-sm"
              title="Share bill details on WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Send via WhatsApp</span>
            </a>

            <button
              onClick={() => window.print()}
              className="px-3.5 py-1.5 text-xs font-bold border border-border rounded-lg bg-card hover:bg-muted text-foreground transition-all flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 text-primary" />
              <span>Print / Save PDF</span>
            </button>

            {!isFinalized && !isVoid && (
              <button
                onClick={handleFinalize}
                disabled={finalizing}
                className="px-3.5 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{finalizing ? "Finalizing..." : "Finalize & Lock"}</span>
              </button>
            )}

            {!isVoid && (
              <button
                onClick={handleVoid}
                disabled={voiding}
                className="px-3 py-1.5 text-xs font-bold border border-destructive/30 text-destructive rounded-lg hover:bg-destructive/10 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Void</span>
              </button>
            )}
          </div>
        </div>

        {/* Printable Invoice / Receipt Container */}
        <div className="bg-card border-2 border-border/80 rounded-2xl p-6 sm:p-8 shadow-sm print:border-none print:shadow-none print:p-0 space-y-6">
          {/* Header */}
          <div className="border-b-2 border-border pb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-3xl">🏠</span>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-foreground">{pgName}</h1>
                  <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                    Monthly Rent & Electricity Invoice Receipt
                  </p>
                </div>
              </div>
            </div>

            <div className="sm:text-right space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-muted text-foreground border border-border">
                {isFinalized && <Lock className="w-3 h-3 text-emerald-600" />}
                {bill.status} INVOICE #{bill.id}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                Date: {isFinalized && bill.finalizedAt ? formatDate(bill.finalizedAt) : formatDate(bill.createdAt)}
              </div>
            </div>
          </div>

          {/* Resident & Billing Period info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-muted/40 p-4 rounded-xl border border-border/60">
            <div>
              <span className="text-muted-foreground uppercase tracking-wider font-extrabold text-[10px]">
                Billed To (Resident)
              </span>
              <div className="font-extrabold text-base text-foreground mt-0.5">
                {bill.resident.name}
              </div>
              <div className="text-muted-foreground font-mono mt-0.5">
                Phone: {bill.resident.phone || "Not recorded"}
              </div>
            </div>

            <div className="sm:text-right">
              <span className="text-muted-foreground uppercase tracking-wider font-extrabold text-[10px]">
                Billing Cycle
              </span>
              <div className="font-extrabold text-sm text-foreground mt-0.5 font-mono">
                {formatCycle(bill.cycleStartDate)}
              </div>
              <div className="text-muted-foreground text-[11px] font-mono mt-0.5">
                Rate: ₹10.00 / electricity unit
              </div>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="border-2 border-border rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/70 border-b-2 border-border text-muted-foreground font-extrabold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Item Description</th>
                  <th className="py-3 px-4 text-right">Calculation Rule</th>
                  <th className="py-3 px-4 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* Base Rent */}
                <tr>
                  <td className="py-3 px-4">
                    <div className="font-extrabold text-foreground text-sm">Base Monthly Room Rent</div>
                    <div className="text-[11px] text-muted-foreground">Standard room accommodation</div>
                  </td>
                  <td className="py-3 px-4 text-right text-muted-foreground">Fixed charge</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-sm text-foreground">
                    {formatINR(bill.baseRent)}
                  </td>
                </tr>

                {/* Food Charge */}
                <tr>
                  <td className="py-3 px-4">
                    <div className="font-extrabold text-foreground text-sm">Monthly Food Plan</div>
                    <div className="text-[11px] text-muted-foreground">
                      {bill.hasFood ? "Opted IN for daily meals" : "Opted OUT of food plan"}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right text-muted-foreground">
                    {bill.hasFood ? "₹2,500.00 / month" : "No food charge applied"}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-sm text-foreground">
                    {formatINR(bill.foodCharge)}
                  </td>
                </tr>

                {/* Electricity Section Header */}
                <tr className="bg-muted/40 font-extrabold text-[11px] text-foreground">
                  <td colSpan={3} className="py-2.5 px-4 uppercase tracking-wider">
                    ⚡ Electricity Submeters Breakdown (Rate: ₹10.00 / unit)
                  </td>
                </tr>

                {/* Electricity Line Items */}
                {bill.lineItems.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-2.5 px-4 text-muted-foreground italic">
                      No electricity submeter records for this cycle.
                    </td>
                  </tr>
                ) : (
                  bill.lineItems.map((li: any) => (
                    <tr key={li.id}>
                      <td className="py-3 px-4 pl-6">
                        <div className="font-bold text-foreground flex items-center gap-2">
                          <span className="font-mono bg-muted px-2 py-0.5 rounded text-[10px] font-extrabold border border-border">
                            {li.meterCode}
                          </span>
                          <span>
                            {li.meterType === "kitchen" ? "Portion Kitchen Submeter" : "Room Submeter"}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                          Readings: {li.openingReading} → {li.closingReading} = {li.unitsConsumed} units consumed
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                        {formatINR(li.totalMeterCost)} ÷ {li.eligibleResidents} girl{li.eligibleResidents > 1 ? "s" : ""}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                        {formatINR(li.residentShare)}
                      </td>
                    </tr>
                  ))
                )}

                {/* Adjustments (if any) */}
                {Number(bill.otherCharges) > 0 && (
                  <tr>
                    <td className="py-3 px-4">
                      <div className="font-bold text-foreground">Additional Charges</div>
                      {bill.otherNotes && (
                        <div className="text-[11px] text-muted-foreground">{bill.otherNotes}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-muted-foreground">One-time addition</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                      +{formatINR(bill.otherCharges)}
                    </td>
                  </tr>
                )}

                {Number(bill.otherCredits) > 0 && (
                  <tr>
                    <td className="py-3 px-4">
                      <div className="font-bold text-foreground">Credits / Advance Adjustment</div>
                      {bill.otherNotes && (
                        <div className="text-[11px] text-muted-foreground">{bill.otherNotes}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-muted-foreground">Advance credit applied</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                      -{formatINR(bill.otherCredits)}
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Total Footer */}
              <tfoot className="bg-muted/60 border-t-2 border-border font-extrabold">
                <tr>
                  <td colSpan={2} className="py-3.5 px-4 text-sm text-foreground uppercase tracking-wider">
                    Total Amount Due for Cycle
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-lg text-primary">
                    {formatINR(bill.totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Dynamic UPI Payment QR Code Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-primary/5 via-indigo-500/5 to-purple-500/5 border-2 border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1.5 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-extrabold uppercase">
                <QrCode className="w-3.5 h-3.5" />
                <span>Instant UPI Payment</span>
              </div>
              <h3 className="font-extrabold text-sm text-foreground">
                Scan with any UPI App (GPay / PhonePe / Paytm / BHIM)
              </h3>
              <p className="text-xs text-muted-foreground">
                The exact amount of <strong className="text-foreground font-mono">{formatINR(bill.totalAmount)}</strong> will be automatically pre-filled.
              </p>
              <div className="text-xs font-mono font-bold text-foreground pt-1">
                UPI ID: <span className="bg-background px-2 py-1 rounded border border-border">{upiId}</span>
              </div>
            </div>

            {/* Scannable Dynamic QR Code */}
            <div className="shrink-0 bg-white p-2.5 rounded-xl border-2 border-border shadow-xs text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={upiQrCodeUrl}
                alt="UPI Payment QR Code"
                className="w-32 h-32 mx-auto"
              />
              <span className="text-[10px] font-bold text-slate-700 block mt-1">
                Scan & Pay {formatINR(bill.totalAmount)}
              </span>
            </div>
          </div>

          {/* Signature & Verification Footer */}
          <div className="pt-4 border-t-2 border-border flex flex-col sm:flex-row justify-between text-xs text-muted-foreground gap-4">
            <div>
              <p className="font-bold text-foreground">Payment Instructions:</p>
              <p className="mt-0.5">Please share the UPI reference number or screenshot once paid.</p>
              <p className="text-[10px] mt-1">Generated electronically by PG Manager System.</p>
            </div>
            <div className="sm:text-right">
              <p className="font-bold text-foreground">Authorized Signature</p>
              <div className="h-10"></div>
              <p className="text-[11px] font-medium text-foreground">{payeeName} (Landlord)</p>
            </div>
          </div>
        </div>

        {/* Adjustments Editor for DRAFT bills (Hidden in print) */}
        {!isFinalized && !isVoid && (
          <div className="bg-card border-2 border-border rounded-2xl p-5 shadow-sm space-y-4 print:hidden">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Adjust Draft Bill (One-time charges or credits)
            </h3>
            <form onSubmit={handleSaveAdjustments} className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Extra Charges (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={otherCharges}
                  onChange={(e) => setOtherCharges(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground font-mono focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Credits / Deductions (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={otherCredits}
                  onChange={(e) => setOtherCredits(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground font-mono focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Adjustment Reason / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. advance adjustment"
                  value={otherNotes}
                  onChange={(e) => setOtherNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="sm:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={savingAdjustments}
                  className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground font-bold text-xs px-5 py-2 rounded-xl hover:bg-primary/90 transition-all shadow-xs disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingAdjustments ? "Saving..." : "Update Adjustments"}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AppShell>
  );
}
