import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { 
  residents, 
  roomOccupancies, 
  rooms, 
  portions, 
  foodPreferences, 
  securityDeposits 
} from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { encryptData, decryptData } from "@/lib/crypto";
import { recordAudit } from "@/lib/audit";
import { getCurrentCycleStart } from "@/lib/billing-cycle";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  // Fetch residents with current active occupancy
  const query = db
    .select({
      id: residents.id,
      name: residents.name,
      phone: residents.phone,
      email: residents.email,
      idType: residents.idType,
      idNumberEncrypted: residents.idNumberEncrypted,
      emergencyContactName: residents.emergencyContactName,
      emergencyContactPhone: residents.emergencyContactPhone,
      notes: residents.notes,
      isActive: residents.isActive,
      createdAt: residents.createdAt,
      occupancyId: roomOccupancies.id,
      roomId: roomOccupancies.roomId,
      roomName: rooms.name,
      portionId: rooms.portionId,
      portionName: portions.name,
      moveInDate: roomOccupancies.moveInDate,
      moveOutDate: roomOccupancies.moveOutDate,
    })
    .from(residents)
    .leftJoin(
      roomOccupancies,
      and(
        eq(roomOccupancies.residentId, residents.id),
        isNull(roomOccupancies.moveOutDate)
      )
    )
    .leftJoin(rooms, eq(roomOccupancies.roomId, rooms.id))
    .leftJoin(portions, eq(rooms.portionId, portions.id))
    .orderBy(desc(residents.createdAt));

  const allResidents = await query;
  const filtered = includeInactive ? allResidents : allResidents.filter(r => r.isActive);

  // Decrypt ID numbers for authenticated view
  const result = filtered.map(r => ({
    ...r,
    idNumber: r.idNumberEncrypted ? decryptData(r.idNumberEncrypted) : null,
  }));

  return NextResponse.json({ success: true, data: result });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      name,
      phone,
      email,
      idType,
      idNumber,
      emergencyContactName,
      emergencyContactPhone,
      notes,
      roomId,
      moveInDate,
      hasFood,
      securityDepositAmount,
      securityDepositMode,
      securityDepositRef,
    } = body;

    if (!name || !roomId || !moveInDate) {
      return NextResponse.json(
        { error: "Name, room assignment, and move-in date are required." },
        { status: 400 }
      );
    }

    // Check room capacity
    const selectedRoom = await db.query.rooms.findFirst({
      where: eq(rooms.id, Number(roomId)),
    });

    if (!selectedRoom || !selectedRoom.isActive) {
      return NextResponse.json(
        { error: "Selected room is not active or does not exist." },
        { status: 400 }
      );
    }

    const currentOccupants = await db
      .select()
      .from(roomOccupancies)
      .where(
        and(
          eq(roomOccupancies.roomId, Number(roomId)),
          isNull(roomOccupancies.moveOutDate)
        )
      );

    if (currentOccupants.length >= selectedRoom.capacity) {
      return NextResponse.json(
        { error: `Room ${selectedRoom.name} is already at full capacity (${selectedRoom.capacity}/${selectedRoom.capacity}).` },
        { status: 400 }
      );
    }

    // 1. Create resident
    const [newResident] = await db
      .insert(residents)
      .values({
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        idType: idType || null,
        idNumberEncrypted: idNumber ? encryptData(idNumber.trim()) : null,
        emergencyContactName: emergencyContactName?.trim() || null,
        emergencyContactPhone: emergencyContactPhone?.trim() || null,
        notes: notes?.trim() || null,
        isActive: true,
      })
      .returning();

    // 2. Create room occupancy
    const [occupancy] = await db
      .insert(roomOccupancies)
      .values({
        residentId: newResident.id,
        roomId: Number(roomId),
        moveInDate: moveInDate,
        moveOutDate: null,
      })
      .returning();

    // 3. Create food preference for current cycle
    const currentCycle = getCurrentCycleStart();
    const cycleDateStr = format(currentCycle, "yyyy-MM-dd");
    await db.insert(foodPreferences).values({
      residentId: newResident.id,
      cycleStartDate: cycleDateStr,
      hasFood: Boolean(hasFood),
    });

    // 4. Create security deposit record if provided
    if (securityDepositAmount && Number(securityDepositAmount) > 0) {
      await db.insert(securityDeposits).values({
        residentId: newResident.id,
        amountPaid: String(Number(securityDepositAmount).toFixed(2)),
        paymentDate: moveInDate,
        paymentMode: securityDepositMode || "upi",
        reference: securityDepositRef?.trim() || null,
        status: "held",
      });
    }

    await recordAudit({
      tableName: "residents",
      recordId: newResident.id,
      action: "INSERT",
      actor: session.user?.email || "admin",
      payload: {
        residentId: newResident.id,
        name: newResident.name,
        roomId: Number(roomId),
        moveInDate,
        hasFood,
      },
    });

    return NextResponse.json({ success: true, data: newResident });
  } catch (err: any) {
    console.error("Error creating resident:", err);
    return NextResponse.json({ error: err.message || "Failed to create resident" }, { status: 500 });
  }
}
