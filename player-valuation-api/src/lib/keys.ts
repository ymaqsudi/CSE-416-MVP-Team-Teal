import { randomBytes, createHash, timingSafeEqual } from "crypto";

const KEY_PREFIX = "pvk";
const PREFIX_BYTES = 4;
const PREFIX_LEN = PREFIX_BYTES * 2;
const SECRET_BYTES = 24;

export interface GeneratedKey {
  plaintext: string;
  prefix: string;
  keyHash: string;
}

// Hex encoding (0-9, a-f) — never collides with the `_` separator, unlike
// base64url which can emit `_` and break parseKey().
export function generateApiKey(): GeneratedKey {
  const prefix = randomBytes(PREFIX_BYTES).toString("hex");
  const secret = randomBytes(SECRET_BYTES).toString("hex");
  const plaintext = `${KEY_PREFIX}_${prefix}_${secret}`;
  const keyHash = sha256Hex(plaintext);
  return { plaintext, prefix, keyHash };
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function constantTimeEqualHex(aHex: string, bHex: string): boolean {
  if (aHex.length !== bHex.length) return false;
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function parseKey(key: string): { prefix: string } | null {
  const parts = key.split("_");
  if (parts.length !== 3) return null;
  if (parts[0] !== KEY_PREFIX) return null;
  if (parts[1].length !== PREFIX_LEN) return null;
  return { prefix: parts[1] };
}
