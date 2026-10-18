"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { 
  ArrowLeft, 
  DoorClosed, 
  Phone, 
  Mail, 
  ShieldCheck, 
  CreditCard, 
  Receipt, 
  UserMinus, 
  RefreshCw, 
  AlertCircle,
  CheckCircle2,
  Calendar,
  Utensils
} from "lucide-react";
import { formatCycle, formatDate, getCurrentCycleStart } from "@/lib/billing-cycle";
import { formatINR } from "@/lib/decimal";
import { format } from "date-fns";

export default function ResidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const residentId = params.id as string;

  const [resident, setResident] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals
  const [showRoomChangeModal, setShowRoomChangeModal] = useState(false);
  const [showMoveOutModal, setShowMoveOutModal] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);

  // Room change state
  const [newRoomId, setNewRoomId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [roomChangeSubmitting, setRoomChangeSubmitting] = useState(false);

  // Move out state
  const [moveOutDate, setMoveOutDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMode, setRefundMode] = useState("upi");
  const [refundRef, setRefundRef] = useState("");
  const [refundNotes, setRefundNotes] = useState("");
  const [moveOutSubmitting, setMoveOutSubmitting] = useState(false);

  // Food toggle state
  const [updatingFood, setUpdatingFood] = useState(false);

  useEffect(() => {
    loadResident();
  }, [residentId]);

  async function loadResident() {
    setLoading(true);
    try {
      const res = await fetch(`/api/residents/${residentId}`);
      const json = await res.json();
      if (json.success) {
        setResident(json.data);
        if (json.data.securityDeposit) {
          const held = Number(json.data.securityDeposit.amountPaid) - Number(json.data.securityDeposit.amountRefunded);
          setRefundAmount(String(Math.max(0, held)));
        }
      } else {
        setError(json.error || "Failed to load resident");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load resident");
    } finally {
      setLoading(false);
    }
  }

  async function openRoomChange() {
    try {
      const res = await fetch("/api/rooms");
      const json = await res.json();
      if (json.success) {
        const flat: any[] = [];
        for (const p of json.data) {
          for (const r of p.rooms) {
            if (r.isActive && r.availableSlots > 0 && r.id !== resident?.currentOccupancy?.roomId) {
              flat.push({ ...r, portionName: p.name });
            }
          }
        }
        setAvailableRooms(flat);
        if (flat.length > 0) setNewRoomId(String(flat[0].id));
      }
    } catch (err) {
      console.error(err);
    }
    setShowRoomChangeModal(true);
  }

  async function handleRoomChange(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoomId) return;
    setRoomChangeSubmitting(true);
    try {
      const res = await fetch(`/api/residents/${residentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_room",
          newRoomId: Number(newRoomId),
          effectiveDate,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Room change failed");
      setShowRoomChangeModal(false);
      loadResident();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRoomChangeSubmitting(false);
    }
  }

  async function handleMoveOut(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm("Are you sure you want to mark this resident as moved out?")) return;
    setMoveOutSubmitting(true);
    try {
      const res = await fetch(`/api/residents/${residentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move_out",
          moveOutDate,
          refundAmount: refundAmount ? Number(refundAmount) : 0,
          refundMode,
          refundReference: refundRef,
          refundNotes,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Move-out failed");
      setShowMoveOutModal(false);
      loadResident();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setMoveOutSubmitting(false);
    }
  }

  async function toggleFood(newStatus: boolean) {
    setUpdatingFood(true);
    try {
      const currentCycle = getCurrentCycleStart();
      const cycleDateStr = format(currentCycle, "yyyy-MM-dd");
      const res = await fetch(`/api/residents/${residentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_food",
          cycleStartDate: cycleDateStr,
          hasFood: newStatus,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);
      loadResident();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingFood(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="p-12 text-center text-sm text-muted-foreground">Loading resident profile...</div>
      </AppShell>
    );
  }

  if (error || !resident) {
    return (
      <AppShell>
        <div className="p-12 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <div className="text-sm font-medium text-destructive">{error || "Resident not found"}</div>
          <Link href="/residents" className="text-xs text-primary underline">
            Back to Residents
          </Link>
        </div>
      </AppShell>
    );
  }

  const currentCycle = getCurrentCycleStart();
  const cycleDateStr = format(currentCycle, "yyyy-MM-dd");
  const currentFoodPref = resident.foodPreferences?.find(
    (f: any) => f.cycleStartDate === cycleDateStr
  );
  const hasFoodCurrent = currentFoodPref ? currentFoodPref.hasFood : true;

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Top bar with back button & status */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Link
            href="/residents"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Residents</span>
          </Link>

          <div className="flex items-center gap-2">
            {resident.isActive ? (
              <>
                <button
                  onClick={openRoomChange}
                  className="px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-muted text-foreground transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Change Room</span>
                </button>
                <button
                  onClick={() => setShowMoveOutModal(true)}
                  className="px-3 py-1.5 text-xs font-medium border border-destructive/30 text-destructive rounded-md hover:bg-destructive/10 transition-colors flex items-center gap-1.5"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                  <span>Move Out</span>
                </button>
              </>
            ) : (
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded font-medium">
                Resident has moved out
              </span>
            )}
          </div>
        </div>

        {/* Profile Card Header */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl">
                {resident.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">{resident.name}</h1>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                      resident.isActive
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {resident.isActive ? "Active" : "Moved Out"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Enrolled on {formatDate(resident.createdAt)}
                </p>
              </div>
            </div>

            {/* Outstanding Balance Banner */}
            <div className="bg-muted/50 border border-border rounded-lg p-3 text-right min-w-[200px]">
              <div className="text-[11px] text-muted-foreground">Outstanding Balance</div>
              <div
                className={`text-xl font-bold font-mono ${
                  Number(resident.outstanding) > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : Number(resident.outstanding) < 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-foreground"
                }`}
              >
                {formatINR(resident.outstanding)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {Number(resident.outstanding) > 0
                  ? "Payment due"
                  : Number(resident.outstanding) < 0
                  ? "Advance credit"
                  : "All settled"}
              </div>
            </div>
          </div>
        </div>

        {/* Grid of Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1 & 2: Room Info + Personal Info */}
          <div className="md:col-span-2 space-y-6">
            {/* Room & Occupancy */}
            <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b border-border pb-2">
                <DoorClosed className="w-4 h-4 text-primary" />
                Current Room & Portion
              </h2>
              {resident.currentOccupancy ? (
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">Room:</span>
                    <p className="font-semibold text-foreground text-sm mt-0.5">
                      {resident.currentOccupancy.roomName}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Portion:</span>
                    <p className="font-semibold text-foreground text-sm mt-0.5">
                      {resident.currentOccupancy.portionName}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Moved In:</span>
                    <p className="font-medium text-foreground mt-0.5">
                      {formatDate(resident.currentOccupancy.moveInDate)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Roommates:</span>
                    <p className="font-medium text-foreground mt-0.5">
                      {resident.roommates.length === 0 ? (
                        <span className="text-muted-foreground italic">Single occupant</span>
                      ) : (
                        resident.roommates.map((rm: any) => (
                          <Link
                            key={rm.id}
                            href={`/residents/${rm.id}`}
                            className="text-primary hover:underline font-semibold block"
                          >
                            {rm.name}
                          </Link>
                        ))
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No active room assignment.</p>
              )}
            </div>

            {/* Current Food Selection */}
            <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b border-border pb-2">
                <Utensils className="w-4 h-4 text-primary" />
                Food Preference (Current Cycle)
              </h2>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {hasFoodCurrent ? "With Food (₹8,000/mo)" : "Without Food (₹5,500/mo)"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {hasFoodCurrent
                      ? "Base Rent ₹5,500 + Food ₹2,500"
                      : "Base Rent ₹5,500 only"}
                  </p>
                </div>
                {resident.isActive && (
                  <button
                    onClick={() => toggleFood(!hasFoodCurrent)}
                    disabled={updatingFood}
                    className="text-xs border border-border px-3 py-1.5 rounded-md hover:bg-muted font-medium transition-colors"
                  >
                    {updatingFood ? "Updating..." : `Switch to ${hasFoodCurrent ? "Without Food" : "With Food"}`}
                  </button>
                )}
              </div>
            </div>

            {/* Contact & Personal Details */}
            <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b border-border pb-2">
                Contact & Verification
              </h2>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Phone:</span>
                  <p className="font-mono text-foreground font-medium mt-0.5">
                    {resident.phone || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <p className="text-foreground font-medium mt-0.5">
                    {resident.email || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">ID Type & Number:</span>
                  <p className="font-mono text-foreground font-medium mt-0.5">
                    {resident.idType ? resident.idType.toUpperCase() : "ID"}:{" "}
                    {resident.idNumber || "Not recorded"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Emergency Contact:</span>
                  <p className="text-foreground font-medium mt-0.5">
                    {resident.emergencyContactName ? (
                      <>
                        {resident.emergencyContactName}{" "}
                        <span className="font-mono text-muted-foreground">
                          ({resident.emergencyContactPhone || "No phone"})
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
                {resident.notes && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Notes:</span>
                    <p className="text-foreground mt-0.5 bg-muted/40 p-2 rounded">
                      {resident.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Bills Section */}
            <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-primary" />
                  Monthly Bills
                </h2>
                <Link
                  href="/billing"
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Go to Billing
                </Link>
              </div>

              {resident.bills.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-3">
                  No bills generated yet for this resident.
                </p>
              ) : (
                <div className="divide-y divide-border text-xs">
                  {resident.bills.map((b: any) => (
                    <div key={b.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-foreground">
                          {formatCycle(b.cycleStartDate)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Rent: {formatINR(b.baseRent)} · Food: {formatINR(b.foodCharge)} · Elec: {formatINR(b.electricityCharge)}
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <div className="font-mono font-bold text-foreground">
                            {formatINR(b.totalAmount)}
                          </div>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              b.status === "FINALIZED"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : b.status === "VOID"
                                ? "bg-rose-500/10 text-rose-600"
                                : "bg-amber-500/10 text-amber-600"
                            }`}
                          >
                            {b.status}
                          </span>
                        </div>
                        <Link
                          href={`/billing/${b.cycleStartDate}/${b.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Security Deposit & Payments Ledger */}
          <div className="space-y-6">
            {/* Security Deposit Card */}
            <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b border-border pb-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Security Deposit
              </h2>

              {resident.securityDeposit ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paid:</span>
                    <span className="font-mono font-bold text-foreground">
                      {formatINR(resident.securityDeposit.amountPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Refunded:</span>
                    <span className="font-mono text-muted-foreground">
                      {formatINR(resident.securityDeposit.amountRefunded)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-border">
                    <span className="font-medium text-foreground">Currently Held:</span>
                    <span className="font-mono font-bold text-primary">
                      {formatINR(
                        Number(resident.securityDeposit.amountPaid) -
                          Number(resident.securityDeposit.amountRefunded)
                      )}
                    </span>
                  </div>
                  <div className="pt-2 text-[11px] text-muted-foreground">
                    Status:{" "}
                    <span className="capitalize font-medium text-foreground">
                      {resident.securityDeposit.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No security deposit recorded.</p>
              )}
            </div>

            {/* Payments Ledger */}
            <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-primary" />
                  Payments Received
                </h2>
                <Link
                  href={`/payments/record?residentId=${resident.id}`}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  + Add Payment
                </Link>
              </div>

              {resident.payments.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-3">
                  No payment records found.
                </p>
              ) : (
                <div className="divide-y divide-border text-xs max-h-80 overflow-y-auto">
                  {resident.payments.map((p: any) => (
                    <div key={p.id} className="py-2 flex items-center justify-between">
                      <div>
                        <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          +{formatINR(p.amount)}
                        </div>
                        <div className="text-[11px] text-muted-foreground capitalize">
                          {p.paymentMode} {p.reference ? `· ${p.reference}` : ""}
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatDate(p.paymentDate)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal: Room Change */}
        {showRoomChangeModal && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-lg max-w-md w-full p-6 space-y-4 shadow-lg">
              <h3 className="text-base font-bold text-foreground">Transfer to Another Room</h3>
              <p className="text-xs text-muted-foreground">
                Move {resident.name} from {resident.currentOccupancy?.roomName} to another active room.
              </p>
              <form onSubmit={handleRoomChange} className="space-y-4 text-xs">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Select New Room
                  </label>
                  {availableRooms.length === 0 ? (
                    <p className="text-xs text-destructive">No other rooms have available slots.</p>
                  ) : (
                    <select
                      value={newRoomId}
                      onChange={(e) => setNewRoomId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:ring-2 focus:ring-ring"
                    >
                      {availableRooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.portionName}) — {r.availableSlots} slot available
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Effective Transfer Date
                  </label>
                  <input
                    type="date"
                    required
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRoomChangeModal(false)}
                    className="px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={roomChangeSubmitting || availableRooms.length === 0}
                    className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50"
                  >
                    {roomChangeSubmitting ? "Transferring..." : "Confirm Room Transfer"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Move Out */}
        {showMoveOutModal && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-lg max-w-md w-full p-6 space-y-4 shadow-lg">
              <h3 className="text-base font-bold text-destructive">Resident Move-Out</h3>
              <p className="text-xs text-muted-foreground">
                Mark {resident.name} as moved out and settle security deposit refund.
              </p>
              <form onSubmit={handleMoveOut} className="space-y-4 text-xs">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Move-Out Date <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={moveOutDate}
                    onChange={(e) => setMoveOutDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:ring-2 focus:ring-ring"
                  />
                </div>

                {resident.securityDeposit && (
                  <div className="bg-muted/40 p-3 rounded-md space-y-3">
                    <div className="text-xs font-semibold text-foreground">
                      Security Deposit Settlement (Paid: {formatINR(resident.securityDeposit.amountPaid)})
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        Refund Amount (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        Refund Mode
                      </label>
                      <select
                        value={refundMode}
                        onChange={(e) => setRefundMode(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground"
                      >
                        <option value="upi">UPI</option>
                        <option value="cash">Cash</option>
                        <option value="bank_transfer">Bank Transfer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">
                        Refund Reference / Notes (e.g. deductions)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. ₹500 deducted for room painting/cleaning"
                        value={refundNotes}
                        onChange={(e) => setRefundNotes(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowMoveOutModal(false)}
                    className="px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={moveOutSubmitting}
                    className="px-4 py-1.5 rounded-md bg-destructive text-destructive-foreground font-medium disabled:opacity-50"
                  >
                    {moveOutSubmitting ? "Processing..." : "Complete Move-Out"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
