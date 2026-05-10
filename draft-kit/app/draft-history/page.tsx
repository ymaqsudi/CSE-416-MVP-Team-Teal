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
import { Loader2, History, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Team = { id: string; name: string };

type LeagueMeta = {
  _id: string;
  leagueName: string;
  teamCount: number;
  budget: number;
  mainRosterSlots?: number;
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

const ALL_POSITIONS = ["C", "1B", "2B", "3B", "SS", "OF", "MI", "CI", "U", "P"];

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("pickNumber");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editingPick, setEditingPick] = useState<DraftPickRow | null>(null);
  const [editTeamId, setEditTeamId] = useState<string>("");
  const [editPrice, setEditPrice] = useState<string>("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

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

  const positionOptions = useMemo(() => {
    const set = new Set<string>(ALL_POSITIONS);
    for (const p of picks) {
      for (const pos of p.positions ?? []) {
        if (pos) set.add(pos);
      }
    }
    return Array.from(set).sort();
  }, [picks]);

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
    if (teamFilter !== "all") {
      rows = rows.filter((p) =>
        p.teamId ? p.teamId === teamFilter : p.teamName === teamFilter,
      );
    }
    if (positionFilter !== "all") {
      rows = rows.filter((p) => (p.positions ?? []).includes(positionFilter));
    }
    const minNum = minPrice.trim() === "" ? null : Number(minPrice);
    const maxNum = maxPrice.trim() === "" ? null : Number(maxPrice);
    if (minNum !== null && !Number.isNaN(minNum)) {
      rows = rows.filter((p) => p.price >= minNum);
    }
    if (maxNum !== null && !Number.isNaN(maxNum)) {
      rows = rows.filter((p) => p.price <= maxNum);
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
  }, [picks, filter, teamFilter, positionFilter, minPrice, maxPrice, sortKey, sortDir]);

  const stats = useMemo(() => {
    const total = picks.reduce((s, p) => s + p.price, 0);
    const byTeam = picks.reduce<Record<string, number>>((acc, p) => {
      acc[p.teamName] = (acc[p.teamName] ?? 0) + p.price;
      return acc;
    }, {});
    return { total, byTeam, count: picks.length };
  }, [picks]);

  function openEdit(row: DraftPickRow) {
    setEditingPick(row);
    setEditTeamId(row.teamId ?? "");
    setEditPrice(String(row.price));
    setEditError(null);
  }

  async function saveEdit() {
    if (!token || !leagueId || !editingPick?._id) return;
    setEditSaving(true);
    setEditError(null);

    const body: { teamId?: string; price?: number } = {};
    if (editTeamId && editTeamId !== editingPick.teamId) body.teamId = editTeamId;
    const priceNum = Number(editPrice);
    if (!Number.isNaN(priceNum) && priceNum !== editingPick.price) {
      body.price = priceNum;
    }

    if (Object.keys(body).length === 0) {
      setEditingPick(null);
      setEditSaving(false);
      return;
    }

    try {
      const res = await fetch(
        `/api/leagues/${leagueId}/picks/${editingPick._id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditError((data as { error?: string }).error || "Failed to update pick.");
        return;
      }
      setEditingPick(null);
      await refreshHistory(token, leagueId);
    } catch {
      setEditError("Network error. Try again.");
    } finally {
      setEditSaving(false);
    }
  }

  const editMaxBid = useMemo(() => {
    if (!editingPick || !league || !editTeamId) return null;
    const slots = Number(league.mainRosterSlots) || 23;
    const teamPicks = picks.filter(
      (p) => p.teamId === editTeamId && p._id !== editingPick._id,
    );
    const count = teamPicks.length;
    if (count >= slots) return 0;
    const spent = teamPicks.reduce((s, p) => s + Number(p.price || 0), 0);
    const remaining = Math.max(slots - count, 1);
    return Math.max(Number(league.budget) - spent - (remaining - 1), 0);
  }, [editingPick, editTeamId, league, picks]);

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

  if (!token && !loading) {
    return (
      <div className="space-y-4 max-w-lg">
        <div className="flex items-center gap-2 text-primary">
          <History className="h-7 w-7" />
          <h1 className="text-2xl font-bold text-foreground">Draft History</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Log in to view picks for your league draft.
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
          Create a league first, then head to the live draft to record auction picks. They&apos;ll
          show up here in chronological order.
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
        <div className="space-y-3 lg:col-span-1">
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
          {Object.keys(stats.byTeam).length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Spent by team</CardTitle>
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
        </div>

        <Card className="lg:col-span-2">
          <CardHeader className="gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
            </div>
            <div className="flex flex-wrap items-end gap-2 pt-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Team</label>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                >
                  <option value="all">All teams</option>
                  {(league?.teams ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Position</label>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={positionFilter}
                  onChange={(e) => setPositionFilter(e.target.value)}
                >
                  <option value="all">All positions</option>
                  {positionOptions.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Min $</label>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-24"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Max $</label>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="∞"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-24"
                />
              </div>
              {(teamFilter !== "all" ||
                positionFilter !== "all" ||
                minPrice !== "" ||
                maxPrice !== "") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTeamFilter("all");
                    setPositionFilter("all");
                    setMinPrice("");
                    setMaxPrice("");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="max-h-[calc(100vh_-_24rem)] overflow-x-auto overflow-y-auto">
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
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPicks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      {picks.length === 0
                        ? "No picks yet — record auction picks on the live draft page."
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
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(row)}
                          aria-label="Edit pick"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!editingPick}
        onOpenChange={(o) => {
          if (!o) {
            setEditingPick(null);
            setEditError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit pick #{editingPick?.pickNumber}</DialogTitle>
            <DialogDescription>{editingPick?.playerName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-sm font-medium">Team</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={editTeamId}
              onChange={(e) => setEditTeamId(e.target.value)}
              disabled={editSaving}
            >
              {(league?.teams ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <label className="block text-sm font-medium">Price</label>
            <Input
              type="number"
              min={1}
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              disabled={editSaving}
            />
            {editMaxBid !== null ? (
              <p className="text-xs text-muted-foreground">
                Max allowed for this team: ${editMaxBid}
              </p>
            ) : null}
            {editError ? (
              <p className="text-sm text-red-700">{editError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingPick(null)}
              disabled={editSaving}
            >
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Separator className="opacity-50" />
      <p className="text-xs text-muted-foreground text-center">
        Draft history is saved to your account. Use the live draft page to record or undo picks.
      </p>
    </div>
  );
}
