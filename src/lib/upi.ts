/**
 * UPI & WhatsApp Utility Functions for Indian PG Accommodation
 */

/**
 * Builds a standard Indian UPI Deep Link URI.
 * Compatible with Google Pay, PhonePe, Paytm, BHIM, and bank UPI apps.
 */
export function buildUpiUri({
  upiId,
  payeeName,
  amount,
  transactionNote,
}: {
  upiId: string;
  payeeName: string;
  amount: string | number;
  transactionNote?: string;
}): string {
  const cleanUpi = upiId.trim();
  const cleanName = payeeName.trim() || "PG Accommodation";
  const numAmount = Number(amount).toFixed(2);
  const note = transactionNote || "PG Rent & Electricity";

  const params = new URLSearchParams({
    pa: cleanUpi,
    pn: cleanName,
    am: numAmount,
    cu: "INR",
    tn: note,
  });

  return `upi://pay?${params.toString()}`;
}

/**
 * Generates a clean QR code image URL for a given UPI URI.
 */
export function getUpiQrCodeUrl(upiUri: string, size: number = 220): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(
    upiUri
  )}`;
}

/**
 * Formats a clean WhatsApp bill breakdown text message.
 */
export function formatWhatsAppBillMessage({
  residentName,
  cycleText,
  baseRent,
  foodCharge,
  hasFood,
  electricityCharge,
  totalAmount,
  upiId,
  payeeName,
  lineItems,
}: {
  residentName: string;
  cycleText: string;
  baseRent: string;
  foodCharge: string;
  hasFood: boolean;
  electricityCharge: string;
  totalAmount: string;
  upiId?: string;
  payeeName?: string;
  lineItems?: {
    meterCode: string;
    meterType: string;
    unitsConsumed: string;
    residentShare: string;
  }[];
}): string {
  let lines: string[] = [];
  lines.push(`Namaste ${residentName} ji! 🏠`);
  lines.push(`Here is your PG accommodation bill for *${cycleText}*:`);
  lines.push("");
  lines.push(`• Base Room Rent: ₹${Number(baseRent).toLocaleString("en-IN")}`);
  if (hasFood && Number(foodCharge) > 0) {
    lines.push(`• Food Plan: ₹${Number(foodCharge).toLocaleString("en-IN")}`);
  } else {
    lines.push(`• Food Plan: None (₹0)`);
  }

  if (lineItems && lineItems.length > 0) {
    lines.push(`• Electricity Breakdown:`);
    for (const item of lineItems) {
      const typeLabel = item.meterType === "kitchen" ? "Kitchen" : "Room";
      lines.push(
        `   ⚡ ${typeLabel} (${item.meterCode}): ₹${Number(item.residentShare).toLocaleString("en-IN")} (${item.unitsConsumed} units)`
      );
    }
    lines.push(`   Total Electricity: ₹${Number(electricityCharge).toLocaleString("en-IN")}`);
  } else {
    lines.push(`• Electricity: ₹${Number(electricityCharge).toLocaleString("en-IN")}`);
  }

  lines.push("──────────────────────");
  lines.push(`*TOTAL AMOUNT DUE: ₹${Number(totalAmount).toLocaleString("en-IN")}*`);
  lines.push("──────────────────────");

  if (upiId) {
    lines.push("");
    lines.push(`📲 Pay via UPI (GPay / PhonePe / Paytm):`);
    lines.push(`UPI ID: *${upiId}*`);
    if (payeeName) {
      lines.push(`Payee Name: ${payeeName}`);
    }
  }

  lines.push("");
  lines.push("Please share the transaction reference or screenshot once paid.");
  lines.push("Thank you! 🙏");

  return lines.join("\n");
}

/**
 * Formats a WhatsApp reminder for outstanding dues.
 */
export function formatWhatsAppReminderMessage({
  residentName,
  outstandingAmount,
  upiId,
  payeeName,
}: {
  residentName: string;
  outstandingAmount: string;
  upiId?: string;
  payeeName?: string;
}): string {
  let lines: string[] = [];
  lines.push(`Namaste ${residentName} ji! 🏠`);
  lines.push(`Gentle reminder regarding your PG accommodation balance.`);
  lines.push("");
  lines.push(`• Net Outstanding Balance: *₹${Number(outstandingAmount).toLocaleString("en-IN")}*`);
  lines.push("");

  if (upiId) {
    lines.push(`📲 Pay via UPI (GPay / PhonePe / Paytm):`);
    lines.push(`UPI ID: *${upiId}*`);
    if (payeeName) {
      lines.push(`Payee Name: ${payeeName}`);
    }
    lines.push("");
  }

  lines.push("Please share the payment reference once done. Thank you! 🙏");
  return lines.join("\n");
}

/**
 * Creates a direct WhatsApp click-to-chat URL.
 */
export function getWhatsAppShareUrl(phone: string | null | undefined, message: string): string {
  let cleanPhone = (phone || "").replace(/\D/g, "");
  // If Indian 10-digit number without country code, prepend 91
  if (cleanPhone.length === 10) {
    cleanPhone = `91${cleanPhone}`;
  }

  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  }
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
