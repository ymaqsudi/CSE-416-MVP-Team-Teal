"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Team = { id: string; name: string };

type League = {
  _id: string;
  leagueName: string;
  teamCount: number;
  budget: number;
  mainRosterSlots?: number;
  scoringType: string;
  categories: string[];
  teams?: Team[];
  myTeamId?: string;
  scope?: "MLB" | "AL" | "NL";
  rosterSlots?: Record<string, number>;
};

const HITTER_SLOTS = ["C", "1B", "2B", "3B", "SS", "CI", "MI", "OF", "UTIL"] as const;
const PITCHER_SLOTS = ["P"] as const;
const DEFAULT_ROSTER_SLOTS: Record<string, number> = {
  C: 2, "1B": 1, "2B": 1, "3B": 1, SS: 1,
  CI: 1, MI: 1, OF: 5, UTIL: 1, P: 9,
};

export default function LeagueSettingsPage() {
  const router = useRouter();

  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("");
  const [teamCount, setTeamCount] = useState("12");
  const [budget, setBudget] = useState("260");
  const [scoringType, setScoringType] = useState("rotisserie");
  const HITTER_CATS = ["HR", "RBI", "R", "SB", "AVG"] as const;
  const PITCHER_CATS = ["W", "ERA", "WHIP", "K", "SV"] as const;
  const [categories, setCategories] = useState<string[]>([
    ...HITTER_CATS,
    ...PITCHER_CATS,
  ]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [myTeamId, setMyTeamId] = useState<string>("");
  const [scope, setScope] = useState<"MLB" | "AL" | "NL">("MLB");
  const [rosterSlots, setRosterSlots] = useState<Record<string, number>>({ ...DEFAULT_ROSTER_SLOTS });
  const rosterTotal = Object.values(rosterSlots).reduce((s, n) => s + (Number(n) || 0), 0);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);

  useEffect(() => {
    async function loadExistingLeague() {
      try {
        setError("");
        setIsPageLoading(true);

        const token = localStorage.getItem("draftkit_token");

        if (!token) {
          setIsPageLoading(false);
          return;
        }

        const response = await fetch("/api/leagues", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Failed to load league settings.");
          setIsPageLoading(false);
          return;
        }

        if (data.leagues && data.leagues.length > 0) {
          const storedLeagueId = localStorage.getItem("draftkit_leagueId");
          
          const existingLeague: League =
            data.leagues.find((league: League) => league._id === storedLeagueId) ??
            data.leagues[0];

          setLeagueId(existingLeague._id);
          localStorage.setItem("draftkit_leagueId", existingLeague._id);


          setLeagueName(existingLeague.leagueName);
          setTeamCount(String(existingLeague.teamCount));
          setBudget(String(existingLeague.budget));
          setScoringType(existingLeague.scoringType);
          setCategories(
            existingLeague.categories && existingLeague.categories.length > 0
              ? existingLeague.categories
              : [...HITTER_CATS, ...PITCHER_CATS],
          );
          setTeams(existingLeague.teams ?? []);
          setMyTeamId(existingLeague.myTeamId ?? "");
          setScope(existingLeague.scope ?? "MLB");
          setRosterSlots(
            existingLeague.rosterSlots && Object.keys(existingLeague.rosterSlots).length > 0
              ? { ...DEFAULT_ROSTER_SLOTS, ...existingLeague.rosterSlots }
              : { ...DEFAULT_ROSTER_SLOTS },
          );
        }
      } catch (err) {
        console.error("Load league settings error:", err);
        setError("Something went wrong while loading league settings.");
      } finally {
        setIsPageLoading(false);
      }
    }

    loadExistingLeague();
  }, []);


  function handleCreateNewLeague() {
    setLeagueId(null);
    setLeagueName("");
    setTeamCount("12");
    setBudget("260");
    setScoringType("rotisserie");
    setCategories([...HITTER_CATS, ...PITCHER_CATS]);
    setTeams([]);
    setMyTeamId("");
    setScope("MLB");
    setRosterSlots({ ...DEFAULT_ROSTER_SLOTS });
    setError("");
    setSuccess("");
    localStorage.removeItem("draftkit_leagueId");
  }

  
  
  async function handleSaveLeague() {
    setError("");
    setSuccess("");

    const token = localStorage.getItem("draftkit_token");

    if (!token) {
      setError("You must be logged in to save league settings.");
      return;
    }

    const trimmedLeagueName = leagueName.trim();
    const parsedTeamCount = Number(teamCount);
    const parsedBudget = Number(budget);
    const parsedMainRosterSlots = rosterTotal;
    const hitterSlotTotal = HITTER_SLOTS.reduce((s, k) => s + (Number(rosterSlots[k]) || 0), 0);
    const pitcherSlotTotal = PITCHER_SLOTS.reduce((s, k) => s + (Number(rosterSlots[k]) || 0), 0);
    const parsedCategories = categories;
    const hasHitterCat = parsedCategories.some((c) => (HITTER_CATS as readonly string[]).includes(c));
    const hasPitcherCat = parsedCategories.some((c) => (PITCHER_CATS as readonly string[]).includes(c));

    if (!trimmedLeagueName) {
      setError("League name is required.");
      return;
    }

    if (!parsedTeamCount || parsedTeamCount < 2) {
      setError("Team count must be at least 2.");
      return;
    }

    if (!parsedBudget || parsedBudget < 1) {
      setError("Budget must be at least 1.");
      return;
    }
    
    if (!parsedMainRosterSlots || parsedMainRosterSlots < 1) {
      setError("Total roster slots must be at least 1.");
      return;
    }

    if (hitterSlotTotal < 1 || pitcherSlotTotal < 1) {
      setError("Roster must include at least one hitter slot and one pitcher slot.");
      return;
    }

    if (!hasHitterCat || !hasPitcherCat) {
      setError("Select at least one hitter category and one pitcher category.");
      return;
    }

    try {
      setIsLoading(true);

      const url = leagueId ? `/api/leagues/${leagueId}` : "/api/leagues";
      const method = leagueId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          leagueName: trimmedLeagueName,
          teamCount: parsedTeamCount,
          budget: parsedBudget,
          mainRosterSlots: parsedMainRosterSlots,
          scoringType,
          categories: parsedCategories,
          teams,
          myTeamId,
          scope,
          rosterSlots,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to save league settings.");
        return;
      }

      if (!leagueId && data.league?._id) {
        setLeagueId(data.league._id);
        localStorage.setItem("draftkit_leagueId", data.league._id);
      }

      if (data.league?.teams) setTeams(data.league.teams);
      if (typeof data.league?.myTeamId === "string")
        setMyTeamId(data.league.myTeamId);

      if (leagueId) {
        localStorage.setItem("draftkit_leagueId", leagueId);
      }

      setSuccess(
        leagueId
          ? "League settings updated successfully. Redirecting..."
          : "League created successfully. Redirecting...",
      );

      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    } catch (err) {
      console.error("League settings error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isPageLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading league settings...
      </p>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl text-center">
            League Settings
          </CardTitle>

          <CardDescription className="text-center">
            {leagueId
              ? "Update your current league settings"
              : "Set up your league before draft day"}
          </CardDescription>

          {leagueId ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleCreateNewLeague}
              disabled={isLoading}
              className="w-full"
            >
              Create New League
            </Button>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-4">
          {error ? (
            <p className="text-sm text-red-600 text-center">{error}</p>
          ) : null}

          {success ? (
            <p className="text-sm text-green-600 text-center">{success}</p>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              League Name
            </label>
            <Input
              placeholder="League Name"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Number of Teams
            </label>
            <Input
              type="number"
              value={teamCount}
              onChange={(e) => setTeamCount(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Player Pool
            </label>
            <Select
              value={scope}
              onValueChange={(v) => setScope(v as "MLB" | "AL" | "NL")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MLB">All MLB players</SelectItem>
                <SelectItem value="AL">American League only</SelectItem>
                <SelectItem value="NL">National League only</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Restricts the draftable player pool to the chosen league.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Budget
            </label>
            <Input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Roster Positions
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Hitters
                </p>
                {HITTER_SLOTS.map((slot) => (
                  <div key={slot} className="flex items-center gap-2">
                    <span className="text-xs font-mono w-12 shrink-0">{slot}</span>
                    <Input
                      type="number"
                      min={0}
                      value={String(rosterSlots[slot] ?? 0)}
                      onChange={(e) =>
                        setRosterSlots((prev) => ({
                          ...prev,
                          [slot]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                        }))
                      }
                      disabled={isLoading}
                      className="h-8"
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Pitchers
                </p>
                {PITCHER_SLOTS.map((slot) => (
                  <div key={slot} className="flex items-center gap-2">
                    <span className="text-xs font-mono w-12 shrink-0">{slot}</span>
                    <Input
                      type="number"
                      min={0}
                      value={String(rosterSlots[slot] ?? 0)}
                      onChange={(e) =>
                        setRosterSlots((prev) => ({
                          ...prev,
                          [slot]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                        }))
                      }
                      disabled={isLoading}
                      className="h-8"
                    />
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Total roster size: <span className="font-medium">{rosterTotal}</span>{" "}
              (CI = 1B/3B, MI = 2B/SS, UTIL = any non-pitcher).
            </p>
          </div>


          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Scoring Type
            </label>
            <Input
              value={scoringType}
              onChange={(e) => setScoringType(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {teams.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Team Names
              </label>
              <div className="space-y-2">
                {teams.map((team, idx) => (
                  <div key={team.id} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-6 shrink-0 font-mono">
                      #{idx + 1}
                    </span>
                    <Input
                      value={team.name}
                      onChange={(e) =>
                        setTeams((prev) =>
                          prev.map((t) =>
                            t.id === team.id
                              ? { ...t, name: e.target.value }
                              : t,
                          ),
                        )
                      }
                      disabled={isLoading}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Changing the team count will add or remove teams from the end of
                the list.
              </p>
            </div>
          )}

          {teams.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                My Team
              </label>
              <Select value={myTeamId} onValueChange={setMyTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Max Bid on the draft page is calculated from this team&apos;s
                picks.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Scoring Categories
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Hitters
                </p>
                {HITTER_CATS.map((cat) => (
                  <label key={cat} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={categories.includes(cat)}
                      onChange={(e) =>
                        setCategories((prev) =>
                          e.target.checked
                            ? [...prev, cat]
                            : prev.filter((c) => c !== cat),
                        )
                      }
                      disabled={isLoading}
                      className="h-4 w-4"
                    />
                    {cat}
                  </label>
                ))}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Pitchers
                </p>
                {PITCHER_CATS.map((cat) => (
                  <label key={cat} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={categories.includes(cat)}
                      onChange={(e) =>
                        setCategories((prev) =>
                          e.target.checked
                            ? [...prev, cat]
                            : prev.filter((c) => c !== cat),
                        )
                      }
                      disabled={isLoading}
                      className="h-4 w-4"
                    />
                    {cat}
                  </label>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              At least one hitter category and one pitcher category are required.
            </p>
          </div>

          <Button
            className="w-full"
            onClick={handleSaveLeague}
            disabled={isLoading}
          >
            {isLoading
              ? leagueId
                ? "Updating League..."
                : "Saving League..."
              : leagueId
                ? "Update League Settings"
                : "Save League Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
