import mongoose from "mongoose";
import { PlayerModel } from "../models/Player.js";

export async function findPlayerByRequestId(id: string) {
  const trimmed = id.trim();
  if (mongoose.isValidObjectId(trimmed)) {
    const p = await PlayerModel.findById(trimmed).lean().exec();
    if (p) return p;
  }
  const mlb = parseInt(trimmed, 10);
  if (Number.isFinite(mlb) && String(mlb) === trimmed) {
    const p = await PlayerModel.findOne({ mlbPlayerId: mlb }).lean().exec();
    if (p) return p;
  }
  return null;
}

export type ParsedPlayerRef =
  | { kind: "mlb"; id: number; internalId: string }
  | { kind: "mongo"; id: string; internalId: string }
  | { kind: "custom"; internalId: string };

/** Accepts MLB-660271, raw number, Mongo ObjectId, or custom string (MiLB-...). */
export function parsePlayerRef(ref: string): ParsedPlayerRef {
  const s = String(ref).trim();
  const mlbPref = /^MLB-(\d+)$/i.exec(s);
  if (mlbPref) {
    return { kind: "mlb", id: parseInt(mlbPref[1], 10), internalId: s };
  }
  if (/^[a-f0-9]{24}$/i.test(s)) {
    return { kind: "mongo", id: s, internalId: s };
  }
  const n = parseInt(s, 10);
  if (Number.isFinite(n) && String(n) === s && n > 0) {
    return { kind: "mlb", id: n, internalId: s };
  }
  return { kind: "custom", internalId: s };
}

export async function findPlayerByParsedRef(parsed: ParsedPlayerRef) {
  if (parsed.kind === "mongo") {
    return PlayerModel.findById(parsed.id).lean().exec();
  }
  if (parsed.kind === "mlb") {
    return PlayerModel.findOne({ mlbPlayerId: parsed.id }).lean().exec();
  }
  return null;
}
