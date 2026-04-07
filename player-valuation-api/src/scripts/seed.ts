import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import mongoose from "mongoose";
import { PlayerModel } from "../models/Player.js";
import { TransactionModel } from "../models/Transaction.js";
import { SessionModel } from "../models/Session.js";

/** MLB Stats API team ids (abbrev → id). */
const TID = {
  BOS: 111,
  ARI: 109,
  BAL: 110,
  NYM: 121,
  CIN: 113,
  HOU: 117,
  MIL: 158,
  KCR: 118,
  CLE: 114,
  ATL: 144,
  PHI: 143,
  SDP: 135,
  TOR: 141,
  SEA: 136,
  CWS: 145,
  PIT: 134,
  MIA: 146,
  WSH: 120,
  TEX: 140,
  MIN: 142,
  DET: 116,
  COL: 115,
  NYY: 147,
  LAD: 119,
  TBR: 139,
} as const;

type Abbr = keyof typeof TID;

function hit(
  mlbPlayerId: number,
  name: string,
  abbr: Abbr,
  positions: string[],
  depthRole: string,
  risk: string,
  s: { hr: number; rbi: number; r: number; sb: number; avg: number },
  projGames = 162
) {
  return {
    mlbPlayerId,
    mlbTeamId: TID[abbr],
    name,
    mlbTeam: abbr,
    positions,
    depthRole,
    risk,
    baseValue: 10,
    projGames,
    projHR: s.hr,
    projRBI: s.rbi,
    projR: s.r,
    projSB: s.sb,
    projAVG: s.avg,
  };
}

function pit(
  mlbPlayerId: number,
  name: string,
  abbr: Abbr,
  depthRole: string,
  risk: string,
  s: { w: number; era: number; whip: number; k: number; sv: number; ip: number },
  projGames = 162
) {
  return {
    mlbPlayerId,
    mlbTeamId: TID[abbr],
    name,
    mlbTeam: abbr,
    positions: ["P"],
    depthRole,
    risk,
    baseValue: 10,
    projGames,
    projW: s.w,
    projERA: s.era,
    projWHIP: s.whip,
    projK: s.k,
    projSV: s.sv,
    projIP: s.ip,
  };
}

