import "dotenv/config";
import path from "path";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import { PlayerModel } from "./models/Player.js";
import { apiKeyMiddleware } from "./middleware/apiKey.js";
import playersRouter from "./routes/players.js";
import transactionsRouter from "./routes/transactions.js";
import sessionsRouter from "./routes/sessions.js";
import valuationsRouter from "./routes/valuations.js";
import devAuthRouter from "./routes/devAuth.js";
import devKeysRouter from "./routes/devKeys.js";
import devUsageRouter from "./routes/devUsage.js";

// `__dirname` is the directory of this compiled file (src/ in dev, dist/ in prod);
// the portal lives at <project-root>/public/portal in both cases.
const PORTAL_DIR = path.resolve(__dirname, "../public/portal");

const PORT = process.env.PORT ?? 4000;
const MONGODB_URI = process.env.MONGODB_URI;

async function start() {
  if (!MONGODB_URI) {
    console.error("Missing MONGODB_URI in environment.");
    process.exit(1);
  }
  if (!process.env.JWT_SECRET) {
    console.error("Missing JWT_SECRET in environment.");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB connected.");
    // STAGE 1 DIAGNOSTIC — capture the actual seeded player count so perf measurements have an anchor.
    const playerCount = await PlayerModel.countDocuments({});
    console.log(`[startup] PlayerModel.countDocuments = ${playerCount}`);
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  }

  const app = express();
  // Required for accurate req.ip when running behind a proxy/load balancer
  // (Render, Vercel, nginx, etc.). Without this, req.ip is the proxy's IP.
  app.set("trust proxy", 1);
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "player-valuation-api" });
  });

  // Developer portal: static UI + JWT-cookie-protected /dev/* APIs. Mounted
  // BEFORE the license-key middleware so developers can register / log in /
  // manage keys without holding a license key.
  app.use("/portal", express.static(PORTAL_DIR));
  app.use("/dev/auth", devAuthRouter);
  app.use("/dev/keys", devKeysRouter);
  app.use("/dev/usage", devUsageRouter);

  app.use(apiKeyMiddleware);

  app.use("/sessions", sessionsRouter);
  app.use("/valuations", valuationsRouter);
  app.use("/players", playersRouter);
  app.use("/transactions", transactionsRouter);

  app.listen(PORT, () => {
    console.log(`Player Valuation API listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
