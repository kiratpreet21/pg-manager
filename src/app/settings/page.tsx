"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { 
  Settings, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  History, 
  Download, 
  QrCode, 
  Building,
  Shield,
  Zap
} from "lucide-react";
import { formatDate } from "@/lib/billing-cycle";
import { formatINR } from "@/lib/decimal";

interface AuditRow {
  id: number;
  tableName: string;
  recordId: number | null;
  action: string;
  actor: string;
  payload: any;
  createdAt: string;
}

export default function SettingsPage() {
  const [electricityRate, setElectricityRate] = useState("10.0000");
  const [baseRent, setBaseRent] = useState("5500.00");
  const [foodCharge, setFoodCharge] = useState("2500.00");

  // UPI & PG Details
  const [upiId, setUpiId] = useState("kirattejay@upi");
  const [payeeName, setPayeeName] = useState("Kirat Tejay");
  const [pgName, setPgName] = useState("Girls PG Accommodation");
  const [pgPhone, setPgPhone] = useState("");

  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/config");
      const json = await res.json();
      if (json.success) {
        for (const c of json.configs) {
          if (c.key === "electricity_rate_per_unit") setElectricityRate(c.value);
          if (c.key === "base_rent") setBaseRent(c.value);
          if (c.key === "food_charge") setFoodCharge(c.value);
          if (c.key === "upi_id") setUpiId(c.value);
          if (c.key === "payee_name") setPayeeName(c.value);
          if (c.key === "pg_name") setPgName(c.value);
          if (c.key === "pg_phone") setPgPhone(c.value);
        }
        setAudits(json.audits || []);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          electricityRate: Number(electricityRate),
          baseRent: Number(baseRent),
          foodCharge: Number(foodCharge),
          upiId: upiId.trim(),
          payeeName: payeeName.trim(),
          pgName: pgName.trim(),
          pgPhone: pgPhone.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save settings");
      }

      setSuccessMsg("Settings updated successfully!");
      loadSettings();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadBackup() {
    setDownloadingBackup(true);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error("Failed to download backup");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pg_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || "Backup failed");
    } finally {
      setDownloadingBackup(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Settings className="w-7 h-7 text-primary" />
            <span>Settings & Controls</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Configure rates, UPI credentials for dynamic QR codes, backups, and security audit logs
          </p>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm rounded-md">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: Pricing & Rates */}
          <div className="bg-card border-2 border-border/80 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-extrabold text-foreground border-b border-border pb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Confirmed Monthly Rates & Electricity</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Electricity Rate (₹ / unit)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-muted-foreground text-sm font-bold">₹</span>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    required
                    value={electricityRate}
                    onChange={(e) => setElectricityRate(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 text-sm bg-background border border-border rounded-xl text-foreground font-mono font-bold focus:ring-2 focus:ring-ring"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Confirmed: ₹10.0000 / unit</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Base Rent (₹ / girl / month)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-muted-foreground text-sm font-bold">₹</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={baseRent}
                    onChange={(e) => setBaseRent(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 text-sm bg-background border border-border rounded-xl text-foreground font-mono font-bold focus:ring-2 focus:ring-ring"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Standard charge: ₹5,500.00</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Optional Food Charge (₹ / girl)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-muted-foreground text-sm font-bold">₹</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    value={foodCharge}
                    onChange={(e) => setFoodCharge(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 text-sm bg-background border border-border rounded-xl text-foreground font-mono font-bold focus:ring-2 focus:ring-ring"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">When opted IN: ₹2,500.00</p>
              </div>
            </div>
          </div>

          {/* Section 2: UPI & Property Branding */}
          <div className="bg-card border-2 border-border/80 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-extrabold text-foreground border-b border-border pb-3 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-primary" />
              <span>UPI Payments & Rent Receipt Branding</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Your UPI ID (VPA)
                </label>
                <input
                  type="text"
                  placeholder="e.g. kirattejay21@okaxis or 9876543210@paytm"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl text-foreground font-mono font-medium focus:ring-2 focus:ring-ring"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Used to generate dynamic QR codes on printed receipts and WhatsApp messages
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Payee / Landlord Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kirat Tejay"
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl text-foreground focus:ring-2 focus:ring-ring"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Appears as the authorized signatory on rent receipts
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  PG Property Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Girls PG Accommodation"
                  value={pgName}
                  onChange={(e) => setPgName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl text-foreground focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Contact Phone for Inquiries
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={pgPhone}
                  onChange={(e) => setPgPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl text-foreground font-mono focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground font-bold text-xs px-5 py-2.5 rounded-xl hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "Saving Changes..." : "Save Settings"}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Section 3: One-Click Database Backup */}
        <div className="bg-card border-2 border-border/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" />
                <span>One-Click Full Database Backup</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Download a complete, timestamped JSON snapshot of all 11 tables (residents, readings, bills, payments, deposits)
              </p>
            </div>

            <button
              onClick={handleDownloadBackup}
              disabled={downloadingBackup}
              className="inline-flex items-center gap-2 bg-card border-2 border-border hover:border-emerald-500 hover:bg-emerald-500/5 text-xs font-bold text-foreground px-4 py-2.5 rounded-xl transition-all shadow-2xs shrink-0 disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>{downloadingBackup ? "Exporting Backup..." : "Download Backup (.json)"}</span>
            </button>
          </div>
        </div>

        {/* Section 4: Security Audit Trail */}
        <div className="bg-card border-2 border-border/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-sm font-extrabold text-foreground flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              <span>Security Audit Trail (Last 30 Events)</span>
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">
              Append-Only Log
            </span>
          </div>

          {audits.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-4">No audit events recorded yet.</p>
          ) : (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground font-extrabold text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Table</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Actor</th>
                    <th className="py-2.5 px-3">Payload Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono text-[11px]">
                  {audits.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/30">
                      <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                        {formatDate(a.createdAt)}
                      </td>
                      <td className="py-2.5 px-3 text-foreground font-bold">
                        {a.tableName}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            a.action === "FINALIZE"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                              : a.action === "VOID"
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                              : a.action === "INSERT"
                              ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {a.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[120px]">
                        {a.actor}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground truncate max-w-xs font-sans text-xs">
                        {a.payload ? JSON.stringify(a.payload) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
