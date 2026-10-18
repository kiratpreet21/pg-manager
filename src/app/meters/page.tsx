"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { 
  Gauge, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  HelpCircle,
  Zap
} from "lucide-react";
import { formatCycle, getRecentCycles, formatDate } from "@/lib/billing-cycle";
import { formatINR } from "@/lib/decimal";
import { format } from "date-fns";

interface MeterRow {
  meterId: number;
  meterCode: string;
  meterType: "room" | "kitchen";
  roomId: number | null;
  roomName: string | null;
  roomIsActive: boolean;
  portionId: number;
  portionName: string;
  openingReading: string;
  closingReading: string;
  isAutoFilledOpening: boolean;
  unitsConsumed: string;
  totalCost: string;
  isSaved: boolean;
}

export default function MeterReadingsPage() {
  const recentCycles = getRecentCycles(6);
  const [selectedCycle, setSelectedCycle] = useState(recentCycles[0].cycleStartDate);
  const [readings, setReadings] = useState<MeterRow[]>([]);
  const [ratePerUnit, setRatePerUnit] = useState("10.0000");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadReadings();
  }, [selectedCycle]);

  async function loadReadings() {
    setLoading(true);
    setSaveSuccess(false);
    setError("");
    try {
      const res = await fetch(`/api/meters/readings?cycleStartDate=${selectedCycle}`);
      const json = await res.json();
      if (json.success) {
        setReadings(json.data);
        setRatePerUnit(json.ratePerUnit);
      } else {
        setError(json.error || "Failed to load readings");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load readings");
    } finally {
      setLoading(false);
    }
  }

  function handleReadingChange(
    meterId: number,
    field: "openingReading" | "closingReading",
    val: string
  ) {
    setReadings((prev) =>
      prev.map((m) => {
        if (m.meterId !== meterId) return m;

        const updated = { ...m, [field]: val };
        const openNum = parseFloat(updated.openingReading);
        const closeNum = parseFloat(updated.closingReading);

        if (!isNaN(openNum) && !isNaN(closeNum) && closeNum >= openNum) {
          const units = (closeNum - openNum).toFixed(2);
          const cost = (parseFloat(units) * parseFloat(ratePerUnit)).toFixed(2);
          updated.unitsConsumed = units;
          updated.totalCost = cost;
        } else {
          updated.unitsConsumed = "0.00";
          updated.totalCost = "0.00";
        }
        return updated;
      })
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaveSuccess(false);

    try {
      const payload = readings.map((r) => ({
        meterId: r.meterId,
        meterCode: r.meterCode,
        openingReading: r.openingReading,
        closingReading: r.closingReading,
      }));

      const res = await fetch("/api/meters/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycleStartDate: selectedCycle,
          readings: payload,
          readAt: format(new Date(), "yyyy-MM-dd"),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save readings");
      }

      setSaveSuccess(true);
      loadReadings();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  }

  // Calculate totals
  const totalUnits = readings.reduce(
    (acc, r) => acc + parseFloat(r.unitsConsumed || "0"),
    0
  );
  const totalCost = readings.reduce(
    (acc, r) => acc + parseFloat(r.totalCost || "0"),
    0
  );

  // Group readings by portion
  const portionNames = ["Portion A", "Portion B", "Portion C", "Portion D"];

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Meter Readings
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              12 submeters (8 room + 4 kitchen) · Rate: {formatINR(ratePerUnit)}/unit
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

        {/* Status / Alert Messages */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm rounded-md">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>All 12 meter readings saved successfully!</span>
          </div>
        )}

        {/* Informational Banner */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-foreground flex items-start gap-2">
          <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <strong>Billing Cycle: {formatCycle(selectedCycle)}</strong>
            <p className="text-muted-foreground mt-0.5">
              Cumulative submeters do not reset. Opening readings are automatically prefilled from the previous cycle's closing reading. Closed or unoccupied rooms will register zero consumption.
            </p>
          </div>
        </div>

        {/* Quick Total Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground">Total Units Consumed</div>
            <div className="text-2xl font-bold font-mono text-foreground mt-1">
              {totalUnits.toFixed(2)} <span className="text-xs font-normal">units</span>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground">Total Electricity Bill</div>
            <div className="text-2xl font-bold font-mono text-primary mt-1">
              {formatINR(totalCost.toFixed(2))}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground">Configured Unit Rate</div>
            <div className="text-2xl font-bold font-mono text-foreground mt-1">
              ₹{Number(ratePerUnit).toFixed(2)} <span className="text-xs font-normal">/ unit</span>
            </div>
          </div>
        </div>

        {/* Form to submit all 12 meters */}
        <form onSubmit={handleSave} className="space-y-6">
          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground bg-card border border-border rounded-lg">
              Loading meter data for cycle...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {portionNames.map((portionName) => {
                const portionMeters = readings.filter(
                  (r) => r.portionName === portionName
                );

                return (
                  <div
                    key={portionName}
                    className="bg-card border border-border rounded-xl shadow-sm overflow-hidden"
                  >
                    <div className="bg-muted/40 border-b border-border px-4 py-3 flex items-center justify-between">
                      <h2 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                        <Gauge className="w-4 h-4 text-primary" />
                        {portionName}
                      </h2>
                      <span className="text-xs text-muted-foreground">
                        3 submeters (2 room + 1 kitchen)
                      </span>
                    </div>

                    <div className="divide-y divide-border">
                      {portionMeters.map((m) => {
                        const isClosingInvalid =
                          m.openingReading !== "" &&
                          m.closingReading !== "" &&
                          Number(m.closingReading) < Number(m.openingReading);

                        return (
                          <div key={m.meterId} className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs bg-muted text-foreground px-2 py-0.5 rounded">
                                  {m.meterCode}
                                </span>
                                <span className="text-xs font-medium text-foreground">
                                  {m.meterType === "kitchen"
                                    ? "Kitchen Submeter"
                                    : `${m.roomName} Submeter`}
                                </span>
                                {!m.roomIsActive && m.meterType === "room" && (
                                  <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                                    Room Closed
                                  </span>
                                )}
                              </div>
                              {m.isSaved && (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Saved
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                              {/* Opening Reading */}
                              <div>
                                <label className="block text-[11px] text-muted-foreground mb-1">
                                  Opening Reading
                                  {m.isAutoFilledOpening && (
                                    <span className="text-primary ml-1" title="Prefilled from last cycle's closing reading">
                                      (Auto)
                                    </span>
                                  )}
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  value={m.openingReading}
                                  onChange={(e) =>
                                    handleReadingChange(
                                      m.meterId,
                                      "openingReading",
                                      e.target.value
                                    )
                                  }
                                  className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-md text-foreground font-mono focus:ring-2 focus:ring-ring"
                                />
                              </div>

                              {/* Closing Reading */}
                              <div>
                                <label className="block text-[11px] text-muted-foreground mb-1">
                                  Closing Reading
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  value={m.closingReading}
                                  onChange={(e) =>
                                    handleReadingChange(
                                      m.meterId,
                                      "closingReading",
                                      e.target.value
                                    )
                                  }
                                  className={`w-full px-2.5 py-1.5 text-xs bg-background border rounded-md text-foreground font-mono focus:ring-2 focus:ring-ring ${
                                    isClosingInvalid
                                      ? "border-destructive text-destructive"
                                      : "border-border"
                                  }`}
                                />
                              </div>

                              {/* Units Consumed */}
                              <div>
                                <span className="block text-[11px] text-muted-foreground mb-1">
                                  Consumed Units
                                </span>
                                <div className="font-mono font-semibold text-xs py-1.5 text-foreground">
                                  {m.unitsConsumed}
                                </div>
                              </div>

                              {/* Calculated Cost */}
                              <div>
                                <span className="block text-[11px] text-muted-foreground mb-1">
                                  Meter Cost
                                </span>
                                <div className="font-mono font-bold text-xs py-1.5 text-primary">
                                  {formatINR(m.totalCost)}
                                </div>
                              </div>
                            </div>

                            {isClosingInvalid && (
                              <p className="text-[11px] text-destructive">
                                ⚠️ Closing reading cannot be less than opening reading.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-between bg-card border border-border rounded-lg p-4 shadow-sm sticky bottom-4 z-20">
            <div className="text-xs text-muted-foreground">
              Total for this cycle:{" "}
              <strong className="text-foreground font-mono">
                {totalUnits.toFixed(2)} units
              </strong>{" "}
              ={" "}
              <strong className="text-primary font-mono font-bold">
                {formatINR(totalCost.toFixed(2))}
              </strong>
            </div>

            <button
              type="submit"
              disabled={saving || loading}
              className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground font-medium text-xs px-5 py-2.5 rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? "Saving Readings..." : "Save All 12 Readings"}</span>
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
