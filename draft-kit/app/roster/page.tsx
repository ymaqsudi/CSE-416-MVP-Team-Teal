"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

type League = {
  _id: string;
  leagueName: string;
  budget: number;
};

type RosterEntry = {
  _id: string;
  playerId: string;
  playerName: string;
  mlbTeam: string;
  positions: string[];
  position: string;
  price: number;
};

export default function RosterPage() {
  const [token, setToken] = useState<string | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [teamName, setTeamName] = useState<string>("");
  const [teamNameInput, setTeamNameInput] = useState<string>("");

  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [budget, setBudget] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [leaguesLoading, setLeaguesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unassigning, setUnassigning] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("draftkit_token");
    setToken(t);
  }, []);

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
          setLeagues(data.leagues ?? []);
          if (data.leagues?.length > 0) {
            setSelectedLeagueId(data.leagues[0]._id);
            setBudget(data.leagues[0].budget);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLeaguesLoading(false);
      }
    }
    fetchLeagues();
  }, [token]);

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

  function handleLeagueChange(id: string) {
    setSelectedLeagueId(id);
    const league = leagues.find((l) => l._id === id);
    if (league) setBudget(league.budget);
    setRoster([]);
    setTeamName("");
    setTeamNameInput("");
    setError(null);
  }

  function handleLoadRoster() {
    setTeamName(teamNameInput.trim());
    fetchRoster(selectedLeagueId, teamNameInput);
  }

  async function handleUnassign(entry: RosterEntry) {
    if (!token) return;
    setUnassigning(entry._id);
    try {
      const res = await fetch(
        `/api/players/${entry.playerId}/assignment?leagueId=${selectedLeagueId}&teamName=${encodeURIComponent(teamName)}&position=${encodeURIComponent(entry.position)}`,
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

  const spent = roster.reduce((sum, r) => sum + r.price, 0);
  const remaining = budget - spent;
  const maxBid = remaining - 1;

  if (!token && !leaguesLoading) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">My Roster</h1>
        <p className="text-sm text-muted-foreground">
          Log in to view your roster.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Roster</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {teamName
            ? `${roster.length} players assigned — ${teamName}`
            : "Select a league and team to view your roster"}
        </p>
      </div>

      {/* League + Team selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium text-foreground mb-1 block">
                League
              </label>
              {leaguesLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading leagues…
                </div>
              ) : leagues.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No leagues found. Create one in League Settings.
                </p>
              ) : (
                <Select
                  value={selectedLeagueId}
                  onValueChange={handleLeagueChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select league" />
                  </SelectTrigger>
                  <SelectContent>
                    {leagues.map((l) => (
                      <SelectItem key={l._id} value={l._id}>
                        {l.leagueName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium text-foreground mb-1 block">
                Team Name
              </label>
              <Input
                placeholder="Enter your team name"
                value={teamNameInput}
                onChange={(e) => setTeamNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLoadRoster()}
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleLoadRoster}
                disabled={loading || !selectedLeagueId || !teamNameInput.trim()}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Load Roster"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Budget stats — only show once a roster is loaded */}
      {teamName && !loading && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Remaining Budget</p>
                <p className="text-3xl font-bold text-primary mt-1">
                  ${remaining}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Spent</p>
                <p className="text-3xl font-bold text-foreground mt-1">
                  ${spent}
                </p>
              </CardContent>
            </Card>
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Max Bid Right Now</p>
                <p className="text-3xl font-bold text-primary mt-1">
                  ${Math.max(maxBid, 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Remaining minus $1 reserve
                </p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Roster table */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">
              Assigned Players
            </h2>

            {roster.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No players assigned to this team yet.
              </p>
            ) : (
              <div className="rounded-md border border-border overflow-hidden">
                {roster.map((entry, i) => (
                  <div
                    key={entry._id}
                    className={`flex items-center gap-4 px-4 py-3 text-sm ${
                      i % 2 === 0 ? "bg-background" : "bg-muted/30"
                    }`}
                  >
                    {/* Slot */}
                    <div className="w-14 shrink-0">
                      <Badge variant="outline" className="font-mono text-xs">
                        {entry.position}
                      </Badge>
                    </div>

                    {/* Player info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="font-medium text-foreground truncate">
                        {entry.playerName}
                      </span>
                      <span className="text-muted-foreground font-mono text-xs shrink-0">
                        {entry.mlbTeam}
                      </span>
                      <div className="flex gap-1 flex-wrap">
                        {entry.positions.map((pos) => (
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

                    {/* Price + unassign */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold text-primary">
                        ${entry.price}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive h-7 px-2"
                        disabled={unassigning === entry._id}
                        onClick={() => handleUnassign(entry)}
                      >
                        {unassigning === entry._id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Remove"
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
