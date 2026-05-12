import Papa from "papaparse";

export interface FgStats {
  [key: string]: number | null | undefined;
}

export interface FgPlayer {
  name: string;
  mlbamId: number;
  /** True if the player has hitter projections or 2025 hitter stats. */
  isHitter: boolean;
  /** True if the player has pitcher projections or 2025 pitcher stats. */
  isPitcher: boolean;
  projHittingStats: FgStats | null;
  projPitchingStats: FgStats | null;
  prevHittingStats: FgStats | null;
  prevPitchingStats: FgStats | null;
  savantStats?: FgStats | null;
}

function emptyPlayer(mid: number, name: string): FgPlayer {
  return {
    name,
    mlbamId: mid,
    isHitter: false,
    isPitcher: false,
    projHittingStats: null,
    projPitchingStats: null,
    prevHittingStats: null,
    prevPitchingStats: null,
  };
}

function getOrCreate(map: Map<number, FgPlayer>, mid: number, name: string): FgPlayer {
  let p = map.get(mid);
  if (!p) {
    p = emptyPlayer(mid, name);
    map.set(mid, p);
  } else if (!p.name && name) {
    p.name = name;
  }
  return p;
}

function pos(v: number | null | undefined): number {
  return v != null && Number.isFinite(v) ? Math.max(0, v) : 0;
}

/**
 * Role-specific volume thresholds. FanGraphs's feeds emit rows for marginal cross-role
 * appearances — e.g. a pitcher who got one PA in 2025 shows up in prev-hitters with
 * games=1 and all other batting stats = 0. A generic "any field > 0" check accepts those
 * spurious rows, flagging the pitcher as `isHitter` and triggering a phantom DH tag.
 * The thresholds below filter to players with real batting/pitching volume.
 */
function isMeaningfulHitterStats(s: FgStats): boolean {
  // Real hitters project/produce at least 1 HR or non-trivial run/RBI/SB volume.
  // Pure pitchers in cross-role feed rows have HR=R=RBI=SB=0.
  return pos(s.hr) >= 1 || pos(s.rbi) >= 5 || pos(s.r) >= 5 || pos(s.sb) >= 3;
}

function isMeaningfulPitcherStats(s: FgStats): boolean {
  // Real pitchers project/produce non-trivial IP, K, or saves.
  return pos(s.ip) >= 5 || pos(s.k) >= 5 || pos(s.w) >= 1 || pos(s.sv) >= 1;
}

const FG_BASE = "https://www.fangraphs.com/api";

const FG_ENDPOINTS = {
  proj_hitters:  `${FG_BASE}/projections?type=steamer&stats=bat&pos=all&team=0&players=0&lg=all`,
  proj_pitchers: `${FG_BASE}/projections?type=steamer&stats=pit&pos=all&team=0&players=0&lg=all`,
  prev_hitters:  `${FG_BASE}/leaders/major-league/data?pos=all&stats=bat&lg=all&qual=0&season=2025&season1=2025&month=0&hand=&team=0&pageitems=2000&pagenum=1&type=8&ind=0`,
  prev_pitchers: `${FG_BASE}/leaders/major-league/data?pos=all&stats=pit&lg=all&qual=0&season=2025&season1=2025&month=0&hand=&team=0&pageitems=2000&pagenum=1&type=8&ind=0`,
};

const SAVANT_ENDPOINTS = {
  hit_xstats:   "https://baseballsavant.mlb.com/leaderboard/custom?year=2025&type=batter&filter=&sort=4&sortDir=desc&min=25&selections=xba,xslg,xwoba,barrel_batted_rate,hard_hit_percent,exit_velocity_avg,k_percent,bb_percent&chart=false&csv=true",
  pit_xstats:   "https://baseballsavant.mlb.com/leaderboard/custom?year=2025&type=pitcher&filter=&sort=4&sortDir=desc&min=25&selections=xera,whiff_percent,barrel_batted_rate,hard_hit_percent,exit_velocity_avg,k_percent,bb_percent&chart=false&csv=true",
  sprint_speed: "https://baseballsavant.mlb.com/leaderboard/sprint_speed?year=2025&position=&team=&min=0&csv=true",
};

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Referer: "https://www.fangraphs.com/",
  Accept: "application/json",
};

type Row = Record<string, unknown>;

