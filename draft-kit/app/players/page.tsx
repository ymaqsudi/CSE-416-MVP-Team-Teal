"use client";

import { useState, useEffect, useMemo, useCallback } from "react";import Link from "next/link";
import { Player, Position } from "@/lib/shared/types";
import { apiClient } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { filterPlayersByScope, type LeagueScope } from "@/lib/shared/mlbLeagueMap";



type StatKey =
  | "hr"
  | "rbi"
  | "r"
  | "sb"
  | "avg"
  | "w"
  | "era"
  | "whip"
  | "k"
  | "sv"
  | "ip";

const STAT_OPTIONS: { key: StatKey; label: string; lowerIsBetter?: boolean }[] = [
  { key: "hr", label: "HR" },
  { key: "rbi", label: "RBI" },
  { key: "r", label: "R" },
  { key: "sb", label: "SB" },
  { key: "avg", label: "AVG" },
  { key: "w", label: "W" },
  { key: "era", label: "ERA", lowerIsBetter: true },
  { key: "whip", label: "WHIP", lowerIsBetter: true },
  { key: "k", label: "K" },
  { key: "sv", label: "SV" },
  { key: "ip", label: "IP" },
];

type SortKey = "name" | "team" | "age" | "value" | `stat:${StatKey}`;

const ALL_POSITIONS: Position[] = [
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "OF",
  "MI",
  "CI",
  "U",
  "P",
];

const riskColors: Record<string, string> = {
  Low: "bg-green-100 text-green-800 border-green-200",
  Med: "bg-yellow-100 text-yellow-800 border-yellow-200",
  High: "bg-red-100 text-red-800 border-red-200",
};

