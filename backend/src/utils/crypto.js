import crypto from "crypto";

const ENCRYPTION_KEY = crypto
  .createHash("sha256")
  .update(process.env.JWT_SECRET || "gestor_oportunidades_robot_secret_key")
  .digest();

/**
 * Encrypts sensitive text using AES-256-CBC.
 * @param {string} text Plain text to encrypt
 * @returns {string} Encrypted string prefixed with enc:
 */
export const encryptText = (text) => {
  if (!text || text.startsWith("enc:")) return text;
  const iv = crypto.randomBytes(16);
  const cipher = cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `enc:${iv.toString("hex")}:${encrypted}`;
};

/**
 * Decrypts text encrypted with encryptText.
 * @param {string} text Encrypted string
 * @returns {string} Decrypted plain text
 */
export const decryptText = (text) => {
  if (!text || typeof text !== "string" || !text.startsWith("enc:")) return text;
  const parts = text.split(":");
  if (parts.length !== 3) return text;
  try {
    const iv = Buffer.from(parts[1], "hex");
    const encryptedText = parts[2];
    const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("[decryptText] Error decrypting text:", err.message);
    return text;
  }
};
