import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { portions, rooms, meters, roomOccupancies, residents } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { recordAudit } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1. Fetch all portions
  const allPortions = await db.select().from(portions).orderBy(portions.name);

  // 2. Fetch all rooms
  const allRooms = await db.select().from(rooms).orderBy(rooms.name);

  // 3. Fetch all meters
  const allMeters = await db.select().from(meters);

  // 4. Fetch active occupancies with resident names
  const activeOccupancies = await db
    .select({
      occupancyId: roomOccupancies.id,
      roomId: roomOccupancies.roomId,
      residentId: roomOccupancies.residentId,
      residentName: residents.name,
      residentPhone: residents.phone,
      moveInDate: roomOccupancies.moveInDate,
    })
    .from(roomOccupancies)
    .innerJoin(residents, eq(roomOccupancies.residentId, residents.id))
    .where(and(eq(residents.isActive, true), isNull(roomOccupancies.moveOutDate)));

  // Assemble full hierarchy: Portion -> Rooms -> Occupants + Meters
  const portionsWithDetails = allPortions.map((portion) => {
    const kitchenMeter = allMeters.find(
      (m) => m.meterType === "kitchen" && m.portionId === portion.id
    );

    const portionRooms = allRooms
      .filter((r) => r.portionId === portion.id)
      .map((room) => {
        const roomMeter = allMeters.find(
          (m) => m.meterType === "room" && m.roomId === room.id
        );
        const occupants = activeOccupancies.filter((o) => o.roomId === room.id);
        const availableSlots = Math.max(0, room.capacity - occupants.length);

        return {
          ...room,
          meter: roomMeter || null,
          occupants,
          availableSlots,
          isFull: occupants.length >= room.capacity,
          isVacant: occupants.length === 0,
        };
      });

    const totalOccupantsInPortion = portionRooms.reduce(
      (acc, r) => acc + r.occupants.length,
      0
    );

    return {
      ...portion,
      kitchenMeter: kitchenMeter || null,
      rooms: portionRooms,
      totalOccupants: totalOccupantsInPortion,
    };
  });

  return NextResponse.json({ success: true, data: portionsWithDetails });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { roomId, isActive } = await req.json();
    if (!roomId) {
      return NextResponse.json({ error: "roomId required" }, { status: 400 });
    }

    // If closing room, check that there are no active occupants
    if (isActive === false) {
      const activeOccupants = await db
        .select()
        .from(roomOccupancies)
        .where(
          and(
            eq(roomOccupancies.roomId, Number(roomId)),
            isNull(roomOccupancies.moveOutDate)
          )
        );

      if (activeOccupants.length > 0) {
        return NextResponse.json(
          { error: "Cannot close a room that currently has active residents. Move them out or change rooms first." },
          { status: 400 }
        );
      }
    }

    await db
      .update(rooms)
      .set({ isActive: Boolean(isActive) })
      .where(eq(rooms.id, Number(roomId)));

    await recordAudit({
      tableName: "rooms",
      recordId: Number(roomId),
      action: "UPDATE",
      actor: session.user?.email || "admin",
      payload: { roomId, isActive },
    });

    return NextResponse.json({ success: true, message: "Room updated" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update room" }, { status: 500 });
  }
}