const injuryColors: Record<string, string> = {
  "Active": "bg-green-100 text-green-800 border-green-200",
  "Day-to-Day": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "10-Day IL": "bg-orange-100 text-orange-800 border-orange-200",
  "15-Day IL": "bg-orange-100 text-orange-800 border-orange-200",
  "60-Day IL": "bg-red-100 text-red-800 border-red-200",
  "Out for Season": "bg-red-100 text-red-800 border-red-200",
  "Suspended": "bg-gray-100 text-gray-800 border-gray-200",
};

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [valuations, setValuations] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<Position | "All">("All");
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [activeLeagueId, setActiveLeagueId] = useState<string>("");
  const [leagueScope, setLeagueScope] = useState<LeagueScope>("MLB");
  const [leagueCategories, setLeagueCategories] = useState<string[]>([]);
  const [customPlayers, setCustomPlayers] = useState<Player[]>([]);
  const [showAddPlayerDialog, setShowAddPlayerDialog] = useState(false);
  const [addPlayerLoading, setAddPlayerLoading] = useState(false);
  const [addPlayerError, setAddPlayerError] = useState<string | null>(null);

  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerTeam, setNewPlayerTeam] = useState("");
  const [newPlayerPositions, setNewPlayerPositions] = useState("");
  const [newPlayerBats, setNewPlayerBats] = useState("");
  const [newPlayerThrows, setNewPlayerThrows] = useState("");
  const [newPlayerDepthRole, setNewPlayerDepthRole] = useState("Unknown");
  const [newPlayerRisk, setNewPlayerRisk] = useState("");
  const [newPlayerAge, setNewPlayerAge] = useState("");

  useEffect(() => {
    async function fetchPlayers() {
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient.getPlayers();
        setPlayers(res.players);
      } catch (e) {
        setError("Failed to load players. Please try again.");
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchPlayers();
  }, []);

  useEffect(() => {
    async function fetchValuations() {
      try {
        const params = new URLSearchParams();
        if (leagueScope !== "MLB") params.set("mlbLeague", leagueScope);
        if (leagueCategories.length > 0) params.set("categories", leagueCategories.join(","));
        const qs = params.toString() ? `?${params.toString()}` : "";
        const res = await fetch(`/api/valuation/valuations/all${qs}`);
        if (!res.ok) return;
        const data = await res.json();
        const map: Record<string, number> = {};
        for (const v of data.valuations ?? []) {
          if (v.playerId != null) map[String(v.playerId)] = v.dollarValue;
        }
        setValuations(map);
      } catch (e) {
        console.error("Failed to load valuations:", e);
      }
    }
    fetchValuations();
  }, [leagueScope, leagueCategories]);

  useEffect(() => {
    const storedLeagueId = localStorage.getItem("draftkit_leagueId");
    if (storedLeagueId) {
      setActiveLeagueId(storedLeagueId);
    }
  }, []);

  useEffect(() => {
    async function loadLeagueScope() {
      const token = localStorage.getItem("draftkit_token");
      const leagueId = localStorage.getItem("draftkit_leagueId");
      if (!token) return;
      try {
        const res = await fetch("/api/leagues", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const league =
          (data.leagues ?? []).find((l: { _id: string }) => l._id === leagueId) ??
          data.leagues?.[0];
        if (league?.scope === "AL" || league?.scope === "NL" || league?.scope === "MLB") {
          setLeagueScope(league.scope);
        }
        if (Array.isArray(league?.categories)) {
          setLeagueCategories(league.categories);
        }
      } catch (e) {
        console.error("Failed to load league scope:", e);
      }
    }
    loadLeagueScope();
  }, []);

  const fetchCustomPlayers = useCallback(async () => {
    if (!activeLeagueId) {
      setCustomPlayers([]);
      return;
    }
  
    const token = localStorage.getItem("draftkit_token");
    if (!token) {
      setCustomPlayers([]);
      return;
    }
  
    try {
      const response = await fetch(`/api/leagues/${activeLeagueId}/custom-players`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        console.error("Failed to load custom players:", data.error);
        setCustomPlayers([]);
        return;
      }
  
      setCustomPlayers(data.players ?? []);
    } catch (e) {
      console.error("Failed to load custom players:", e);
      setCustomPlayers([]);
    }
  }, [activeLeagueId]);

  useEffect(() => {
    fetchCustomPlayers();
  }, [fetchCustomPlayers]);

  const allPlayers = useMemo(() => {
    return filterPlayersByScope([...customPlayers, ...players], leagueScope);
  }, [customPlayers, players, leagueScope]);
  
  const filtered = useMemo(() => {
    return allPlayers.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.mlbTeam ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesPosition =
        position === "All" || p.positions.includes(position);
      return matchesSearch && matchesPosition;
    });
  }, [allPlayers, search, position]);

  const activeStatKey: StatKey | null = sortKey.startsWith("stat:")
    ? (sortKey.slice(5) as StatKey)
    : null;

  const getStatValue = (p: Player, key: StatKey): number | undefined => {
    const proj = (p.projStats ?? {}) as Record<string, number | undefined>;
    const prev = (p.prevStats ?? {}) as Record<string, number | undefined>;
    return proj[key] ?? prev[key];
  };

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av: number | string | undefined;
      let bv: number | string | undefined;
      if (sortKey === "name") {
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
      } else if (sortKey === "team") {
        av = (a.mlbTeam ?? "").toLowerCase();
        bv = (b.mlbTeam ?? "").toLowerCase();
      } else if (sortKey === "age") {
        av = a.age;
        bv = b.age;
      } else if (sortKey === "value") {
        av = valuations[a.id];
        bv = valuations[b.id];
      } else if (activeStatKey) {
        av = getStatValue(a, activeStatKey);
        bv = getStatValue(b, activeStatKey);
      }
      const aMissing = av === undefined || av === null || (typeof av === "number" && Number.isNaN(av));
      const bMissing = bv === undefined || bv === null || (typeof bv === "number" && Number.isNaN(bv));
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir, valuations, activeStatKey]);

  const toggleSort = (key: SortKey, defaultDir: "asc" | "desc" = "desc") => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(defaultDir);
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="inline h-3.5 w-3.5 ml-1" />
    ) : (
      <ChevronDown className="inline h-3.5 w-3.5 ml-1" />
    );
  };

  const activeStatLabel = activeStatKey
    ? STAT_OPTIONS.find((s) => s.key === activeStatKey)?.label
    : null;

  async function handleAddPlayer() {
    if (!activeLeagueId) {
      setAddPlayerError("No active league selected.");
      return;
    }
  
    const token = localStorage.getItem("draftkit_token");
    if (!token) {
      setAddPlayerError("You must be logged in.");
      return;
    }
  
    const parsedPositions = newPlayerPositions
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  
    if (!newPlayerName.trim()) {
      setAddPlayerError("Player name is required.");
      return;
    }
  
    if (parsedPositions.length === 0) {
      setAddPlayerError("At least one position is required.");
      return;
    }
  
    try {
      setAddPlayerLoading(true);
      setAddPlayerError(null);
  
      const response = await fetch(`/api/leagues/${activeLeagueId}/custom-players`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newPlayerName,
          mlbTeam: newPlayerTeam,
          positions: parsedPositions,
          bats: newPlayerBats || undefined,
          throws: newPlayerThrows || undefined,
          depthRole: newPlayerDepthRole || "Unknown",
          risk: newPlayerRisk || undefined,
          age: newPlayerAge || undefined,
        }),
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        setAddPlayerError(data.error || "Failed to add player.");
        return;
      }
  
      setShowAddPlayerDialog(false);
      setNewPlayerName("");
      setNewPlayerTeam("");
      setNewPlayerPositions("");
      setNewPlayerBats("");
      setNewPlayerThrows("");
      setNewPlayerDepthRole("Unknown");
      setNewPlayerRisk("");
      setNewPlayerAge("");
  
      await fetchCustomPlayers();
    } catch (e) {
      console.error("Failed to add player:", e);
      setAddPlayerError("Failed to add player.");
    } finally {
      setAddPlayerLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">All Players</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Loading..." : `${filtered.length} players available`}
          </p>
        </div>

        <Dialog open={showAddPlayerDialog} onOpenChange={setShowAddPlayerDialog}>
          <DialogTrigger asChild>
            <Button disabled={!activeLeagueId}>Add Player</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Custom Player</DialogTitle>
              <DialogDescription>
                Add a manual player for the current active league. Custom players do
                not need API valuations, but can still be used for drafting, notes,
                and roster management.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-player-name">Player Name</Label>
                <Input
                  id="new-player-name"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="Enter player name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-player-team">MLB Team</Label>
                <Input
                  id="new-player-team"
                  value={newPlayerTeam}
                  onChange={(e) => setNewPlayerTeam(e.target.value)}
                  placeholder="Optional team abbreviation"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-player-positions">Positions</Label>
                <Input
                  id="new-player-positions"
                  value={newPlayerPositions}
                  onChange={(e) => setNewPlayerPositions(e.target.value)}
                  placeholder="Comma-separated, e.g. OF,1B or P"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="new-player-bats">Bats</Label>
                  <Input
                    id="new-player-bats"
                    value={newPlayerBats}
                    onChange={(e) => setNewPlayerBats(e.target.value)}
                    placeholder="R, L, or S"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-player-throws">Throws</Label>
                  <Input
                    id="new-player-throws"
                    value={newPlayerThrows}
                    onChange={(e) => setNewPlayerThrows(e.target.value)}
                    placeholder="R or L"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="new-player-depth-role">Depth Role</Label>
                  <Input
                    id="new-player-depth-role"
                    value={newPlayerDepthRole}
                    onChange={(e) => setNewPlayerDepthRole(e.target.value)}
                    placeholder="Starter, Backup, Unknown..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-player-risk">Risk</Label>
                  <Input
                    id="new-player-risk"
                    value={newPlayerRisk}
                    onChange={(e) => setNewPlayerRisk(e.target.value)}
                    placeholder="Low, Med, High"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-player-age">Age</Label>
                <Input
                  id="new-player-age"
                  type="number"
                  value={newPlayerAge}
                  onChange={(e) => setNewPlayerAge(e.target.value)}
                  placeholder="Optional age"
                />
              </div>

              {addPlayerError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {addPlayerError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowAddPlayerDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddPlayer}
                  disabled={addPlayerLoading || !activeLeagueId}
                  className="flex-1"
                >
                  {addPlayerLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Player"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by name or team..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
          disabled={loading}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="min-w-32" disabled={loading}>
              {position === "All" ? "All Positions" : position}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setPosition("All")}>
              All Positions
            </DropdownMenuItem>
            {ALL_POSITIONS.map((pos) => (
              <DropdownMenuItem key={pos} onClick={() => setPosition(pos)}>
                {pos}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="min-w-40" disabled={loading}>
              {activeStatLabel ? `Sort by ${activeStatLabel}` : "Sort by Stat"}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {STAT_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.key}
                onClick={() => {
                  setSortKey(`stat:${opt.key}`);
                  setSortDir(opt.lowerIsBetter ? "asc" : "desc");
                }}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead
                className="font-semibold cursor-pointer select-none"
                onClick={() => toggleSort("name", "asc")}
              >
                Player{sortIndicator("name")}
              </TableHead>
              <TableHead
                className="font-semibold cursor-pointer select-none"
                onClick={() => toggleSort("team", "asc")}
              >
                Team{sortIndicator("team")}
              </TableHead>
              <TableHead className="font-semibold">Position(s)</TableHead>
              <TableHead
                className="font-semibold cursor-pointer select-none"
                onClick={() => toggleSort("age", "asc")}
              >
                Age{sortIndicator("age")}
              </TableHead>
              <TableHead
                className="font-semibold cursor-pointer select-none"
                onClick={() => toggleSort("value", "desc")}
              >
                $ Value{sortIndicator("value")}
              </TableHead>
              {activeStatKey && (
                <TableHead
                  className="font-semibold cursor-pointer select-none"
                  onClick={() =>
                    toggleSort(
                      `stat:${activeStatKey}`,
                      STAT_OPTIONS.find((s) => s.key === activeStatKey)?.lowerIsBetter
                        ? "asc"
                        : "desc",
                    )
                  }
                >
                  {activeStatLabel}
                  {sortIndicator(`stat:${activeStatKey}`)}
                </TableHead>
              )}
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Risk</TableHead>
              <TableHead className="font-semibold">Depth Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={activeStatKey ? 9 : 8} className="text-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={activeStatKey ? 9 : 8}
                  className="text-center text-muted-foreground py-12"
                >
                  No players found.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((player: Player) => (
                <TableRow
                  key={player.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/players/${player.id}`}
                        className="font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {player.name}
                      </Link>

                      {"isCustom" in player && player.isCustom ? (
                        <Badge variant="outline" className="text-[10px]">
                          Custom
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>

                  <TableCell className="text-muted-foreground font-mono text-sm">
                    {player.mlbTeam ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {player.positions.map((pos) => (
                        <Badge key={pos} variant="outline" className="text-xs">
                          {pos}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {player.age ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {valuations[player.id] !== undefined
                      ? `$${valuations[player.id]}`
                      : "—"}
                  </TableCell>
                  {activeStatKey && (
                    <TableCell className="font-mono text-sm">
                      {(() => {
                        const v = getStatValue(player, activeStatKey);
                        if (v === undefined || v === null) return "—";
                        return activeStatKey === "avg" ||
                          activeStatKey === "era" ||
                          activeStatKey === "whip"
                          ? v.toFixed(3)
                          : v;
                      })()}
                    </TableCell>
                  )}
                  <TableCell>
                    {player.injuryStatus ? (
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full border ${injuryColors[player.injuryStatus] ?? ""}`}
                      >
                        {player.injuryStatus}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {player.risk ? (
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full border ${riskColors[player.risk]}`}
                      >
                        {player.risk}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {player.depthRole ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
