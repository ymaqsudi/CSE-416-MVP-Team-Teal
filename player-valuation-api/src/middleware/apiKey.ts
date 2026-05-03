import { Request, Response, NextFunction } from "express";
import { ApiKey } from "../models/ApiKey.js";
import { UsageLog } from "../models/UsageLog.js";
import { parseKey, sha256Hex, constantTimeEqualHex } from "../lib/keys.js";
import { checkAndIncrement } from "../lib/rateLimit.js";

declare module "express-serve-static-core" {
  interface Request {
    apiKeyId?: string;
  }
}

const HEADER_NAME = "x-license-key";

// `::ffff:127.0.0.1` -> `127.0.0.1`. Cleans up the value we store in UsageLog.
function normalizeIp(ip: string): string {
  const trimmed = ip.trim().toLowerCase();
  const v4Mapped = trimmed.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  return v4Mapped ? v4Mapped[1] : trimmed;
}

export async function apiKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const headerValue = req.headers[HEADER_NAME];
    const presented = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (!presented || typeof presented !== "string") {
      res.status(401).json({ message: "Unauthorized: missing x-license-key header" });
      return;
    }

    const parsed = parseKey(presented);
    if (!parsed) {
      res.status(401).json({ message: "Unauthorized: malformed key" });
      return;
    }

    const record = await ApiKey.findOne({ prefix: parsed.prefix });
    if (!record) {
      res.status(401).json({ message: "Unauthorized: invalid key" });
      return;
    }

    const presentedHash = sha256Hex(presented);
    if (!constantTimeEqualHex(presentedHash, record.keyHash)) {
      res.status(401).json({ message: "Unauthorized: invalid key" });
      return;
    }

    // From this point we know the key + owning developer. Tie every outcome
    // (allow/deny) back to that account via UsageLog so the developer can see
    // their own usage in the portal.
    const requestIp = normalizeIp(req.ip ?? "");
    const keyId = record._id;
    const developerId = record.developerId;
    res.on("finish", () => {
      UsageLog.create({
        keyId,
        developerId,
        ip: requestIp,
        path: req.originalUrl,
        status: res.statusCode,
      }).catch((err) => console.error("UsageLog write failed", err));
    });

    if (record.revokedAt) {
      res.status(401).json({ message: "Unauthorized: key revoked" });
      return;
    }

    const verdict = await checkAndIncrement(
      record._id,
      record.rateLimit.windowSec,
      record.rateLimit.max
    );
    if (!verdict.allowed) {
      res.status(429).json({
        message: "Rate limit exceeded",
        windowSec: verdict.windowSec,
        max: verdict.max,
      });
      return;
    }

    req.developerId = developerId.toString();
    req.apiKeyId = keyId.toString();
    next();
  } catch (err) {
    console.error("apiKey middleware error", err);
    res.status(500).json({ message: "Internal authorization error" });
  }
}
