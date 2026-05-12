export type MlbLeague = "AL" | "NL";

export const MLB_LEAGUE_BY_TEAM: Record<string, MlbLeague> = {
  BAL: "AL", BOS: "AL", NYY: "AL", TBR: "AL", TOR: "AL",
  CWS: "AL", CLE: "AL", DET: "AL", KCR: "AL", MIN: "AL",
  HOU: "AL", LAA: "AL", OAK: "AL", SEA: "AL", TEX: "AL",
  ATL: "NL", MIA: "NL", NYM: "NL", PHI: "NL", WSH: "NL",
  CHC: "NL", CIN: "NL", MIL: "NL", PIT: "NL", STL: "NL",
  ARI: "NL", COL: "NL", LAD: "NL", SDP: "NL", SFG: "NL",
};

export type LeagueScope = "MLB" | "AL" | "NL";

export function isTeamInScope(mlbTeam: string | undefined, scope: LeagueScope): boolean {
  if (scope === "MLB") return true;
  if (!mlbTeam) return false;
  return MLB_LEAGUE_BY_TEAM[mlbTeam] === scope;
}

export function filterPlayersByScope<T extends { mlbTeam?: string }>(
  players: T[],
  scope: LeagueScope,
): T[] {
  if (scope === "MLB") return players;
  return players.filter((p) => isTeamInScope(p.mlbTeam, scope));
}