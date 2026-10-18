"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { 
  DoorClosed, 
  Gauge, 
  Users, 
  Utensils, 
  Plus, 
  Power,
  Zap,
  Building,
  CheckCircle2,
  Sparkles
} from "lucide-react";
import { formatDate } from "@/lib/billing-cycle";

interface PortionData {
  id: number;
  name: string;
  totalOccupants: number;
  kitchenMeter: {
    id: number;
    meterCode: string;
    meterType: string;
  } | null;
  rooms: {
    id: number;
    name: string;
    capacity: number;
    isActive: boolean;
    availableSlots: number;
    isFull: boolean;
    isVacant: boolean;
    meter: {
      id: number;
      meterCode: string;
      meterType: string;
    } | null;
    occupants: {
      occupancyId: number;
      residentId: number;
      residentName: string;
      residentPhone: string | null;
      moveInDate: string;
    }[];
  }[];
}

const PORTION_THEMES: Record<string, { bg: string; border: string; accent: string; badge: string }> = {
  "Portion A": {
    bg: "from-indigo-500/10 via-indigo-500/5 to-transparent",
    border: "border-indigo-500/30",
    accent: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10",
    badge: "bg-indigo-500 text-white",
  },
  "Portion B": {
    bg: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    border: "border-emerald-500/30",
    accent: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    badge: "bg-emerald-500 text-white",
  },
  "Portion C": {
    bg: "from-amber-500/10 via-amber-500/5 to-transparent",
    border: "border-amber-500/30",
    accent: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
    badge: "bg-amber-500 text-white",
  },
  "Portion D": {
    bg: "from-purple-500/10 via-purple-500/5 to-transparent",
    border: "border-purple-500/30",
    accent: "text-purple-600 dark:text-purple-400 bg-purple-500/10",
    badge: "bg-purple-500 text-white",
  },
};