async function fetchJsonRows(url: string, label: string): Promise<Row[]> {
  console.log(`  Fetching ${label}...`);
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: unknown = await res.json();
    if (Array.isArray(data)) return data as Row[];
    if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      for (const key of ["data", "people", "players"]) {
        if (Array.isArray(obj[key])) return obj[key] as Row[];
      }
    }
    console.warn(`  WARNING: unexpected response shape for ${label}`);
    return [];
  } catch (e) {
    console.warn(`  ERROR fetching ${label}: ${(e as Error).message}`);
    return [];
  }
}

async function fetchCsvRows(url: string, label: string): Promise<Row[]> {
  console.log(`  Fetching ${label}...`);
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let text = await res.text();
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
    const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });
    return parsed.data;
  } catch (e) {
    console.warn(`  ERROR fetching ${label}: ${(e as Error).message}`);
    return [];
  }
}

function getField(row: Row, ...keys: string[]): unknown {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function mlbamId(row: Row): number | null {
  const v = getField(row, "MLBAMID", "mlbamid", "xMLBAMID", "mlb_id", "MLBID");
  if (v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function playerName(row: Row): string {
  const v = getField(row, "PlayerName", "Name", "name", "fullName");
  return v == null ? "" : String(v);
}

function safeFloat(row: Row, digits: number, ...keys: string[]): number | null {
  const v = getField(row, ...keys);
  if (v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const mult = 10 ** digits;
  return Math.round(n * mult) / mult;
}

function safeInt(row: Row, ...keys: string[]): number | null {
  const v = getField(row, ...keys);
  if (v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function buildHitterProj(row: Row): FgStats {
  return {
    g:   safeInt(row, "G"),
    hr:  safeInt(row, "HR"),
    rbi: safeInt(row, "RBI"),
    r:   safeInt(row, "R"),
    sb:  safeInt(row, "SB"),
    avg: safeFloat(row, 3, "AVG"),
  };
}

function buildPitcherProj(row: Row): FgStats {
  return {
    w:    safeInt(row, "W"),
    era:  safeFloat(row, 2, "ERA"),
    whip: safeFloat(row, 2, "WHIP"),
    k:    safeInt(row, "SO", "K", "SO9"),
    sv:   safeInt(row, "SV"),
    ip:   safeFloat(row, 1, "IP"),
  };
}

function buildHitterPrev(row: Row): FgStats {
  return {
    games: safeInt(row, "G"),
    hr:    safeInt(row, "HR"),
    rbi:   safeInt(row, "RBI"),
    r:     safeInt(row, "R"),
    sb:    safeInt(row, "SB"),
    avg:   safeFloat(row, 3, "AVG"),
  };
}

function buildPitcherPrev(row: Row): FgStats {
  return {
    w:    safeInt(row, "W"),
    era:  safeFloat(row, 2, "ERA"),
    whip: safeFloat(row, 2, "WHIP"),
    k:    safeInt(row, "SO", "K"),
    sv:   safeInt(row, "SV"),
    ip:   safeFloat(row, 1, "IP"),
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchProjections(): Promise<Record<string, FgPlayer>> {
  const players = new Map<number, FgPlayer>();

  // --- 2026 Steamer projections ---
  // Two-way players (e.g. Ohtani) appear in BOTH feeds; we set role-specific fields
  // rather than overwriting, so both stat sets land on the same FgPlayer.
  for (const row of await fetchJsonRows(FG_ENDPOINTS.proj_hitters, "2026 Steamer hitter projections")) {
    const mid = mlbamId(row);
    if (!mid) continue;
    const stats = buildHitterProj(row);
    if (!isMeaningfulHitterStats(stats)) continue;
    const p = getOrCreate(players, mid, playerName(row));
    p.isHitter = true;
    p.projHittingStats = stats;
  }
  await delay(1000);

  for (const row of await fetchJsonRows(FG_ENDPOINTS.proj_pitchers, "2026 Steamer pitcher projections")) {
    const mid = mlbamId(row);
    if (!mid) continue;
    const stats = buildPitcherProj(row);
    if (!isMeaningfulPitcherStats(stats)) continue;
    const p = getOrCreate(players, mid, playerName(row));
    p.isPitcher = true;
    p.projPitchingStats = stats;
  }
  await delay(1000);

  // --- 2025 actual stats ---
  for (const row of await fetchJsonRows(FG_ENDPOINTS.prev_hitters, "2025 actual hitter stats")) {
    const mid = mlbamId(row);
    if (!mid) continue;
    const stats = buildHitterPrev(row);
    if (!isMeaningfulHitterStats(stats)) continue;
    const p = getOrCreate(players, mid, playerName(row));
    p.isHitter = true;
    p.prevHittingStats = stats;
  }
  await delay(1000);

  for (const row of await fetchJsonRows(FG_ENDPOINTS.prev_pitchers, "2025 actual pitcher stats")) {
    const mid = mlbamId(row);
    if (!mid) continue;
    const stats = buildPitcherPrev(row);
    if (!isMeaningfulPitcherStats(stats)) continue;
    const p = getOrCreate(players, mid, playerName(row));
    p.isPitcher = true;
    p.prevPitchingStats = stats;
  }
  await delay(1000);

  // --- Baseball Savant: hitter xStats ---
  let savantHitCount = 0;
  for (const row of await fetchCsvRows(SAVANT_ENDPOINTS.hit_xstats, "2025 Savant hitter xStats")) {
    const mid = Number(row.player_id);
    if (!Number.isFinite(mid) || !mid) continue;
    const stats: FgStats = {
      xba:        safeFloat(row, 3, "xba"),
      xslg:       safeFloat(row, 3, "xslg"),
      xwoba:      safeFloat(row, 3, "xwoba"),
      barrelPct:  safeFloat(row, 1, "barrel_batted_rate"),
      hardHitPct: safeFloat(row, 1, "hard_hit_percent"),
      exitVelo:   safeFloat(row, 1, "exit_velocity_avg"),
      kPct:       safeFloat(row, 1, "k_percent"),
      bbPct:      safeFloat(row, 1, "bb_percent"),
    };
    const p = getOrCreate(players, mid, String(row.player_name ?? `Player ${mid}`));
    // Don't set isHitter from Savant — role flags should reflect projection/actual stat
    // presence, not Statcast enrichment which can include borderline-PA players.
    p.savantStats = { ...(p.savantStats ?? {}), ...stats };
    savantHitCount++;
  }
  console.log(`  Merged Savant xStats for ${savantHitCount} hitters.`);
  await delay(1000);

  // --- Baseball Savant: pitcher xStats ---
  let savantPitCount = 0;
  for (const row of await fetchCsvRows(SAVANT_ENDPOINTS.pit_xstats, "2025 Savant pitcher xStats")) {
    const mid = Number(row.player_id);
    if (!Number.isFinite(mid) || !mid) continue;
    const stats: FgStats = {
      xera:              safeFloat(row, 2, "xera"),
      whiffPct:          safeFloat(row, 1, "whiff_percent"),
      barrelPctAgainst:  safeFloat(row, 1, "barrel_batted_rate"),
      hardHitPctAgainst: safeFloat(row, 1, "hard_hit_percent"),
      exitVeloAgainst:   safeFloat(row, 1, "exit_velocity_avg"),
      kPct:              safeFloat(row, 1, "k_percent"),
      bbPct:             safeFloat(row, 1, "bb_percent"),
    };
    const p = getOrCreate(players, mid, String(row.player_name ?? `Player ${mid}`));
    // Same as the hitter Savant block — flag is driven by FG stat presence, not Savant.
    p.savantStats = { ...(p.savantStats ?? {}), ...stats };
    savantPitCount++;
  }
  console.log(`  Merged Savant xStats for ${savantPitCount} pitchers.`);
  await delay(1000);

  // --- Baseball Savant: sprint speed (hitters only) ---
  let sprintCount = 0;
  for (const row of await fetchCsvRows(SAVANT_ENDPOINTS.sprint_speed, "2025 Savant sprint speed")) {
    const mid = Number(row.player_id);
    if (!Number.isFinite(mid) || !mid) continue;
    const existing = players.get(mid);
    if (!existing) continue;
    const speed = safeFloat(row, 1, "sprint_speed", "hp_to_1b");
    if (speed !== null) {
      if (!existing.savantStats) existing.savantStats = {};
      existing.savantStats.sprintSpeed = speed;
      sprintCount++;
    }
  }
  console.log(`  Merged sprint speed for ${sprintCount} players.`);

  const out: Record<string, FgPlayer> = {};
  for (const [mid, p] of players) out[String(mid)] = p;
  return out;
}
