"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Users, DollarSign, Trophy, ChevronRight } from "lucide-react";

type League = {
  _id: string;
  leagueName: string;
  teamCount: number;
  budget: number;
  scoringType: string;
  categories: string[];
};

type StoredUser = {
  id: string;
  username: string;
  email: string;
};

const quickLinks = [
  {
    label: "All Players",
    href: "/players",
    description: "Browse and search available players",
  },
  {
    label: "My Roster",
    href: "/roster",
    description: "View your current roster and budget",
  },
  { label: "Live Draft", href: "/draft", description: "Enter the draft room" },
  {
    label: "View Transactions",
    href: "/transactions",
    description: "See the latest updates to MLB rosters",
  },
];

export default function HomePage() {
  const [league, setLeague] = useState<League | null>(null);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadHomeData() {
      try {
        setError("");
        setIsLoading(true);

        const token = localStorage.getItem("draftkit_token");
        const storedUser = localStorage.getItem("draftkit_user");

        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch (parseError) {
            console.error("Failed to parse stored user:", parseError);
            setUser(null);
          }
        } else {
          setUser(null);
        }

        if (!token) {
          setIsLoading(false);
          return;
        }

        const response = await fetch("/api/leagues", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Failed to load leagues.");
          setIsLoading(false);
          return;
        }

        if (data.leagues && data.leagues.length > 0) {
          const storedLeagueId = localStorage.getItem("draftkit_leagueId");

          const selectedLeague =
            data.leagues.find((league: League) => league._id === storedLeagueId) ??
            data.leagues[0];

          setLeague(selectedLeague);
          localStorage.setItem("draftkit_leagueId", selectedLeague._id);
        } else {
          setLeague(null);
          localStorage.removeItem("draftkit_leagueId");
        }
      } catch (err) {
        console.error("Home page load error:", err);
        setError("Something went wrong while loading your league.");
      } finally {
        setIsLoading(false);
      }
    }

    loadHomeData();
  }, []);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading league...</p>;
  }

  if (!league) {
    return (
      <div className="space-y-6">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome to TealCore Draft Kit
          </h1>

          {user ? (
            <p className="text-sm text-muted-foreground mt-1">
              You are logged in, but you do not have a saved league yet.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              Log in to access your saved leagues or create a new one.
            </p>
          )}
        </div>

        {user ? (
          <Link href="/league-settings">
            <Card className="hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer max-w-md">
              <CardHeader>
                <CardTitle>Create League Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Set up your first league and start preparing for draft day.
                </p>
              </CardContent>
            </Card>
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {league.leagueName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          In Progress · {league.teamCount} teams · ${league.budget} budget
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-2 rounded-md bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Remaining Budget</p>
              <p className="text-2xl font-bold text-primary">
                ${league.budget}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-2 rounded-md bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Teams</p>
              <p className="text-2xl font-bold text-foreground">
                {league.teamCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-2 rounded-md bg-primary/10">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Scoring Type</p>
              <p className="text-2xl font-bold text-foreground">
                {league.scoringType}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          League Settings
        </h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-sm">
              <div>
                <p className="text-muted-foreground">League Name</p>
                <p className="font-semibold mt-0.5">{league.leagueName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Teams</p>
                <p className="font-semibold mt-0.5">{league.teamCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Starting Budget</p>
                <p className="font-semibold mt-0.5">${league.budget}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Format</p>
                <p className="font-semibold mt-0.5">{league.scoringType}</p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-muted-foreground text-sm">Categories</p>
              <p className="font-semibold mt-1">
                {league.categories.length > 0
                  ? league.categories.join(", ")
                  : "No categories set"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    {link.label}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {link.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}