"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface RoomOption {
  id: number;
  name: string;
  portionName: string;
  capacity: number;
  occupantCount: number;
  availableSlots: number;
  isActive: boolean;
}

export default function NewResidentPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  // Form states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [idType, setIdType] = useState("aadhaar");
  const [idNumber, setIdNumber] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [roomId, setRoomId] = useState("");
  const [customRent, setCustomRent] = useState("5500.00");
  const [moveInDate, setMoveInDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [hasFood, setHasFood] = useState(true);

  // Security deposit
  const [securityDepositAmount, setSecurityDepositAmount] = useState("");
  const [securityDepositMode, setSecurityDepositMode] = useState("upi");
  const [securityDepositRef, setSecurityDepositRef] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRooms() {
      try {
        const res = await fetch("/api/rooms");
        const json = await res.json();
        if (json.success) {
          const flatRooms: RoomOption[] = [];
          for (const portion of json.data) {
            for (const room of portion.rooms) {
              flatRooms.push({
                id: room.id,
                name: room.name,
                portionName: portion.name,
                capacity: room.capacity,
                occupantCount: room.occupants.length,
                availableSlots: room.availableSlots,
                isActive: room.isActive,
              });
            }
          }
          setRooms(flatRooms);
          // Set default room to first available
          const firstAvailable = flatRooms.find((r) => r.isActive && r.availableSlots > 0);
          if (firstAvailable) {
            setRoomId(String(firstAvailable.id));
          }
        }
      } catch (err) {
        console.error("Failed to load rooms", err);
      } finally {
        setLoadingRooms(false);
      }
    }
    loadRooms();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Resident name is required.");
      return;
    }
    if (!roomId) {
      setError("Please select a room.");
      return;
    }
    if (!moveInDate) {
      setError("Please select a move-in date.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/residents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          idType,
          idNumber: idNumber.trim() || null,
          emergencyContactName: emergencyContactName.trim() || null,
          emergencyContactPhone: emergencyContactPhone.trim() || null,
          notes: notes.trim() || null,
          roomId: Number(roomId),
          customRent: customRent ? customRent.trim() : "5500.00",
          moveInDate,
          hasFood,
          securityDepositAmount: securityDepositAmount ? Number(securityDepositAmount) : null,
          securityDepositMode,
          securityDepositRef: securityDepositRef.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to create resident");
      }

      router.push(`/residents/${json.data.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedRoom = rooms.find((r) => r.id === Number(roomId));

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Back Link */}
        <Link
          href="/residents"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Residents</span>
        </Link>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Move In New Resident
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Enroll a new resident, assign their portion & room, set food preference and security deposit
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Basic Details */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground border-b border-border pb-2">
              1. Personal Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-foreground mb-1">
                  Full Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priya Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. priya@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  ID Proof Type
                </label>
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="aadhaar">Aadhaar Card</option>
                  <option value="pan">PAN Card</option>
                  <option value="passport">Passport</option>
                  <option value="voter_id">Voter ID</option>
                  <option value="driving_license">Driving License</option>
                  <option value="student_id">College / Student ID</option>
                  <option value="other">Other ID</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  ID Number (Encrypted with AES-256)
                </label>
                <input
                  type="text"
                  placeholder="e.g. XXXX-XXXX-1234"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Emergency Contact Name (Parent/Guardian)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Sharma (Father)"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Emergency Contact Phone
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9811002233"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-foreground mb-1">
                  Notes / Work / College details
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Working at Infosys, shifted from Jaipur"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Room & Move-in Date */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground border-b border-border pb-2">
              2. Room Assignment & Move-in
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Select Room <span className="text-destructive">*</span>
                </label>
                {loadingRooms ? (
                  <div className="text-xs text-muted-foreground py-2">Loading rooms...</div>
                ) : (
                  <select
                    required
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {rooms.map((r) => {
                      const isAvailable = r.isActive && r.availableSlots > 0;
                      return (
                        <option
                          key={r.id}
                          value={r.id}
                          disabled={!isAvailable}
                        >
                          {r.name} ({r.portionName}) —{" "}
                          {!r.isActive
                            ? "Closed"
                            : r.availableSlots === 0
                            ? "Full (2/2)"
                            : `${r.availableSlots} slot${r.availableSlots > 1 ? "s" : ""} left`}
                        </option>
                      );
                    })}
                  </select>
                )}
                {selectedRoom && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Room capacity: {selectedRoom.capacity} girls · Currently occupied:{" "}
                    {selectedRoom.occupantCount}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Move-in Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={moveInDate}
                  onChange={(e) => setMoveInDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Rent is charged for full cycle (15th–15th) as confirmed
                </p>
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-foreground">
                    Monthly Base Rent (₹)
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">
                    Single Occupancy Configurable
                  </span>
                </div>
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-2.5 font-bold text-xs text-muted-foreground">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="5500.00"
                    value={customRent}
                    onChange={(e) => setCustomRent(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 text-sm bg-background border border-border rounded-md text-foreground font-mono font-bold focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Default is ₹5,500 for standard 2-sharing. If this room is <strong>single occupied</strong>, enter your custom room rent here (e.g. ₹8,000, ₹9,000, or ₹10,000).
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Food Choice */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground border-b border-border pb-2">
              3. Monthly Plan & Food Choice
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => setHasFood(true)}
                className={`cursor-pointer border rounded-lg p-4 transition-all ${
                  hasFood
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-foreground">With Food</span>
                  <span className="font-bold text-base text-primary">₹8,000</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Base rent ₹5,500 + Food ₹2,500 (Electricity charged separately)
                </p>
              </div>

              <div
                onClick={() => setHasFood(false)}
                className={`cursor-pointer border rounded-lg p-4 transition-all ${
                  !hasFood
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-foreground">Without Food</span>
                  <span className="font-bold text-base text-primary">₹5,500</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Base rent ₹5,500 only (Electricity charged separately)
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Security Deposit */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground border-b border-border pb-2">
              4. Upfront Security Deposit (Optional)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Deposit Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  placeholder="e.g. 5000"
                  value={securityDepositAmount}
                  onChange={(e) => setSecurityDepositAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Payment Mode
                </label>
                <select
                  value={securityDepositMode}
                  onChange={(e) => setSecurityDepositMode(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="upi">UPI (GPay, PhonePe, Paytm)</option>
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
                  placeholder="e.g. UPI Ref 12345678"
                  value={securityDepositRef}
                  onChange={(e) => setSecurityDepositRef(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/residents"
              className="px-4 py-2 border border-border rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary text-primary-foreground text-xs font-medium px-5 py-2 rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
            >
              {submitting ? "Enrolling Resident..." : "Complete Move-In"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
