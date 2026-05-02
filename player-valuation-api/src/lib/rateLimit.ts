import { Types } from "mongoose";
import { UsageCounter } from "../models/UsageCounter.js";

export interface RateLimitVerdict {
  allowed: boolean;
  count: number;
  max: number;
  windowStart: Date;
  windowSec: number;
}

/**
 * Fixed-window rate limit. Computes the current window's start by flooring
 * `Date.now()` to the nearest `windowSec` boundary, then atomically increments
 * the matching `(keyId, windowStart)` counter. Verdict reflects post-increment count.
 */
export async function checkAndIncrement(
  keyId: Types.ObjectId,
  windowSec: number,
  max: number
): Promise<RateLimitVerdict> {
  const nowMs = Date.now();
  const windowMs = windowSec * 1000;
  const windowStart = new Date(Math.floor(nowMs / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs);

  const doc = await UsageCounter.findOneAndUpdate(
    { keyId, windowStart },
    {
      $inc: { count: 1 },
      $setOnInsert: { keyId, windowStart, expiresAt },
    },
    { upsert: true, new: true }
  );

  return {
    allowed: doc.count <= max,
    count: doc.count,
    max,
    windowStart,
    windowSec,
  };
}