export default function RoomsPage() {
  const [portions, setPortions] = useState<PortionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingRoom, setTogglingRoom] = useState<number | null>(null);

  useEffect(() => {
    loadRooms();
  }, []);

  async function loadRooms() {
    try {
      const res = await fetch("/api/rooms");
      const json = await res.json();
      if (json.success) {
        setPortions(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleRoomStatus(roomId: number, currentActive: boolean) {
    if (currentActive && !confirm("Are you sure you want to close this room? Unoccupied rooms are closed so electricity is not used.")) {
      return;
    }
    setTogglingRoom(roomId);
    try {
      const res = await fetch("/api/rooms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, isActive: !currentActive }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error || "Failed to update room");
      } else {
        loadRooms();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTogglingRoom(null);
    }
  }

  const totalOccupants = portions.reduce((acc, p) => acc + p.totalOccupants, 0);

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
              <Building className="w-7 h-7 text-primary" />
              <span>Rooms & Portions</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              4 Portions · 8 Rooms · 12 Physical Submeters (8 Room + 4 Kitchen)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-bold text-foreground">
              Total Occupancy: <span className="text-primary font-mono font-black">{totalOccupants} / 16 girls</span>
            </div>
            <Link
              href="/residents/new"
              className="inline-flex items-center gap-1.5 bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground font-bold text-xs px-4 py-2 rounded-xl hover:brightness-110 transition-all shadow-md shadow-primary/25"
            >
              <Plus className="w-4 h-4" />
              <span>Move In Girl</span>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="bg-card border-2 border-border rounded-2xl p-12 text-center text-sm text-muted-foreground">
            Loading property structure...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {portions.map((portion) => {
              const theme = PORTION_THEMES[portion.name] || PORTION_THEMES["Portion A"];
              const portionLetter = portion.name.replace("Portion ", "");

              return (
                <div
                  key={portion.id}
                  className={`bg-card border-2 ${theme.border} rounded-2xl shadow-sm overflow-hidden flex flex-col transition-all`}
                >
                  {/* Portion Top Bar */}
                  <div className={`p-5 border-b border-border bg-gradient-to-r ${theme.bg} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl ${theme.badge} flex items-center justify-center font-black text-sm shadow-sm`}>
                        {portionLetter}
                      </div>
                      <div>
                        <h2 className="font-extrabold text-base text-foreground tracking-tight">
                          {portion.name}
                        </h2>
                        <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {portion.totalOccupants} active resident{portion.totalOccupants === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>

                    {portion.kitchenMeter && (
                      <div className="font-mono text-xs font-extrabold px-3 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1.5 shadow-2xs">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        Kitchen: {portion.kitchenMeter.meterCode}
                      </div>
                    )}
                  </div>

                  {/* Rooms in Portion */}
                  <div className="p-5 space-y-4 flex-1">
                    {portion.rooms.map((room) => {
                      const roomLetter = room.name.split("Room")[1];
                      const capacityPercent = (room.occupants.length / room.capacity) * 100;

                      return (
                        <div
                          key={room.id}
                          className={`border-2 rounded-xl p-4 transition-all ${
                            !room.isActive
                              ? "bg-muted/30 border-border/60 opacity-60"
                              : room.isFull
                              ? "bg-emerald-500/[0.03] border-emerald-500/30"
                              : "bg-background border-border hover:border-primary/40"
                          }`}
                        >
                          {/* Room Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <DoorClosed className="w-4 h-4 text-primary" />
                              <h3 className="font-extrabold text-sm text-foreground">
                                {room.name}
                              </h3>
                              <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                  !room.isActive
                                    ? "bg-muted text-muted-foreground"
                                    : room.isFull
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                    : room.isVacant
                                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                                    : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                }`}
                              >
                                {!room.isActive
                                  ? "Closed / Off"
                                  : room.isFull
                                  ? "Full (2/2)"
                                  : room.isVacant
                                  ? "Vacant (0/2)"
                                  : "1 Slot Open (1/2)"}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {room.meter && (
                                <span className="font-mono text-xs font-bold bg-muted/80 text-foreground px-2 py-0.5 rounded border border-border/80">
                                  ⚡ {room.meter.meterCode}
                                </span>
                              )}
                              <button
                                onClick={() => toggleRoomStatus(room.id, room.isActive)}
                                disabled={togglingRoom === room.id}
                                className={`p-1.5 rounded-lg text-xs transition-colors ${
                                  room.isActive
                                    ? "text-muted-foreground hover:text-destructive hover:bg-muted"
                                    : "text-emerald-600 hover:bg-emerald-500/10"
                                }`}
                                title={room.isActive ? "Close room" : "Re-open room"}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Occupancy Indicator Bar */}
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden mb-3">
                            <div
                              className={`h-full transition-all ${
                                room.isFull ? "bg-emerald-500" : "bg-primary"
                              }`}
                              style={{ width: `${capacityPercent}%` }}
                            />
                          </div>

                          {/* Occupants list */}
                          {room.occupants.length === 0 ? (
                            <div className="flex items-center justify-between text-xs py-1">
                              <span className="text-muted-foreground italic text-[11px]">
                                {room.isActive
                                  ? "No residents currently in this room."
                                  : "Room closed — meter inactive."}
                              </span>
                              {room.isActive && (
                                <Link
                                  href={`/residents/new`}
                                  className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Move In Here</span>
                                </Link>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1.5 pt-1">
                              {room.occupants.map((occ) => (
                                <div
                                  key={occ.occupancyId}
                                  className="flex items-center justify-between text-xs bg-muted/40 px-3 py-2 rounded-lg border border-border/40"
                                >
                                  <Link
                                    href={`/residents/${occ.residentId}`}
                                    className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-2"
                                  >
                                    <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px]">
                                      {occ.residentName.charAt(0).toUpperCase()}
                                    </div>
                                    <span>{occ.residentName}</span>
                                  </Link>
                                  <span className="text-[11px] text-muted-foreground font-mono">
                                    Since {formatDate(occ.moveInDate)}
                                  </span>
                                </div>
                              ))}
                            </div>
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
      </div>
    </AppShell>
  );
}
