import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { ApiKey } from "../models/ApiKey.js";
import { UsageLog } from "../models/UsageLog.js";
import { jwtAuthMiddleware } from "../middleware/jwtAuth.js";

const router = Router();

router.use(jwtAuthMiddleware);

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { keyId } = req.query;
    if (typeof keyId !== "string" || !Types.ObjectId.isValid(keyId)) {
      res.status(400).json({ message: "keyId query param required" });
      return;
    }

    // Confirm the key belongs to this developer before exposing usage rows.
    const owned = await ApiKey.exists({ _id: keyId, developerId: req.developerId });
    if (!owned) {
      res.status(404).json({ message: "Key not found" });
      return;
    }

    let limit = DEFAULT_LIMIT;
    if (typeof req.query.limit === "string") {
      const parsed = parseInt(req.query.limit, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = Math.min(parsed, MAX_LIMIT);
      }
    }

    const entries = await UsageLog.find({
      keyId,
      developerId: req.developerId,
    })
      .sort({ ts: -1 })
      .limit(limit)
      .lean();

    res.json({
      entries: entries.map((e) => ({
        ip: e.ip,
        path: e.path,
        status: e.status,
        ts: e.ts,
      })),
    });
  } catch (err) {
    console.error("usage list error", err);
    res.status(500).json({ message: "Internal error" });
  }
});

export default router;
