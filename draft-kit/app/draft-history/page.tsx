"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api";
import type { Player } from "@/lib/shared/types";
import { Loader2, History, Undo2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Team = { id: string; name: string };

type LeagueMeta = {
  _id: string;
  leagueName: string;
  teamCount: number;
  budget: number;
  scoringType: string;
  teams?: Team[];
  myTeamId?: string;
};

type DraftPickRow = {
  _id?: string;
  pickNumber: number;
  round: number;
  teamId?: string;
  teamName: string;
  playerId: string;
  playerName: string;
  mlbTeam?: string;
  positions: string[];
  price: number;
  createdAt?: string;
};

type SortKey = "pickNumber" | "round" | "price" | "teamName" | "playerName" | "createdAt";

const LEAGUE_STORAGE_KEY = "draftkit_leagueId";

function formatWhen(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DraftHistoryPage() {
  const [token, setToken] = useState<string | null>(null);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [leagueOptions, setLeagueOptions] = useState<{ _id: string; leagueName: string }[]>([]);
  const [league, setLeague] = useState<LeagueMeta | null>(null);
  const [picks, setPicks] = useState<DraftPickRow[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("pickNumber");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [teamId, setTeamId] = useState("");
  const [price, setPrice] = useState("");
  const [playerQuery, setPlayerQuery] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [saving, setSaving] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );

  const refreshHistory = useCallback(async (auth: string, lid: string) => {
    const res = await fetch(`/api/leagues/${lid}/draft-history`, {
      headers: { Authorization: `Bearer ${auth}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      setLeague(null);
      setPicks([]);
      setError("Session expired. Please log in again.");
      return;
    }
    if (!res.ok) {
      setLeague(null);
      setPicks([]);
      setError((data as { error?: string }).error || "Failed to load draft history.");
      return;
    }
    setError(null);
    setLeague((data as { league: LeagueMeta }).league);
    setPicks((data as { picks?: DraftPickRow[] }).picks ?? []);
  }, []);

  useEffect(() => {
    const t = localStorage.getItem("draftkit_token");
    setToken(t);
  }, []);

  useEffect(() => {
    async function boot() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const lr = await fetch("/api/leagues", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const ld = await lr.json();
        if (!lr.ok) {
          setError(ld.error || "Could not load your league.");
          setLeagueOptions([]);
          return;
        }
        const list = (ld.leagues ?? []) as { _id: string; leagueName: string }[];
        setLeagueOptions(
          list.map((l) => ({ _id: String(l._id), leagueName: l.leagueName })),
        );
        if (list.length === 0) {
          setLeagueId(null);
          setLeague(null);
          setPicks([]);
          return;
        }
        let stored: string | null = null;
        try {
          stored = sessionStorage.getItem(LEAGUE_STORAGE_KEY);
        } catch {
          stored = null;
        }
        const storedValid = stored && list.some((l) => String(l._id) === stored);
        const chosenId = storedValid ? stored! : String(list[0]._id);
        try {
          sessionStorage.setItem(LEAGUE_STORAGE_KEY, chosenId);
        } catch {
          /* ignore */
        }
        setLeagueId(chosenId);
        await refreshHistory(token, chosenId);
      } catch (e) {
        console.error(e);
        setError("Something went wrong loading draft history.");
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, [token, refreshHistory]);

  useEffect(() => {
    async function loadPlayers() {
      if (!token || !leagueId) return;
      try {
        setPlayersLoading(true);
        const res = await apiClient.getPlayers();
        setPlayers(res.players);
      } catch (e) {
        console.error(e);
      } finally {
        setPlayersLoading(false);
      }
    }
    loadPlayers();
  }, [token, leagueId]);

  const filteredPlayers = useMemo(() => {
    const q = playerQuery.trim().toLowerCase();
    if (!q) return players.slice(0, 12);
    return players
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.mlbTeam ?? "").toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [players, playerQuery]);

  const filteredPicks = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let rows = picks;
    if (q) {
      rows = rows.filter(
        (p) =>
          p.playerName.toLowerCase().includes(q) ||
          p.teamName.toLowerCase().includes(q) ||
          (p.mlbTeam ?? "").toLowerCase().includes(q),
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (sortKey === "createdAt") {
        const at = av ? new Date(av as string).getTime() : 0;
        const bt = bv ? new Date(bv as string).getTime() : 0;
        return (at - bt) * dir;
      }
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      return String(av ?? "").localeCompare(String(bv ?? ""), undefined, {
        sensitivity: "base",
      }) * dir;
    });
  }, [picks, filter, sortKey, sortDir]);

  const stats = useMemo(() => {
    const total = picks.reduce((s, p) => s + p.price, 0);
    const byTeam = picks.reduce<Record<string, number>>((acc, p) => {
      acc[p.teamName] = (acc[p.teamName] ?? 0) + p.price;
      return acc;
    }, {});
    return { total, byTeam, count: picks.length };
  }, [picks]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "pickNumber" || key === "round" ? "asc" : "desc");
    }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="inline h-3.5 w-3.5 ml-0.5 opacity-70" />
    ) : (
      <ChevronDown className="inline h-3.5 w-3.5 ml-0.5 opacity-70" />
    );
  }

  async function handleRecordPick(e: React.FormEvent) {
    e.preventDefault();
    setFormMessage(null);
    if (!token || !leagueId) return;
    if (!selectedPlayer) {
      setFormMessage({ type: "err", text: "Select a player from the list." });
      return;
    }
    if (!teamId) {
      setFormMessage({ type: "err", text: "Select a fantasy team." });
      return;
    }
    const pr = Number(price);
    if (!Number.isFinite(pr) || pr < 0) {
      setFormMessage({ type: "err", text: "Enter a valid price (0 or more)." });
      return;
    }
    try {
      setSaving(true);
      const res = await fetch(`/api/leagues/${leagueId}/draft-history`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          teamId,
          playerId: selectedPlayer.id,
          playerName: selectedPlayer.name,
          mlbTeam: selectedPlayer.mlbTeam ?? "",
          positions: selectedPlayer.positions,
          price: pr,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormMessage({ type: "err", text: data.error || "Could not save pick." });
        return;
      }
      setFormMessage({ type: "ok", text: "Pick recorded." });
      setPrice("");
      setPlayerQuery("");
      setSelectedPlayer(null);
      await refreshHistory(token, leagueId);
    } catch (err) {
      console.error(err);
      setFormMessage({ type: "err", text: "Network error. Try again." });
    } finally {
      setSaving(false);
    }
  }

  async function handleUndo() {
    if (!token || !leagueId) return;
    if (!window.confirm("Remove the most recent pick from history?")) return;
    try {
      setUndoing(true);
      setFormMessage(null);
      const res = await fetch(`/api/leagues/${leagueId}/draft-history`, {
        method: "DELETE",
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setFormMessage({ type: "err", text: data.error || "Could not undo." });
        return;
      }
      setFormMessage({ type: "ok", text: "Last pick removed." });
      await refreshHistory(token, leagueId);
    } catch (e) {
      console.error(e);
      setFormMessage({ type: "err", text: "Network error." });
    } finally {
      setUndoing(false);
    }
  }

  if (!token && !loading) {
    return (
      <div className="space-y-4 max-w-lg">
        <div className="flex items-center gap-2 text-primary">
          <History className="h-7 w-7" />
          <h1 className="text-2xl font-bold text-foreground">Draft History</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Log in to record and view picks for your league draft.
        </p>
        <Button asChild>
          <Link href="/login">Log in</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading draft history…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (!leagueId || !league) {
    return (
      <div className="space-y-4 max-w-lg">
        <div className="flex items-center gap-2">
          <History className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Draft History</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Create a league first, then you can track every auction pick, fix mistakes with undo, and
          filter the full log.
        </p>
        <Button asChild>
          <Link href="/league-settings">League settings</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Draft History</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {league.leagueName} · {league.teamCount} teams · ${league.budget} budget ·{" "}
            {stats.count} pick{stats.count === 1 ? "" : "s"} recorded · saved to your account
          </p>
          {leagueOptions.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-sm font-medium text-foreground">Active league</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={leagueId ?? ""}
                onChange={(e) => {
                  const next = e.target.value;
                  if (!token || !next) return;
                  setLeagueId(next);
                  try {
                    sessionStorage.setItem(LEAGUE_STORAGE_KEY, next);
                  } catch {
                    /* ignore */
                  }
                  try {
                    localStorage.setItem("draftkit_leagueId", next);
                  } catch {
                    /* ignore */
                  }
                  void refreshHistory(token, next);
                }}
              >
                {leagueOptions.map((opt) => (
                  <option key={opt._id} value={opt._id}>
                    {opt.leagueName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild size="sm">
            <Link href="/draft">Live draft</Link>
          </Button>
          <Button variant="outline" asChild size="sm">
            <Link href="/players">All players</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={undoing || picks.length === 0}
            className="gap-1.5"
          >
            {undoing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
            Undo last pick
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-primary/15">
          <CardHeader>
            <CardTitle className="text-lg">Record a pick</CardTitle>
            <CardDescription>
              Log what happened in your real draft. Players come from the valuation API; picks are
              stored with your league.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRecordPick} className="space-y-4">
              {formMessage ? (
                <p
                  className={cn(
                    "text-sm rounded-md px-3 py-2",
                    formMessage.type === "ok"
                      ? "bg-green-50 text-green-800 border border-green-200"
                      : "bg-red-50 text-red-800 border border-red-200",
                  )}
                >
                  {formMessage.text}
                </p>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-medium">Fantasy team</label>
                <Select
                  value={teamId}
                  onValueChange={setTeamId}
                  disabled={saving || (league?.teams ?? []).length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {(league?.teams ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.id === league?.myTeamId ? " (my team)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Player</label>
                {selectedPlayer ? (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{selectedPlayer.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {selectedPlayer.mlbTeam}{" "}
                        {selectedPlayer.positions.map((pos) => pos).join(", ")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPlayer(null)}
                      disabled={saving}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <Input
                    placeholder={
                      playersLoading ? "Loading player pool…" : "Search name or MLB team…"
                    }
                    value={playerQuery}
                    onChange={(e) => setPlayerQuery(e.target.value)}
                    disabled={saving || playersLoading}
                  />
                )}
                {!selectedPlayer && playerQuery.trim() && (
                  <div className="rounded-md border border-border bg-card max-h-48 overflow-y-auto shadow-sm">
                    {filteredPlayers.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-3 py-2">No matches.</p>
                    ) : (
                      filteredPlayers.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/80 border-b border-border/60 last:border-0"
                          onClick={() => {
                            setSelectedPlayer(p);
                            setPlayerQuery("");
                          }}
                        >
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground font-mono text-xs ml-2">
                            {p.mlbTeam}
                          </span>
                          <span className="ml-2">
                            {p.positions.map((pos) => (
                              <Badge key={pos} variant="outline" className="text-[10px] px-1 py-0">
                                {pos}
                              </Badge>
                            ))}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Winning bid ($)</label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  disabled={saving}
                />
              </div>

              <Button type="submit" className="w-full" disabled={saving || playersLoading}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving…
                  </>
                ) : (
                  "Add to history"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total spent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">${stats.total.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Picks</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{stats.count}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg price
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">
                  {stats.count ? Math.round(stats.total / stats.count) : "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          {Object.keys(stats.byTeam).length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Spend by team</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {Object.entries(stats.byTeam)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, spent]) => (
                    <Badge
                      key={name}
                      variant="outline"
                      className="text-xs font-normal py-1 px-2 border-primary/20"
                    >
                      {name}: <span className="font-semibold ml-1">${spent}</span>
                    </Badge>
                  ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle>Full log</CardTitle>
                <CardDescription className="mt-1">
                  Sort columns, search by player or team. Pick # and round update automatically.
                </CardDescription>
              </div>
              <Input
                placeholder="Filter…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="max-w-xs"
              />
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">
                      <button
                        type="button"
                        className="font-medium hover:text-primary inline-flex items-center"
                        onClick={() => toggleSort("pickNumber")}
                      >
                        # <SortIcon k="pickNumber" />
                      </button>
                    </TableHead>
                    <TableHead className="w-16">
                      <button
                        type="button"
                        className="font-medium hover:text-primary inline-flex items-center"
                        onClick={() => toggleSort("round")}
                      >
                        Rnd <SortIcon k="round" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="font-medium hover:text-primary inline-flex items-center"
                        onClick={() => toggleSort("teamName")}
                      >
                        Team <SortIcon k="teamName" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        className="font-medium hover:text-primary inline-flex items-center"
                        onClick={() => toggleSort("playerName")}
                      >
                        Player <SortIcon k="playerName" />
                      </button>
                    </TableHead>
                    <TableHead>Pos</TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        className="font-medium hover:text-primary inline-flex items-center ml-auto"
                        onClick={() => toggleSort("price")}
                      >
                        $ <SortIcon k="price" />
                      </button>
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      <button
                        type="button"
                        className="font-medium hover:text-primary inline-flex items-center"
                        onClick={() => toggleSort("createdAt")}
                      >
                        When <SortIcon k="createdAt" />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPicks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                        {picks.length === 0
                          ? "No picks yet — record your first auction above."
                          : "No rows match your filter."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPicks.map((row) => (
                      <TableRow key={row._id ?? `${row.pickNumber}-${row.playerId}`}>
                        <TableCell className="font-mono font-medium">{row.pickNumber}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">{row.round}</TableCell>
                        <TableCell className="font-medium">{row.teamName}</TableCell>
                        <TableCell>
                          <Link
                            href={`/players/${row.playerId}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {row.playerName}
                          </Link>
                          <span className="text-muted-foreground font-mono text-xs ml-2">
                            {row.mlbTeam}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-0.5">
                            {row.positions?.map((pos) => (
                              <Badge
                                key={pos}
                                variant="outline"
                                className="text-[10px] px-1 py-0"
                              >
                                {pos}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          ${row.price}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm font-mono">
                          {formatWhen(row.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator className="opacity-50" />
      <p className="text-xs text-muted-foreground text-center">
        Draft history is saved to your account. Undo removes only the latest pick — use League
        Settings if you need to change league size or budget.
      </p>
    </div>
  );
}