/** Example MLBAM ids + rotisserie projections for SGP valuation demos. */
const PLAYERS = [
  hit(681001, "Jarren Duran", "BOS", ["OF"], "Starter", "Med", { hr: 18, rbi: 62, r: 88, sb: 28, avg: 0.286 }),
  hit(681002, "Corbin Carroll", "ARI", ["OF"], "Starter", "Med", { hr: 22, rbi: 72, r: 102, sb: 45, avg: 0.278 }),
  hit(681003, "Gunnar Henderson", "BAL", ["SS", "3B"], "Starter", "Low", { hr: 28, rbi: 88, r: 98, sb: 22, avg: 0.282 }),
  hit(681004, "Francisco Lindor", "NYM", ["SS"], "Starter", "Low", { hr: 26, rbi: 82, r: 95, sb: 18, avg: 0.273 }),
  hit(681005, "Elly De La Cruz", "CIN", ["SS", "3B"], "Starter", "High", { hr: 24, rbi: 76, r: 92, sb: 38, avg: 0.268 }),
  hit(681006, "Kyle Tucker", "HOU", ["OF"], "Starter", "Med", { hr: 27, rbi: 95, r: 88, sb: 14, avg: 0.285 }),
  hit(681007, "William Contreras", "MIL", ["C"], "Starter", "Low", { hr: 20, rbi: 72, r: 68, sb: 4, avg: 0.276 }),
  hit(681008, "Adley Rutschman", "BAL", ["C"], "Starter", "Low", { hr: 22, rbi: 78, r: 76, sb: 2, avg: 0.271 }),
  hit(681009, "Matt McLain", "CIN", ["SS", "2B"], "Starter", "High", { hr: 16, rbi: 52, r: 72, sb: 18, avg: 0.262 }),
  hit(681010, "Bobby Witt Jr.", "KCR", ["SS", "3B"], "Starter", "Low", { hr: 32, rbi: 92, r: 108, sb: 42, avg: 0.288 }),
  hit(681011, "Yordan Alvarez", "HOU", ["OF"], "Starter", "Med", { hr: 38, rbi: 108, r: 86, sb: 2, avg: 0.295 }),
  hit(681012, "José Ramírez", "CLE", ["3B"], "Starter", "Low", { hr: 30, rbi: 96, r: 90, sb: 24, avg: 0.284 }),
  hit(681013, "Shohei Ohtani", "LAD", ["OF"], "Starter", "Low", { hr: 42, rbi: 102, r: 98, sb: 18, avg: 0.292 }),
  hit(681014, "Mookie Betts", "LAD", ["OF", "SS"], "Starter", "Med", { hr: 28, rbi: 78, r: 102, sb: 14, avg: 0.278 }),
  hit(681015, "Randy Arozarena", "TBR", ["OF"], "Starter", "Med", { hr: 20, rbi: 72, r: 82, sb: 18, avg: 0.265 }),
  pit(681016, "Zac Gallen", "ARI", "Starter", "Med", { w: 15, era: 3.35, whip: 1.12, k: 198, sv: 0, ip: 195 }),
  pit(681017, "Gerrit Cole", "NYY", "Starter", "High", { w: 14, era: 3.55, whip: 1.08, k: 205, sv: 0, ip: 178 }),
  pit(681018, "Spencer Strider", "ATL", "Starter", "High", { w: 12, era: 3.25, whip: 1.15, k: 210, sv: 0, ip: 165 }),
  pit(681019, "Emmanuel Clase", "CLE", "Starter", "Low", { w: 4, era: 2.85, whip: 1.02, k: 72, sv: 38, ip: 68 }),
  hit(681020, "Pete Alonso", "NYM", ["1B"], "Starter", "Low", { hr: 38, rbi: 102, r: 78, sb: 2, avg: 0.248 }),
  hit(681021, "Freddie Freeman", "LAD", ["1B"], "Starter", "Low", { hr: 28, rbi: 98, r: 92, sb: 8, avg: 0.302 }),
  hit(665742, "Juan Soto", "NYY", ["OF"], "Starter", "Low", { hr: 39, rbi: 105, r: 108, sb: 8, avg: 0.288 }),
  hit(681023, "Aaron Judge", "NYY", ["OF"], "Starter", "Med", { hr: 45, rbi: 112, r: 102, sb: 4, avg: 0.278 }),
  hit(681024, "Ronald Acuña Jr.", "ATL", ["OF"], "Starter", "High", { hr: 32, rbi: 82, r: 108, sb: 38, avg: 0.282 }),
  hit(681025, "Trea Turner", "PHI", ["SS"], "Starter", "Low", { hr: 18, rbi: 68, r: 95, sb: 32, avg: 0.285 }),
  hit(681026, "Bryce Harper", "PHI", ["1B", "OF"], "Starter", "Med", { hr: 32, rbi: 96, r: 88, sb: 8, avg: 0.282 }),
  hit(681027, "Fernando Tatis Jr.", "SDP", ["OF"], "Starter", "Med", { hr: 34, rbi: 88, r: 98, sb: 22, avg: 0.278 }),
  hit(681028, "Vladimir Guerrero Jr.", "TOR", ["1B"], "Starter", "Low", { hr: 32, rbi: 98, r: 82, sb: 4, avg: 0.278 }),
  hit(681029, "Bo Bichette", "TOR", ["SS"], "Starter", "Med", { hr: 22, rbi: 76, r: 88, sb: 12, avg: 0.276 }),
  hit(681030, "Julio Rodríguez", "SEA", ["OF"], "Starter", "Low", { hr: 30, rbi: 88, r: 98, sb: 28, avg: 0.278 }),
  hit(681031, "Cal Raleigh", "SEA", ["C"], "Starter", "Low", { hr: 28, rbi: 82, r: 72, sb: 0, avg: 0.252 }),
  hit(681032, "Luis Robert Jr.", "CWS", ["OF"], "Starter", "High", { hr: 24, rbi: 72, r: 78, sb: 22, avg: 0.268 }),
  pit(681033, "Paul Skenes", "PIT", "Starter", "Med", { w: 13, era: 3.05, whip: 1.05, k: 195, sv: 0, ip: 172 }),
  hit(681034, "Oneil Cruz", "PIT", ["SS"], "Starter", "High", { hr: 26, rbi: 78, r: 82, sb: 18, avg: 0.262 }),
  hit(681035, "Nolan Jones", "COL", ["OF"], "Starter", "Med", { hr: 22, rbi: 76, r: 78, sb: 12, avg: 0.272 }),
  pit(681036, "Eury Pérez", "MIA", "Starter", "High", { w: 11, era: 3.45, whip: 1.18, k: 168, sv: 0, ip: 148 }),
  hit(681037, "Jazz Chisholm Jr.", "MIA", ["OF", "2B"], "Starter", "Med", { hr: 24, rbi: 72, r: 82, sb: 28, avg: 0.265 }),
  hit(681038, "CJ Abrams", "WSH", ["SS"], "Starter", "Low", { hr: 18, rbi: 62, r: 88, sb: 38, avg: 0.268 }),
  hit(681039, "Jackson Holliday", "BAL", ["SS", "2B"], "Backup", "High", { hr: 10, rbi: 42, r: 58, sb: 10, avg: 0.248 }, 130),
  hit(681040, "Evan Carter", "TEX", ["OF"], "Starter", "Med", { hr: 16, rbi: 58, r: 72, sb: 14, avg: 0.262 }),
  hit(681041, "Josh Jung", "TEX", ["3B"], "Starter", "High", { hr: 22, rbi: 76, r: 68, sb: 2, avg: 0.258 }),
  hit(681042, "Royce Lewis", "MIN", ["3B"], "Starter", "High", { hr: 24, rbi: 78, r: 72, sb: 8, avg: 0.268 }),
  pit(681043, "Tarik Skubal", "DET", "Starter", "Low", { w: 16, era: 2.95, whip: 1.02, k: 215, sv: 0, ip: 198 }),
  hit(681044, "Riley Greene", "DET", ["OF"], "Starter", "Med", { hr: 22, rbi: 72, r: 82, sb: 8, avg: 0.272 }),
  hit(681045, "Bryan Reynolds", "PIT", ["OF"], "Starter", "Low", { hr: 24, rbi: 82, r: 78, sb: 6, avg: 0.278 }),
  hit(681046, "Christian Yelich", "MIL", ["OF"], "Starter", "Med", { hr: 20, rbi: 72, r: 82, sb: 12, avg: 0.272 }),
];

