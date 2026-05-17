"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { filterPlayersByScope, type LeagueScope } from "@/lib/shared/mlbLeagueMap";

type Player = {
  id: string;
  mlbPlayerId?: number;
  name: string;
  mlbTeam?: string;
  positions: string[];
};

type MainPick = {
  _id: string;
  playerId: string;
};

type TaxiPick = {
  _id: string;
  playerId: string;
  playerName: string;
  mlbTeam: string;
  positions: string[];
  teamId: string;
  teamName: string;
  slotIndex: number;
};

type Team = { id: string; name: string };

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("draftkit_token");
}

function getLeagueId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("draftkit_leagueId");
}

export default function TaxiDraftPage() {
  const [taxiSlots, setTaxiSlots] = useState<number>(0);
  const [taxiOrder, setTaxiOrder] = useState<string[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [leagueScope, setLeagueScope] = useState<LeagueScope>("MLB");
  const [mainPicks, setMainPicks] = useState<MainPick[]>([]);
  const [taxiPicks, setTaxiPicks] = useState<TaxiPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // add-pick form state
  const [teamId, setTeamId] = useState("");
  const [slotIndex, setSlotIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // edit-mode state for an existing pick
  const [editingPickId, setEditingPickId] = useState<string | null>(null);
  const [editQuery, setEditQuery] = useState("");
  const [editResults, setEditResults] = useState<Player[]>([]);
  const [editLoading, setEditLoading] = useState(false);

  const leagueId = getLeagueId();
  const token = getToken();

  const loadAll = useCallback(async () => {
    if (!leagueId || !token) {
      setError("No league selected. Please set up your league first.");
      setLoading(false);
      return;
    }
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [leaguesRes, mainRes, taxiRes, orderRes] = await Promise.all([
        fetch("/api/leagues", { headers }),
        fetch(`/api/leagues/${leagueId}/picks`, { headers }),
        fetch(`/api/leagues/${leagueId}/taxi-picks`, { headers }),
        fetch(`/api/leagues/${leagueId}/taxi-order`, { headers }),
      ]);
      if (!leaguesRes.ok || !mainRes.ok || !taxiRes.ok || !orderRes.ok) {
        throw new Error("Failed to load taxi draft data");
      }
      const leaguesData = await leaguesRes.json();
      const mainData = await mainRes.json();
      const taxiData = await taxiRes.json();
      const orderData = await orderRes.json();

      const league = (leaguesData.leagues ?? []).find(
        (l: {
          _id: string;
          taxiSlots?: number;
          teams?: Team[];
          scope?: "MLB" | "AL" | "NL";
        }) => l._id === leagueId,
      );
      if (league) {
        setTaxiSlots(Number(league.taxiSlots) || 0);
        setTeams(league.teams ?? []);
        if (league.scope === "AL" || league.scope === "NL" || league.scope === "MLB") {
          setLeagueScope(league.scope);
        }
      }
      setMainPicks(mainData.picks ?? []);
      setTaxiPicks(taxiData.picks ?? []);
      setTaxiOrder(orderData.order ?? []);
    } catch {
      setError("Failed to load taxi draft.");
    } finally {
      setLoading(false);
    }
  }, [leagueId, token]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const takenIds = new Set<string>([
    ...mainPicks.map((p) => p.playerId),
    ...taxiPicks.map((p) => p.playerId),
  ]);

  // add-pick search
  useEffect(() => {
    if (!searchQuery.trim() || selectedPlayer) {
      setSearchResults([]);
      return;
    }
    const controller = new AbortController();
    setSearchLoading(true);
    const extra = new URLSearchParams();
    if (leagueScope !== "MLB") extra.set("mlbLeague", leagueScope);
    const extraStr = extra.toString() ? `&${extra.toString()}` : "";
    fetch(
      `/api/valuation/players?q=${encodeURIComponent(searchQuery)}&limit=10${extraStr}`,
      { signal: controller.signal },
    )
      .then((r) => r.json())
      .then((data) => setSearchResults(data.players ?? []))
      .catch(() => {})
      .finally(() => setSearchLoading(false));
    return () => controller.abort();
  }, [searchQuery, selectedPlayer, leagueScope]);

  // edit-pick search
  useEffect(() => {
    if (!editingPickId || !editQuery.trim()) {
      setEditResults([]);
      return;
    }
    const controller = new AbortController();
    setEditLoading(true);
    const extra = new URLSearchParams();
    if (leagueScope !== "MLB") extra.set("mlbLeague", leagueScope);
    const extraStr = extra.toString() ? `&${extra.toString()}` : "";
    fetch(
      `/api/valuation/players?q=${encodeURIComponent(editQuery)}&limit=10${extraStr}`,
      { signal: controller.signal },
    )
      .then((r) => r.json())
      .then((data) => setEditResults(data.players ?? []))
      .catch(() => {})
      .finally(() => setEditLoading(false));
    return () => controller.abort();
  }, [editingPickId, editQuery, leagueScope]);

  const filteredAddPlayers = filterPlayersByScope(searchResults, leagueScope).filter(
    (p) => !takenIds.has(p.id),
  );
  const filteredEditPlayers = filterPlayersByScope(editResults, leagueScope).filter(
    (p) => !takenIds.has(p.id),
  );

  function picksForTeam(tid: string): TaxiPick[] {
    return taxiPicks
      .filter((p) => p.teamId === tid)
      .sort((a, b) => a.slotIndex - b.slotIndex);
  }

  function freeSlotsForTeam(tid: string): number[] {
    const occupied = new Set(picksForTeam(tid).map((p) => p.slotIndex));
    const free: number[] = [];
    for (let i = 0; i < taxiSlots; i++) {
      if (!occupied.has(i)) free.push(i);
    }
    return free;
  }

  function nextTeamUp(): string | null {
    for (const tid of taxiOrder) {
      if (picksForTeam(tid).length < taxiSlots) return tid;
    }
    return null;
  }

  async function handleAddPick() {
    if (!selectedPlayer || !teamId) {
      setSubmitError("Please select a player and a team.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/taxi-picks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          playerId: selectedPlayer.id,
          playerName: selectedPlayer.name,
          mlbTeam: selectedPlayer.mlbTeam ?? "",
          positions: selectedPlayer.positions,
          teamId,
          slotIndex,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to record taxi pick");
      }
      setSelectedPlayer(null);
      setSearchQuery("");
      setSlotIndex(null);
      await loadAll();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemovePick(pickId: string) {
    try {
      const res = await fetch(
        `/api/leagues/${leagueId}/taxi-picks/${pickId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to remove taxi pick");
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove taxi pick");
    }
  }

  async function handleReplacePick(pickId: string, player: Player) {
    try {
      const res = await fetch(
        `/api/leagues/${leagueId}/taxi-picks/${pickId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            playerId: player.id,
            playerName: player.name,
            mlbTeam: player.mlbTeam ?? "",
            positions: player.positions,
          }),
        },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to replace player");
      }
      setEditingPickId(null);
      setEditQuery("");
      setEditResults([]);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to replace player");
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading taxi draft...</p>;
  }

  if (taxiSlots <= 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Taxi Draft</h1>
        <p className="text-sm text-muted-foreground">
          Taxi draft is disabled for this league. Enable it by setting taxi slots
          in{" "}
          <Link href="/league-settings" className="text-primary underline">
            league settings
          </Link>
          .
        </p>
      </div>
    );
  }

  const onTheClock = nextTeamUp();
  const totalSlots = teams.length * taxiSlots;
  const filledSlots = taxiPicks.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Taxi Draft</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filledSlots} / {totalSlots} taxi slots filled
          </p>
        </div>
        <Badge className="bg-blue-100 text-blue-800 border-blue-200 border">
          Picks can be entered in any order
        </Badge>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — draft order reference */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Draft Order</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/league-settings">Edit</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {taxiOrder.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  No teams configured.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {taxiOrder.map((tid, idx) => {
                    const team = teams.find((t) => t.id === tid);
                    if (!team) return null;
                    const filled = picksForTeam(tid).length;
                    const isUp = tid === onTheClock;
                    return (
                      <div
                        key={tid}
                        className={`flex items-center justify-between px-4 py-2 text-sm ${
                          isUp ? "bg-primary/10" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-mono w-6">
                            {idx + 1}.
                          </span>
                          <span className="font-medium">{team.name}</span>
                          {isUp ? (
                            <Badge variant="outline" className="text-xs">
                              up next
                            </Badge>
                          ) : null}
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          {filled} / {taxiSlots}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Center — add pick form */}
        <div className="space-y-4">
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Add Taxi Pick</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Team</label>
                <Select
                  value={teamId}
                  onValueChange={(v) => {
                    setTeamId(v);
                    setSlotIndex(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => {
                      const filled = picksForTeam(t.id).length;
                      return (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({filled} / {taxiSlots})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {teamId && freeSlotsForTeam(teamId).length > 0 ? (
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">
                    Slot (optional)
                  </label>
                  <Select
                    value={slotIndex === null ? "auto" : String(slotIndex)}
                    onValueChange={(v) =>
                      setSlotIndex(v === "auto" ? null : Number(v))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Next free</SelectItem>
                      {freeSlotsForTeam(teamId).map((i) => (
                        <SelectItem key={i} value={String(i)}>
                          Slot {i + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Search Player
                </label>
                <Input
                  placeholder="Type a player name..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedPlayer(null);
                  }}
                />
                {searchQuery && !selectedPlayer && searchLoading && (
                  <p className="text-xs text-muted-foreground px-1">
                    Searching...
                  </p>
                )}
                {searchQuery &&
                  !selectedPlayer &&
                  !searchLoading &&
                  filteredAddPlayers.length > 0 && (
                    <div className="rounded-md border border-border bg-background shadow-sm overflow-hidden">
                      {filteredAddPlayers.slice(0, 6).map((p) => (
                        <button
                          key={p.id}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors text-left"
                          onClick={() => {
                            setSelectedPlayer(p);
                            setSearchQuery(p.name);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{p.name}</span>
                            <span className="text-muted-foreground font-mono text-xs">
                              {p.mlbTeam}
                            </span>
                            {p.positions.map((pos) => (
                              <Badge key={pos} variant="outline" className="text-xs">
                                {pos}
                              </Badge>
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                {searchQuery &&
                  !selectedPlayer &&
                  !searchLoading &&
                  filteredAddPlayers.length === 0 && (
                    <p className="text-xs text-muted-foreground px-1">
                      No available players match that name.
                    </p>
                  )}
              </div>

              {selectedPlayer && (
                <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3">
                  <p className="font-semibold text-foreground">
                    {selectedPlayer.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-muted-foreground font-mono text-xs">
                      {selectedPlayer.mlbTeam}
                    </span>
                    {selectedPlayer.positions.map((pos) => (
                      <Badge key={pos} variant="outline" className="text-xs">
                        {pos}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {submitError && (
                <p className="text-xs text-destructive">{submitError}</p>
              )}

              <Button
                className="w-full"
                onClick={handleAddPick}
                disabled={
                  submitting ||
                  !selectedPlayer ||
                  !teamId ||
                  (teamId !== "" && picksForTeam(teamId).length >= taxiSlots)
                }
              >
                {submitting ? "Adding..." : "Add Pick"}
              </Button>
              {teamId && picksForTeam(teamId).length >= taxiSlots ? (
                <p className="text-xs text-destructive">
                  This team has already filled all {taxiSlots} taxi slots.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Right — rosters */}
        <div className="space-y-4">
          {teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No teams in this league.</p>
          ) : (
            teams.map((team) => {
              const tps = picksForTeam(team.id);
              const occupied = new Map(tps.map((p) => [p.slotIndex, p]));
              return (
                <Card key={team.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {team.name}{" "}
                      <span className="text-xs text-muted-foreground font-mono">
                        {tps.length} / {taxiSlots}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {Array.from({ length: taxiSlots }, (_, i) => {
                        const pick = occupied.get(i);
                        if (!pick) {
                          return (
                            <div
                              key={i}
                              className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground"
                            >
                              <span>Slot {i + 1}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setTeamId(team.id);
                                  setSlotIndex(i);
                                }}
                              >
                                + Add
                              </Button>
                            </div>
                          );
                        }
                        const isEditing = editingPickId === pick._id;
                        return (
                          <div key={i} className="px-4 py-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-muted-foreground font-mono w-10 shrink-0">
                                  Slot {i + 1}
                                </span>
                                <span className="font-medium truncate">
                                  {pick.playerName}
                                </span>
                                <span className="text-muted-foreground font-mono shrink-0">
                                  {pick.mlbTeam}
                                </span>
                                {pick.positions.map((pos) => (
                                  <Badge
                                    key={pos}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {pos}
                                  </Badge>
                                ))}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (isEditing) {
                                      setEditingPickId(null);
                                      setEditQuery("");
                                      setEditResults([]);
                                    } else {
                                      setEditingPickId(pick._id);
                                      setEditQuery("");
                                      setEditResults([]);
                                    }
                                  }}
                                >
                                  {isEditing ? "Cancel" : "Edit"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemovePick(pick._id)}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                            {isEditing ? (
                              <div className="mt-2 space-y-1">
                                <Input
                                  placeholder="Replace with..."
                                  value={editQuery}
                                  onChange={(e) => setEditQuery(e.target.value)}
                                  className="h-8 text-xs"
                                />
                                {editLoading ? (
                                  <p className="text-xs text-muted-foreground">
                                    Searching...
                                  </p>
                                ) : null}
                                {!editLoading &&
                                  editQuery &&
                                  filteredEditPlayers.length > 0 && (
                                    <div className="rounded-md border border-border bg-background shadow-sm overflow-hidden">
                                      {filteredEditPlayers.slice(0, 5).map((p) => (
                                        <button
                                          key={p.id}
                                          className="w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors text-left"
                                          onClick={() =>
                                            handleReplacePick(pick._id, p)
                                          }
                                        >
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium">
                                              {p.name}
                                            </span>
                                            <span className="text-muted-foreground font-mono">
                                              {p.mlbTeam}
                                            </span>
                                            {p.positions.map((pos) => (
                                              <Badge
                                                key={pos}
                                                variant="outline"
                                                className="text-xs"
                                              >
                                                {pos}
                                              </Badge>
                                            ))}
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                {!editLoading &&
                                  editQuery &&
                                  filteredEditPlayers.length === 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      No available players match that name.
                                    </p>
                                  )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
