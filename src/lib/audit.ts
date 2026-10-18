import { db } from "@/db";
import { auditLog } from "@/db/schema";

export async function recordAudit({
  tableName,
  recordId,
  action,
  actor = "admin",
  payload,
}: {
  tableName: string;
  recordId?: number | null;
  action: "INSERT" | "UPDATE" | "FINALIZE" | "VOID" | "DELETE_ATTEMPT" | "CONFIG_CHANGE";
  actor?: string;
  payload?: any;
}) {
  try {
    await db.insert(auditLog).values({
      tableName,
      recordId: recordId ?? null,
      action,
      actor,
      payload: payload ? JSON.parse(JSON.stringify(payload)) : null,
    });
  } catch (err) {
    console.error("Failed to write to audit log:", err);
  }
}
