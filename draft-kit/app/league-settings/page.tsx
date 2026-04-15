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
};

export default function LeagueSettingsPage() {
  const router = useRouter();

  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("");
  const [teamCount, setTeamCount] = useState("12");
  const [budget, setBudget] = useState("260");
  const [mainRosterSlots, setMainRosterSlots] = useState("23");
  const [scoringType, setScoringType] = useState("rotisserie");
  const [categories, setCategories] = useState("HR,RBI,R,SB,AVG");
  const [teams, setTeams] = useState<Team[]>([]);
  const [myTeamId, setMyTeamId] = useState<string>("");

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
          setMainRosterSlots(String(existingLeague.mainRosterSlots ?? 23));
          setScoringType(existingLeague.scoringType);
          setCategories(existingLeague.categories.join(","));
          setTeams(existingLeague.teams ?? []);
          setMyTeamId(existingLeague.myTeamId ?? "");
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
    setMainRosterSlots("23");
    setScoringType("rotisserie");
    setCategories("HR,RBI,R,SB,AVG");
    setTeams([]);
    setMyTeamId("");
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
    const parsedMainRosterSlots = Number(mainRosterSlots);
    const parsedCategories = categories
      .split(",")
      .map((category) => category.trim())
      .filter((category) => category.length > 0);

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
      setError("Main roster slots must be at least 1.");
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
              Main Roster Slots
            </label>
            <Input
              type="number"
              value={mainRosterSlots}
              onChange={(e) => setMainRosterSlots(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Default is 23. This controls when a team is considered full for
              the main roster.
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
              Categories
            </label>
            <Input
              placeholder="HR,RBI,R,SB,AVG"
              value={categories}
              onChange={(e) => setCategories(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Enter categories separated by commas.
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
