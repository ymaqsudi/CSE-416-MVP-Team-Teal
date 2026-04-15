"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select";

const navLinks = [
  { label: "Players", href: "/players" },
  { label: "Roster", href: "/roster" },
  { label: "Draft", href: "/draft" },
  { label: "Draft History", href: "/draft-history" },
  { label: "Transactions", href: "/transactions" },
];

type StoredUser = {
  id: string;
  username: string;
  email: string;
};

type League = {
  _id: string;
  leagueName: string;
};

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<StoredUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");


  useEffect(() => {
    async function loadNavbarData() {
      setIsHydrated(true);

      const storedUser = localStorage.getItem("draftkit_user");
      const token = localStorage.getItem("draftkit_token");
      const storedLeagueId = localStorage.getItem("draftkit_leagueId");

      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
        } catch (error) {
          console.error("Failed to parse stored user:", error);
          setUser(null);
        }
      } else {
        setUser(null);
      }

      if (!token) {
        setLeagues([]);
        setSelectedLeagueId("");
        return;
      }

      try {
        const response = await fetch("/api/leagues", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok || !data.leagues) {
          setLeagues([]);
          setSelectedLeagueId("");
          return;
        }

        setLeagues(data.leagues);

        if (data.leagues.length > 0) {
          const selectedLeague =
            data.leagues.find((league: League) => league._id === storedLeagueId) ??
            data.leagues[0];

          setSelectedLeagueId(selectedLeague._id);
          localStorage.setItem("draftkit_leagueId", selectedLeague._id);
        } else {
          setSelectedLeagueId("");
          localStorage.removeItem("draftkit_leagueId");
        }
      } catch (error) {
        console.error("Failed to load navbar leagues:", error);
        setLeagues([]);
        setSelectedLeagueId("");
      }
    }

    loadNavbarData();
  }, []);

  function handleLogout() {
    localStorage.removeItem("draftkit_token");
    localStorage.removeItem("draftkit_user");
    localStorage.removeItem("draftkit_leagueId");
    setUser(null);
    setLeagues([]);
    setSelectedLeagueId("");
    router.push("/login");
  }

  function handleLeagueChange(nextLeagueId: string) {
    setSelectedLeagueId(nextLeagueId);
    localStorage.setItem("draftkit_leagueId", nextLeagueId);
    window.location.href = "/";
  }

  const isAuthPage =
    pathname === "/login" || pathname === "/create-account";

  if (isAuthPage) return null;

  return (
    <header className="w-full border-b border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="font-bold text-lg text-primary tracking-tight"
        >
          TealCore{" "}
          <span className="text-foreground font-normal">Draft Kit</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {link.label}
            </Link>
          ))}

          {isHydrated && user && leagues.length > 0 ? (
            <div className="ml-2 w-48">
              <Select value={selectedLeagueId} onValueChange={handleLeagueChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select league" />
                </SelectTrigger>
                <SelectContent>
                  {leagues.map((league) => (
                    <SelectItem key={league._id} value={league._id}>
                      {league.leagueName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {isHydrated && user ? (
            <Link
              href="/league-settings"
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                pathname === "/league-settings"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              League Settings
            </Link>
          ) : null}
        </nav>
  

        <div className="flex items-center gap-2">
          {!isHydrated ? null : user ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user.username}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/create-account">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
      <Separator />
    </header>
  );
}