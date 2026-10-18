import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { 
  residents, 
  roomOccupancies, 
  rooms, 
  portions, 
  foodPreferences, 
  monthlyBills, 
  payments, 
  securityDeposits 
} from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { encryptData, decryptData } from "@/lib/crypto";
import { recordAudit } from "@/lib/audit";
import { calcOutstanding } from "@/lib/decimal";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const residentId = Number(params.id);
  if (!residentId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const resident = await db.query.residents.findFirst({
    where: eq(residents.id, residentId),
  });

  if (!resident) {
    return NextResponse.json({ error: "Resident not found" }, { status: 404 });
  }

  // 1. Occupancy history & current room
  const occupancies = await db
    .select({
      id: roomOccupancies.id,
      roomId: roomOccupancies.roomId,
      roomName: rooms.name,
      portionId: rooms.portionId,
      portionName: portions.name,
      moveInDate: roomOccupancies.moveInDate,
      moveOutDate: roomOccupancies.moveOutDate,
    })
    .from(roomOccupancies)
    .innerJoin(rooms, eq(roomOccupancies.roomId, rooms.id))
    .innerJoin(portions, eq(rooms.portionId, portions.id))
    .where(eq(roomOccupancies.residentId, residentId))
    .orderBy(desc(roomOccupancies.moveInDate));

  const currentOccupancy = occupancies.find((o) => !o.moveOutDate);

  // 2. Roommates in current room (if active)
  let roommates: { id: number; name: string }[] = [];
  if (currentOccupancy) {
    const roommateOccupancies = await db
      .select({
        residentId: roomOccupancies.residentId,
        residentName: residents.name,
      })
      .from(roomOccupancies)
      .innerJoin(residents, eq(roomOccupancies.residentId, residents.id))
      .where(
        and(
          eq(roomOccupancies.roomId, currentOccupancy.roomId),
          isNull(roomOccupancies.moveOutDate)
        )
      );

    roommates = roommateOccupancies
      .filter((r) => r.residentId !== residentId)
      .map((r) => ({ id: r.residentId, name: r.residentName }));
  }

  // 3. Security deposit
  const deposit = await db.query.securityDeposits.findFirst({
    where: eq(securityDeposits.residentId, residentId),
  });

  // 4. Monthly bills
  const bills = await db
    .select()
    .from(monthlyBills)
    .where(eq(monthlyBills.residentId, residentId))
    .orderBy(desc(monthlyBills.cycleStartDate));

  // 5. Payments
  const paymentList = await db
    .select()
    .from(payments)
    .where(eq(payments.residentId, residentId))
    .orderBy(desc(payments.paymentDate));

  // 6. Food preferences
  const foodPrefs = await db
    .select()
    .from(foodPreferences)
    .where(eq(foodPreferences.residentId, residentId))
    .orderBy(desc(foodPreferences.cycleStartDate));

  // 7. Calculate live outstanding balance
  const finalizedBillTotals = bills
    .filter((b) => b.status === "FINALIZED")
    .map((b) => b.totalAmount);
  const paymentAmounts = paymentList.map((p) => p.amount);
  const outstanding = calcOutstanding(finalizedBillTotals, paymentAmounts);

  return NextResponse.json({
    success: true,
    data: {
      ...resident,
      idNumber: resident.idNumberEncrypted
        ? decryptData(resident.idNumberEncrypted)
        : null,
      currentOccupancy: currentOccupancy || null,
      roommates,
      occupancyHistory: occupancies,
      securityDeposit: deposit || null,
      bills,
      payments: paymentList,
      foodPreferences: foodPrefs,
      outstanding,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const residentId = Number(params.id);
  if (!residentId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  try {
    const body = await req.json();
    const { action } = body;

    // Handle distinct workflows:
    // 1. "update_profile"
    // 2. "change_room"
    // 3. "move_out"
    // 4. "update_food"

    if (action === "update_profile") {
      const { name, phone, email, idType, idNumber, emergencyContactName, emergencyContactPhone, notes } = body;
      const updateData: any = {};
      if (name) updateData.name = name.trim();
      if (phone !== undefined) updateData.phone = phone?.trim() || null;
      if (email !== undefined) updateData.email = email?.trim() || null;
      if (idType !== undefined) updateData.idType = idType || null;
      if (idNumber !== undefined) updateData.idNumberEncrypted = idNumber ? encryptData(idNumber.trim()) : null;
      if (emergencyContactName !== undefined) updateData.emergencyContactName = emergencyContactName?.trim() || null;
      if (emergencyContactPhone !== undefined) updateData.emergencyContactPhone = emergencyContactPhone?.trim() || null;
      if (notes !== undefined) updateData.notes = notes?.trim() || null;

      await db.update(residents).set(updateData).where(eq(residents.id, residentId));
      await recordAudit({
        tableName: "residents",
        recordId: residentId,
        action: "UPDATE",
        actor: session.user?.email || "admin",
        payload: { action: "update_profile", residentId },
      });
      return NextResponse.json({ success: true, message: "Profile updated" });
    }

    if (action === "change_room") {
      const { newRoomId, effectiveDate } = body;
      if (!newRoomId || !effectiveDate) {
        return NextResponse.json({ error: "New room and effective date are required." }, { status: 400 });
      }

      // Validate target room capacity
      const targetRoom = await db.query.rooms.findFirst({
        where: eq(rooms.id, Number(newRoomId)),
      });

      if (!targetRoom || !targetRoom.isActive) {
        return NextResponse.json({ error: "Target room is not available." }, { status: 400 });
      }

      const targetOccupants = await db
        .select()
        .from(roomOccupancies)
        .where(
          and(
            eq(roomOccupancies.roomId, Number(newRoomId)),
            isNull(roomOccupancies.moveOutDate)
          )
        );

      if (targetOccupants.length >= targetRoom.capacity) {
        return NextResponse.json(
          { error: `Room ${targetRoom.name} is already full.` },
          { status: 400 }
        );
      }

      // Close current occupancy
      await db
        .update(roomOccupancies)
        .set({ moveOutDate: effectiveDate })
        .where(
          and(
            eq(roomOccupancies.residentId, residentId),
            isNull(roomOccupancies.moveOutDate)
          )
        );

      // Insert new occupancy
      await db.insert(roomOccupancies).values({
        residentId,
        roomId: Number(newRoomId),
        moveInDate: effectiveDate,
        moveOutDate: null,
      });

      await recordAudit({
        tableName: "room_occupancies",
        recordId: residentId,
        action: "UPDATE",
        actor: session.user?.email || "admin",
        payload: { action: "change_room", residentId, newRoomId, effectiveDate },
      });

      return NextResponse.json({ success: true, message: "Room changed successfully" });
    }

    if (action === "move_out") {
      const { moveOutDate, refundAmount, refundMode, refundReference, refundNotes } = body;
      if (!moveOutDate) {
        return NextResponse.json({ error: "Move-out date is required." }, { status: 400 });
      }

      // Close occupancy
      await db
        .update(roomOccupancies)
        .set({ moveOutDate })
        .where(
          and(
            eq(roomOccupancies.residentId, residentId),
            isNull(roomOccupancies.moveOutDate)
          )
        );

      // Set resident to inactive
      await db
        .update(residents)
        .set({ isActive: false })
        .where(eq(residents.id, residentId));

      // Handle security deposit refund if recorded
      if (refundAmount !== undefined && Number(refundAmount) >= 0) {
        const deposit = await db.query.securityDeposits.findFirst({
          where: eq(securityDeposits.residentId, residentId),
        });

        if (deposit) {
          const refundNum = Number(refundAmount);
          const totalPaidNum = Number(deposit.amountPaid);
          const newStatus = refundNum >= totalPaidNum ? "fully_refunded" : "partially_refunded";

          await db
            .update(securityDeposits)
            .set({
              amountRefunded: String(refundNum.toFixed(2)),
              refundDate: moveOutDate,
              refundMode: refundMode || "upi",
              refundReference: refundReference?.trim() || null,
              refundNotes: refundNotes?.trim() || null,
              status: newStatus,
              updatedAt: new Date(),
            })
            .where(eq(securityDeposits.id, deposit.id));
        }
      }

      await recordAudit({
        tableName: "residents",
        recordId: residentId,
        action: "UPDATE",
        actor: session.user?.email || "admin",
        payload: { action: "move_out", residentId, moveOutDate, refundAmount },
      });

      return NextResponse.json({ success: true, message: "Resident moved out successfully" });
    }

    if (action === "update_food") {
      const { cycleStartDate, hasFood } = body;
      if (!cycleStartDate) {
        return NextResponse.json({ error: "Cycle start date required" }, { status: 400 });
      }

      await db
        .insert(foodPreferences)
        .values({
          residentId,
          cycleStartDate,
          hasFood: Boolean(hasFood),
        })
        .onConflictDoUpdate({
          target: [foodPreferences.residentId, foodPreferences.cycleStartDate],
          set: {
            hasFood: Boolean(hasFood),
            recordedAt: new Date(),
          },
        });

      return NextResponse.json({ success: true, message: "Food preference updated" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    console.error("Error updating resident:", err);
    return NextResponse.json({ error: err.message || "Failed to update resident" }, { status: 500 });
  }
}
