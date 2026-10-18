import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const hexKey = process.env.ENCRYPTION_KEY;
  if (!hexKey) {
    // Return a deterministic fallback key if not set in dev, but warn
    console.warn("ENCRYPTION_KEY is not set! Using development default key.");
    return crypto.createHash("sha256").update("dev-secret-key-do-not-use-in-prod").digest();
  }
  if (hexKey.length === 64) {
    return Buffer.from(hexKey, "hex");
  }
  return crypto.createHash("sha256").update(hexKey).digest();
}

/**
 * Encrypt sensitive plain text (e.g. Aadhaar / PAN card number)
 */
export function encryptData(plainText: string): string {
  if (!plainText) return "";
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypt sensitive text
 */
export function decryptData(cipherText: string): string {
  if (!cipherText) return "";
  try {
    const parts = cipherText.split(":");
    if (parts.length !== 3) return cipherText; // Fallback if plain
    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getKey();
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("Decryption failed:", err);
    return "[Encrypted ID]";
  }
}
