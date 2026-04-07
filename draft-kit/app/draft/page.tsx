"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { mockPlayers, mockValuations, Player } from "@/lib/mock-data";

type DraftPick = {
  _id: string;
  playerId: string;
  playerName: string;
  mlbTeam: string;
  positions: string[];
  teamName: string;
  price: number;
  pickNumber: number;
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("draftkit_token");
}

function getLeagueId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("draftkit_leagueId");
}

export default function DraftPage() {
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // record pick form state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [teamName, setTeamName] = useState("");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);

  const leagueId = getLeagueId();
  const token = getToken();

  const fetchPicks = useCallback(async () => {
    if (!leagueId || !token) {
      setError("No league selected. Please set up your league first.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/leagues/${leagueId}/picks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch picks");
      const data = await res.json();
      setPicks(data.picks);
    } catch {
      setError("Failed to load draft history.");
    } finally {
      setLoading(false);
    }
  }, [leagueId, token]);

  useEffect(() => {
    fetchPicks();
  }, [fetchPicks]);

  // derive drafted player IDs for filtering available players
  const draftedIds = new Set(picks.map((p) => p.playerId));

  const filteredPlayers = mockPlayers.filter((p) => {
    if (draftedIds.has(p.id)) return false;
    if (!searchQuery) return false;
    return p.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  async function handleRecordPick() {
    if (!selectedPlayer || !teamName.trim() || !price) {
      setSubmitError("Please select a player, enter a team name, and a price.");
      return;
    }
    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum < 1) {
      setSubmitError("Price must be at least $1.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/leagues/${leagueId}/picks`, {
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
          teamName: teamName.trim(),
          price: priceNum,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to record pick");
      }

      // reset form
      setSelectedPlayer(null);
      setSearchQuery("");
      setTeamName("");
      setPrice("");
      await fetchPicks();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUndoLastPick() {
    setUndoing(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/picks`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to undo pick");
      }
      await fetchPicks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to undo pick");
    } finally {
      setUndoing(false);
    }
  }

  const recentPicks = [...picks]
    .sort((a, b) => b.pickNumber - a.pickNumber)
    .slice(0, 5);
  const totalSpent = picks.reduce((sum, p) => sum + p.price, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Live Draft</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {picks.length} picks recorded
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-800 border-green-200 border">
            Draft In Progress
          </Badge>
          {picks.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndoLastPick}
              disabled={undoing}
            >
              {undoing ? "Undoing..." : "Undo Last Pick"}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — record a pick */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Record a Pick</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Player search */}
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
                {/* Search results dropdown */}
                {searchQuery &&
                  !selectedPlayer &&
                  filteredPlayers.length > 0 && (
                    <div className="rounded-md border border-border bg-background shadow-sm overflow-hidden">
                      {filteredPlayers.slice(0, 6).map((p) => {
                        const val = mockValuations[p.id];
                        return (
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
                                <Badge
                                  key={pos}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {pos}
                                </Badge>
                              ))}
                            </div>
                            {val && (
                              <span className="text-primary font-bold">
                                ${val.dollarValue}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                {searchQuery &&
                  !selectedPlayer &&
                  filteredPlayers.length === 0 && (
                    <p className="text-xs text-muted-foreground px-1">
                      No available players match that name.
                    </p>
                  )}
              </div>

              {/* Selected player preview */}
              {selectedPlayer && (
                <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between">
                  <div>
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
                  {mockValuations[selectedPlayer.id] && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        Est. Value
                      </p>
                      <p className="text-xl font-bold text-primary">
                        ${mockValuations[selectedPlayer.id].dollarValue}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Team + Price inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">
                    Winning Team
                  </label>
                  <Input
                    placeholder="e.g. Team Rocket"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">
                    Winning Price ($)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="e.g. 42"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
              </div>

              {submitError && (
                <p className="text-xs text-destructive">{submitError}</p>
              )}

              <Button
                className="w-full"
                onClick={handleRecordPick}
                disabled={submitting || !selectedPlayer || !teamName || !price}
              >
                {submitting ? "Recording..." : "Record Pick"}
              </Button>
            </CardContent>
          </Card>

          {/* Recent Picks */}
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">
              Recent Picks
            </h2>
            {loading ? (
              <p className="text-sm text-muted-foreground">
                Loading draft history...
              </p>
            ) : recentPicks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No picks recorded yet.
              </p>
            ) : (
              <div className="rounded-md border border-border overflow-hidden">
                {recentPicks.map((pick, i) => (
                  <div
                    key={pick._id}
                    className={`flex items-center justify-between px-4 py-3 text-sm ${
                      i % 2 === 0 ? "bg-background" : "bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-mono w-6">
                        #{pick.pickNumber}
                      </span>
                      <span className="font-medium">{pick.playerName}</span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {pick.mlbTeam}
                      </span>
                      {pick.positions.map((pos) => (
                        <Badge key={pos} variant="outline" className="text-xs">
                          {pos}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">
                        {pick.teamName}
                      </span>
                      <span className="font-bold text-primary">
                        ${pick.price}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — draft status */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Draft Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Picks</span>
                <span className="font-bold">{picks.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Spent</span>
                <span className="font-bold text-primary">${totalSpent}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Players Available</span>
                <span className="font-bold">
                  {mockPlayers.length - draftedIds.size}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Full draft history */}
          {picks.length > 5 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">All Picks</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-64 overflow-y-auto">
                  {[...picks]
                    .sort((a, b) => b.pickNumber - a.pickNumber)
                    .map((pick, i) => (
                      <div
                        key={pick._id}
                        className={`flex items-center justify-between px-4 py-2 text-xs ${
                          i % 2 === 0 ? "bg-background" : "bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground font-mono w-5">
                            #{pick.pickNumber}
                          </span>
                          <span className="font-medium">{pick.playerName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {pick.teamName}
                          </span>
                          <span className="font-bold text-primary">
                            ${pick.price}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
