import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import mongoose from "mongoose";
import { PlayerModel } from "../models/Player.js";
import { TransactionModel } from "../models/Transaction.js";
import { SessionModel } from "../models/Session.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InjuryStatusValue =
  | "Active" | "Day-to-Day"
  | "10-Day IL" | "15-Day IL" | "60-Day IL"
  | "Out for Season" | "Suspended";

interface FgStats { [key: string]: number | null | undefined }

interface FgPlayer {
  name: string;
  mlbamId: number;
  isPitcher: boolean;
  projStats: FgStats | null;
  prevStats: FgStats | null;
}

interface ProjectionsFile {
  players: Record<string, FgPlayer>;
}

interface RosterInfo {
  teamAbbr: string;
  teamId: number;
  statusDesc: string;
  positionAbbr: string;
}

interface PersonDetail {
  age: number;
  bats: string;
  throws: string;
}

// ---------------------------------------------------------------------------
// MLB team IDs
// ---------------------------------------------------------------------------

const TID: Record<string, number> = {
  ARI: 109, ATL: 144, BAL: 110, BOS: 111, CHC: 112, CWS: 145,
  CIN: 113, CLE: 114, COL: 115, DET: 116, HOU: 117, KCR: 118,
  LAA: 108, LAD: 119, MIA: 146, MIL: 158, MIN: 142, NYM: 121,
  NYY: 147, OAK: 133, PHI: 143, PIT: 134, SDP: 135, SFG: 137,
  SEA: 136, STL: 138, TBR: 139, TEX: 140, TOR: 141, WSH: 120,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MLB_API = "https://statsapi.mlb.com/api/v1";

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function mapInjuryStatus(description: string): InjuryStatusValue {
  const d = description.toLowerCase();
  if (d.includes("day-to-day")) return "Day-to-Day";
  if (d.includes("10-day")) return "10-Day IL";
  if (d.includes("15-day")) return "15-Day IL";
  if (d.includes("60-day")) return "60-Day IL";
  if (d.includes("suspend")) return "Suspended";
  if (d.includes("restricted") || d.includes("bereavement") || d.includes("paternity")) return "Active";
  if (d.includes("season") || d.includes("temporarily inactive")) return "Out for Season";
  return "Active";
}

function mapPosition(mlbAbbr: string): string {
  if (["LF", "CF", "RF"].includes(mlbAbbr)) return "OF";
  if (["SP", "RP"].includes(mlbAbbr)) return "P";
  if (mlbAbbr === "DH") return "U";
  return mlbAbbr; // 1B, 2B, 3B, SS, C, P already match
}

function riskFromInjury(status: InjuryStatusValue): "Low" | "Med" | "High" {
  if (status === "Active") return "Low";
  if (status === "Day-to-Day") return "Med";
  return "High";
}

// ---------------------------------------------------------------------------
// MLB Stats API fetchers
// ---------------------------------------------------------------------------

async function fetchRosterMap(): Promise<Map<number, RosterInfo>> {
  const map = new Map<number, RosterInfo>();
  const teams = Object.entries(TID);

  console.log(`Fetching 40-man rosters for ${teams.length} teams...`);
  for (let i = 0; i < teams.length; i++) {
    const [abbr, teamId] = teams[i];
    try {
      const data = await fetchJson(
        `${MLB_API}/teams/${teamId}/roster?rosterType=40Man&season=2026`
      ) as { roster?: any[] };
      for (const entry of data.roster ?? []) {
        const pid: number = entry.person?.id;
        if (!pid) continue;
        map.set(pid, {
          teamAbbr: abbr,
          teamId,
          statusDesc: entry.status?.description ?? "Active",
          positionAbbr: entry.position?.abbreviation ?? "",
        });
      }
    } catch (e) {
      console.warn(`  Warning: roster fetch failed for ${abbr}`);
    }
    if (i < teams.length - 1) await delay(120);
  }
  console.log(`  Found ${map.size} players across all rosters.`);
  return map;
}

async function fetchPersonDetails(ids: number[]): Promise<Map<number, PersonDetail>> {
  const map = new Map<number, PersonDetail>();
  const chunkSize = 50;

  console.log(`Fetching person details for ${ids.length} players...`);
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    try {
      const data = await fetchJson(
        `${MLB_API}/people?personIds=${chunk.join(",")}`
      ) as { people?: any[] };
      for (const p of data.people ?? []) {
        map.set(p.id, {
          age: p.currentAge ?? 0,
          bats: p.batSide?.code ?? "",
          throws: p.pitchHand?.code ?? "",
        });
      }
    } catch (e) {
      console.warn(`  Warning: person details failed for chunk at index ${i}`);
    }
    if (i + chunkSize < ids.length) await delay(150);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Build player document
// ---------------------------------------------------------------------------

function buildPlayerDoc(
  mlbamId: number,
  roster: RosterInfo,
  person: PersonDetail | undefined,
  fg: FgPlayer | undefined,
): object {
  const injuryStatus = mapInjuryStatus(roster.statusDesc);
  const position = mapPosition(roster.positionAbbr);
  const isPitcher = position === "P" || fg?.isPitcher === true;

  const doc: Record<string, unknown> = {
    mlbPlayerId: mlbamId,
    mlbTeamId: roster.teamId,
    name: fg?.name ?? `Player ${mlbamId}`,
    mlbTeam: roster.teamAbbr,
    positions: [position],
    depthRole: "Starter",
    risk: riskFromInjury(injuryStatus),
    isEligible: true,
    projGames: injuryStatus === "60-Day IL" || injuryStatus === "Out for Season" ? 100 : 162,
    age: person?.age ?? null,
    injuryStatus,
    injuryNote: null,
    injuryReturn: null,
  };

  if (person?.bats) doc.bats = person.bats;
  if (person?.throws) doc.throws = person.throws;

  // 2026 projected stats
  if (fg?.projStats) {
    const p = fg.projStats;
    if (isPitcher) {
      doc.projW    = p.w    ?? undefined;
      doc.projERA  = p.era  ?? undefined;
      doc.projWHIP = p.whip ?? undefined;
      doc.projK    = p.k    ?? undefined;
      doc.projSV   = p.sv   ?? undefined;
      doc.projIP   = p.ip   ?? undefined;
    } else {
      doc.projHR  = p.hr  ?? undefined;
      doc.projRBI = p.rbi ?? undefined;
      doc.projR   = p.r   ?? undefined;
      doc.projSB  = p.sb  ?? undefined;
      doc.projAVG = p.avg ?? undefined;
    }
  }

  // 2025 actual stats
  if (fg?.prevStats) {
    const p = fg.prevStats;
    if (isPitcher) {
      doc.prevW    = p.w    ?? undefined;
      doc.prevERA  = p.era  ?? undefined;
      doc.prevWHIP = p.whip ?? undefined;
      doc.prevK    = p.k    ?? undefined;
      doc.prevSV   = p.sv   ?? undefined;
      doc.prevIP   = p.ip   ?? undefined;
    } else {
      doc.prevGames = p.games ?? undefined;
      doc.prevHR    = p.hr    ?? undefined;
      doc.prevRBI   = p.rbi   ?? undefined;
      doc.prevR     = p.r     ?? undefined;
      doc.prevSB    = p.sb    ?? undefined;
      doc.prevAVG   = p.avg   ?? undefined;
    }
  }

  return doc;
}

// ---------------------------------------------------------------------------
// Seed transactions (unchanged from original)
// ---------------------------------------------------------------------------

const TRANSACTIONS = [
  { title: "Placed on 60-day IL",        date: new Date("2025-03-01"), source: "MLB" },
  { title: "Signed to extension",        date: new Date("2025-02-28"), source: "MLB" },
  { title: "Traded to new team",         date: new Date("2025-02-25"), source: "MLB" },
  { title: "Optioned to minors",         date: new Date("2025-03-02"), source: "MLB" },
  { title: "Activated from IL",          date: new Date("2025-02-20"), source: "MLB" },
  { title: "Placed on 15-day IL",        date: new Date("2025-03-03"), source: "MLB" },
  { title: "Designated for assignment",  date: new Date("2025-02-22"), source: "MLB" },
  { title: "Recalled from minors",       date: new Date("2025-03-04"), source: "MLB" },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Set MONGODB_URI in player-valuation-api/.env");
    process.exit(1);
  }

  // Load projections.json if present
  const projPath = path.resolve(__dirname, "projections.json");
  let fgPlayers: Record<string, FgPlayer> = {};
  if (fs.existsSync(projPath)) {
    const raw = JSON.parse(fs.readFileSync(projPath, "utf-8")) as ProjectionsFile;
    fgPlayers = raw.players ?? {};
    console.log(`Loaded ${Object.keys(fgPlayers).length} players from projections.json`);
  } else {
    console.warn(
      "projections.json not found — seeding without FanGraphs stats.\n" +
      "Run fetch_projections.py first to include projections and 2025 stats."
    );
  }

  // Fetch roster map (player → team + injury status)
  const rosterMap = await fetchRosterMap();

  // Fetch player ages and handedness
  const allIds = [...rosterMap.keys()];
  const personMap = await fetchPersonDetails(allIds);

  // Merge into player documents
  console.log("Building player documents...");
  const docs: object[] = [];

  for (const [mlbamId, roster] of rosterMap) {
    const fg = fgPlayers[String(mlbamId)];
    const person = personMap.get(mlbamId);
    docs.push(buildPlayerDoc(mlbamId, roster, person, fg));
  }

  // Also add any FanGraphs players that weren't on a 40-man roster
  // (e.g., recently promoted or minor-league-contract players with projections)
  for (const [idStr, fg] of Object.entries(fgPlayers)) {
    const mlbamId = Number(idStr);
    if (!rosterMap.has(mlbamId)) {
      // Skip if no roster info — can't assign a team
    }
  }

  // Connect and seed
  await mongoose.connect(uri);
  console.log("Connected to MongoDB.");

  await PlayerModel.deleteMany({});
  await TransactionModel.deleteMany({});
  await SessionModel.deleteMany({});

  const inserted = await PlayerModel.insertMany(docs, { ordered: false });
  console.log(`Inserted ${inserted.length} players.`);

  const txWithPlayer = TRANSACTIONS.map((t, i) => ({
    ...t,
    playerId: inserted[i % inserted.length]._id,
  }));
  await TransactionModel.insertMany(txWithPlayer);
  console.log(`Inserted ${txWithPlayer.length} transactions.`);

  await mongoose.disconnect();
  console.log("Seed complete.");
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
