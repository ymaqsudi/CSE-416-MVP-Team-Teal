export type MlbLeague = "AL" | "NL";

export const MLB_LEAGUE_BY_TEAM: Record<string, MlbLeague> = {
  BAL: "AL", BOS: "AL", NYY: "AL", TBR: "AL", TOR: "AL",
  CWS: "AL", CLE: "AL", DET: "AL", KCR: "AL", MIN: "AL",
  HOU: "AL", LAA: "AL", OAK: "AL", SEA: "AL", TEX: "AL",
  ATL: "NL", MIA: "NL", NYM: "NL", PHI: "NL", WSH: "NL",
  CHC: "NL", CIN: "NL", MIL: "NL", PIT: "NL", STL: "NL",
  ARI: "NL", COL: "NL", LAD: "NL", SDP: "NL", SFG: "NL",
};

export function isTeamInLeague(mlbTeam: string | undefined, league: MlbLeague): boolean {
  if (!mlbTeam) return false;
  return MLB_LEAGUE_BY_TEAM[mlbTeam] === league;
}
