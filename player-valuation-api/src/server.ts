import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import { apiKeyMiddleware } from "./middleware/apiKey.js";
import playersRouter from "./routes/players.js";
import transactionsRouter from "./routes/transactions.js";
import sessionsRouter from "./routes/sessions.js";
import valuationsRouter from "./routes/valuations.js";
import devAuthRouter from "./routes/devAuth.js";
import devKeysRouter from "./routes/devKeys.js";

const PORT = process.env.PORT ?? 4000;
const MONGODB_URI = process.env.MONGODB_URI;

async function start() {
  if (!MONGODB_URI) {
    console.error("Missing MONGODB_URI in environment.");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB connected.");
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  }

  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "player-valuation-api" });
  });

  // Developer portal endpoints (own JWT auth via cookie); mounted BEFORE the
  // license-key middleware so developers can register/log in without a key.
  app.use("/dev/auth", devAuthRouter);
  app.use("/dev/keys", devKeysRouter);

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
