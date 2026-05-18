"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2 } from "lucide-react";
import { isEligibleForSlot } from "@/lib/shared/eligibility";

type Team = { id: string; name: string };

type League = {
  _id: string;
  leagueName: string;
  budget: number;
  teams?: Team[];
  myTeamId?: string;
  rosterSlots?: Record<string, number>;
};

type RosterEntry = {
  _id: string;
  playerId: string;
  playerName: string;
  mlbTeam: string;
  positions: string[];
  position: string;
  price: number;
  isKeeper?: boolean;
};

const SLOT_ORDER = ["C", "1B", "2B", "3B", "SS", "MI", "CI", "OF", "UTIL", "P"] as const;

export default function RosterPage() {
  const [token, setToken] = useState<string | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [teamName, setTeamName] = useState<string>("");

  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [leaguesLoading, setLeaguesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unassigning, setUnassigning] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("draftkit_token");
    setToken(t);
  }, []);

  const fetchRoster = useCallback(
    async (leagueId: string, team: string) => {
      if (!token || !leagueId || !team.trim()) return;
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `/api/leagues/${leagueId}/roster?teamName=${encodeURIComponent(team.trim())}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to load roster.");
          setRoster([]);
        } else {
          setRoster(data.roster ?? []);
        }
      } catch (e) {
        console.error(e);
        setError("Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!token) {
      setLeaguesLoading(false);
      return;
    }
    async function fetchLeagues() {
      try {
        const res = await fetch("/api/leagues", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          const fetchedLeagues: League[] = data.leagues ?? [];
          if (fetchedLeagues.length > 0) {
            const storedLeagueId = localStorage.getItem("draftkit_leagueId");
            const active =
              fetchedLeagues.find((l) => l._id === storedLeagueId) ??
              fetchedLeagues[0];
            setLeague(active);
            localStorage.setItem("draftkit_leagueId", active._id);

            // Default to the user's own team if one is configured.
            const myTeam = (active.teams ?? []).find(
              (t) => t.id === active.myTeamId,
            );
            const defaultTeamName = myTeam?.name ?? active.teams?.[0]?.name ?? "";
            if (defaultTeamName) {
              setTeamName(defaultTeamName);
              fetchRoster(active._id, defaultTeamName);
            }
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLeaguesLoading(false);
      }
    }
    fetchLeagues();
  }, [token, fetchRoster]);

  function handleTeamChange(name: string) {
    setTeamName(name);
    setRoster([]);
    setError(null);
    if (league) fetchRoster(league._id, name);
  }

  async function handleMove(entry: RosterEntry, target: string) {
    if (!token || !league || target === entry.position) return;
    setMoving(entry._id);
    try {
      const url = entry.isKeeper
        ? `/api/players/${entry.playerId}/assignment`
        : `/api/leagues/${league._id}/picks/${entry._id}`;
      const body = entry.isKeeper
        ? {
            leagueId: league._id,
            teamName,
            fromPosition: entry.position,
            toPosition: target,
          }
        : { position: target };
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchRoster(league._id, teamName);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to move player.");
      }
    } catch (e) {
      console.error(e);
      setError("Something went wrong.");
    } finally {
      setMoving(null);
    }
  }

  async function handleUnassign(entry: RosterEntry) {
    if (!token || !league) return;
    setUnassigning(entry._id);
    try {
      const res = await fetch(
        `/api/players/${entry.playerId}/assignment?leagueId=${league._id}&teamName=${encodeURIComponent(teamName)}&position=${encodeURIComponent(entry.position)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        setRoster((prev) => prev.filter((r) => r._id !== entry._id));
      } else {
        const data = await res.json();
        setError(data.error || "Failed to unassign player.");
      }
    } catch (e) {
      console.error(e);
      setError("Something went wrong.");
    } finally {
      setUnassigning(null);
    }
  }

  const budget = league?.budget ?? 0;
  const spent = roster.reduce((sum, r) => sum + r.price, 0);
  const remaining = budget - spent;
  const maxBid = Math.max(remaining - 1, 0);
  const teams = league?.teams ?? [];

  // Build a slot-by-slot view of the team's roster so empty slots are visible.
  type SlotRow =
    | { kind: "filled"; slot: string; entry: RosterEntry }
    | { kind: "empty"; slot: string };

  const slotCounts: Record<string, number> = league?.rosterSlots ?? {};
  const occupancyBySlot = new Map<string, number>();
  for (const entry of roster) {
    occupancyBySlot.set(
      entry.position,
      (occupancyBySlot.get(entry.position) ?? 0) + 1,
    );
  }

  function eligibleTargetSlots(entry: RosterEntry): string[] {
    const targets: string[] = [];
    for (const slot of Object.keys(slotCounts)) {
      const cap = slotCounts[slot] ?? 0;
      if (cap === 0 || slot === entry.position) continue;
      if (!isEligibleForSlot(entry.positions ?? [], slot)) continue;
      const occ = occupancyBySlot.get(slot) ?? 0;
      if (occ < cap) targets.push(slot);
    }
    const ordered = SLOT_ORDER.filter((s) => targets.includes(s));
    const extras = targets.filter((s) => !(SLOT_ORDER as readonly string[]).includes(s));
    return [...ordered, ...extras];
  }

  const remainingByPos = new Map<string, RosterEntry[]>();
  for (const entry of roster) {
    const arr = remainingByPos.get(entry.position) ?? [];
    arr.push(entry);
    remainingByPos.set(entry.position, arr);
  }

  const slotRows: SlotRow[] = [];
  const orderedSlots = [
    ...SLOT_ORDER.filter((s) => (slotCounts[s] ?? 0) > 0),
    ...Object.keys(slotCounts).filter(
      (s) => !(SLOT_ORDER as readonly string[]).includes(s) && (slotCounts[s] ?? 0) > 0,
    ),
  ];
  for (const slot of orderedSlots) {
    const count = slotCounts[slot] ?? 0;
    const pool = remainingByPos.get(slot) ?? [];
    for (let i = 0; i < count; i++) {
      const entry = pool.shift();
      if (entry) slotRows.push({ kind: "filled", slot, entry });
      else slotRows.push({ kind: "empty", slot });
    }
  }
  // Any players whose slot doesn't match the league's roster config still get shown.
  for (const [, pool] of remainingByPos) {
    for (const entry of pool) {
      slotRows.push({ kind: "filled", slot: entry.position, entry });
    }
  }

  const myTeamId = league?.myTeamId;
  const myTeamName = teams.find((t) => t.id === myTeamId)?.name ?? "";
  const viewingMyTeam = !!myTeamName && teamName === myTeamName;

  if (!token && !leaguesLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Log in to view your roster.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Team selector + budget summary, all in one bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="md:w-64">
              {leaguesLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : !league ? (
                <p className="text-sm text-muted-foreground">
                  No league selected. Create or select one from the navbar.
                </p>
              ) : teams.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This league has no teams configured.
                </p>
              ) : (
                <Select value={teamName} onValueChange={handleTeamChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.name}>
                        {t.name}
                        {t.id === myTeamId ? " (My Roster)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {teamName && !loading ? (
              <div className="flex flex-wrap gap-4 md:gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Remaining </span>
                  <span className="font-bold text-primary">${remaining}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Spent </span>
                  <span className="font-bold text-foreground">${spent}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Max Bid </span>
                  <span className="font-bold text-primary">${maxBid}</span>
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {teamName && !loading && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">
            {teamName}
            {viewingMyTeam ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                (My Roster)
              </span>
            ) : null}
          </h2>

          {slotRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This league has no roster slots configured.
            </p>
          ) : (
            <div className="rounded-md border border-border overflow-hidden">
              {slotRows.map((row, i) => (
                <div
                  key={row.kind === "filled" ? row.entry._id : `${row.slot}-${i}`}
                  className={`flex items-center gap-4 px-4 py-3 text-sm ${
                    i % 2 === 0 ? "bg-background" : "bg-muted/30"
                  }`}
                >
                  <div className="w-14 shrink-0">
                    <Badge variant="outline" className="font-mono text-xs">
                      {row.slot}
                    </Badge>
                  </div>

                  {row.kind === "filled" ? (
                    <>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="font-medium text-foreground truncate">
                          {row.entry.playerName}
                        </span>
                        <span className="text-muted-foreground font-mono text-xs shrink-0">
                          {row.entry.mlbTeam}
                        </span>
                        <Badge
                          variant={row.entry.isKeeper ? "secondary" : "default"}
                          className="text-[10px] shrink-0"
                        >
                          {row.entry.isKeeper ? "Keeper" : "Drafted"}
                        </Badge>
                        <div className="flex gap-1 flex-wrap">
                          {row.entry.positions.map((pos) => (
                            <Badge
                              key={pos}
                              variant="outline"
                              className="text-xs"
                            >
                              {pos}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-primary">
                          ${row.entry.price}
                        </span>
                        {(() => {
                          const targets = eligibleTargetSlots(row.entry);
                          if (targets.length === 0) return null;
                          return (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  disabled={moving === row.entry._id}
                                >
                                  {moving === row.entry._id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    "Move"
                                  )}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {targets.map((slot) => (
                                  <DropdownMenuItem
                                    key={slot}
                                    onClick={() => handleMove(row.entry, slot)}
                                  >
                                    → {slot}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          );
                        })()}
                        {row.entry.isKeeper ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive h-7 px-2"
                            disabled={unassigning === row.entry._id}
                            onClick={() => handleUnassign(row.entry)}
                          >
                            {unassigning === row.entry._id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Remove"
                            )}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            undo on draft page
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 text-sm italic text-muted-foreground">
                      Empty
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
