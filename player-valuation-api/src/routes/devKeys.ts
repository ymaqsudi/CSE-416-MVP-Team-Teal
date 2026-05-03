import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { ApiKey } from "../models/ApiKey.js";
import { jwtAuthMiddleware } from "../middleware/jwtAuth.js";
import { generateApiKey } from "../lib/keys.js";

const router = Router();

router.use(jwtAuthMiddleware);

const MAX_LABEL_LEN = 100;
const MIN_WINDOW_SEC = 1;
const MAX_WINDOW_SEC = 24 * 60 * 60;
const MIN_RATE_MAX = 1;
const MAX_RATE_MAX = 100_000;

interface CreateKeyBody {
  label?: unknown;
  rateLimit?: { windowSec?: unknown; max?: unknown } | unknown;
}

function validateCreateBody(
  body: CreateKeyBody
):
  | { ok: true; label: string; windowSec: number; max: number }
  | { ok: false; message: string } {
  const { label, rateLimit } = body;

  if (typeof label !== "string" || label.trim().length === 0 || label.length > MAX_LABEL_LEN) {
    return { ok: false, message: `label must be 1-${MAX_LABEL_LEN} characters` };
  }
  if (!rateLimit || typeof rateLimit !== "object") {
    return { ok: false, message: "rateLimit { windowSec, max } required" };
  }
  const rl = rateLimit as { windowSec?: unknown; max?: unknown };
  if (
    typeof rl.windowSec !== "number" ||
    !Number.isInteger(rl.windowSec) ||
    rl.windowSec < MIN_WINDOW_SEC ||
    rl.windowSec > MAX_WINDOW_SEC
  ) {
    return {
      ok: false,
      message: `rateLimit.windowSec must be an integer between ${MIN_WINDOW_SEC} and ${MAX_WINDOW_SEC}`,
    };
  }
  if (
    typeof rl.max !== "number" ||
    !Number.isInteger(rl.max) ||
    rl.max < MIN_RATE_MAX ||
    rl.max > MAX_RATE_MAX
  ) {
    return {
      ok: false,
      message: `rateLimit.max must be an integer between ${MIN_RATE_MAX} and ${MAX_RATE_MAX}`,
    };
  }

  return {
    ok: true,
    label: label.trim(),
    windowSec: rl.windowSec,
    max: rl.max,
  };
}

function publicKeyView(doc: {
  _id: Types.ObjectId;
  prefix: string;
  label: string;
  rateLimit: { windowSec: number; max: number };
  revokedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: doc._id.toString(),
    prefix: doc.prefix,
    label: doc.label,
    rateLimit: doc.rateLimit,
    revokedAt: doc.revokedAt,
    createdAt: doc.createdAt,
  };
}

router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const keys = await ApiKey.find({ developerId: req.developerId }).sort({ createdAt: -1 });
    res.json({ keys: keys.map(publicKeyView) });
  } catch (err) {
    console.error("list keys error", err);
    res.status(500).json({ message: "Internal error" });
  }
});

router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = validateCreateBody(req.body ?? {});
    if (!validation.ok) {
      res.status(400).json({ message: validation.message });
      return;
    }
    const { plaintext, prefix, keyHash } = generateApiKey();
    const doc = await ApiKey.create({
      developerId: req.developerId,
      prefix,
      keyHash,
      label: validation.label,
      rateLimit: { windowSec: validation.windowSec, max: validation.max },
    });
    res.status(201).json({
      ...publicKeyView(doc),
      // The plaintext is returned EXACTLY ONCE here. After this response it is
      // not retrievable; the server stores only the SHA-256 hash.
      plaintext,
    });
  } catch (err) {
    console.error("create key error", err);
    res.status(500).json({ message: "Internal error" });
  }
});

router.post("/:id/revoke", async (req: Request, res: Response): Promise<void> => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ message: "Invalid key id" });
      return;
    }
    const doc = await ApiKey.findOneAndUpdate(
      {
        _id: req.params.id,
        developerId: req.developerId,
        revokedAt: null,
      },
      { $set: { revokedAt: new Date() } },
      { new: true }
    );
    if (!doc) {
      res.status(404).json({ message: "Key not found or already revoked" });
      return;
    }
    res.json(publicKeyView(doc));
  } catch (err) {
    console.error("revoke key error", err);
    res.status(500).json({ message: "Internal error" });
  }
});

export default router;