const TRANSACTIONS = [
  { title: "Placed on 60-day IL", date: new Date("2025-03-01"), source: "MLB" },
  { title: "Signed to extension", date: new Date("2025-02-28"), source: "MLB" },
  { title: "Traded to new team", date: new Date("2025-02-25"), source: "MLB" },
  { title: "Optioned to minors", date: new Date("2025-03-02"), source: "MLB" },
  { title: "Activated from IL", date: new Date("2025-02-20"), source: "MLB" },
  { title: "Placed on 15-day IL", date: new Date("2025-03-03"), source: "MLB" },
  { title: "Designated for assignment", date: new Date("2025-02-22"), source: "MLB" },
  { title: "Recalled from minors", date: new Date("2025-03-04"), source: "MLB" },
];

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Set MONGODB_URI in .env");
    console.error("  - File must be: player-valuation-api/.env");
    console.error("  - Format: MONGODB_URI=mongodb+srv://... (no spaces around =)");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("Connected to MongoDB.");

  await PlayerModel.deleteMany({});
  await TransactionModel.deleteMany({});
  await SessionModel.deleteMany({});

  const inserted = await PlayerModel.insertMany(PLAYERS);
  console.log(`Inserted ${inserted.length} players.`);

  const txWithPlayer = TRANSACTIONS.map((t, i) => ({
    ...t,
    playerId: inserted[i % inserted.length]._id,
  }));
  await TransactionModel.insertMany(txWithPlayer);
  console.log(`Inserted ${txWithPlayer.length} transactions.`);

  await mongoose.disconnect();
  console.log("Seed done.");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
