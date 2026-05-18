"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Player, Valuation, HitterStats, PitcherStats, HitterSavantStats, PitcherSavantStats } from "@/lib/shared/types";
import { getEligibleSlots } from "@/lib/shared/eligibility";
import { apiClient } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, AlertTriangle, TrendingUp, Loader2 } from "lucide-react";

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

export default function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const isCustomPlayer = id.startsWith("custom_");
  const customPlayerId = isCustomPlayer ? id.replace(/^custom_/, "") : "";

  const [player, setPlayer] = useState<Player | null>(null);
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assignment dialog state
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<string>("");
  const [teamName, setTeamName] = useState<string>("");
  const [position, setPosition] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [activeLeagueId, setActiveLeagueId] = useState<string>("");
  const [playerNote, setPlayerNote] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteMessage, setNoteMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
  
        if (isCustomPlayer) {
          const token = localStorage.getItem("draftkit_token");
          const leagueId = localStorage.getItem("draftkit_leagueId");
  
          if (!token || !leagueId) {
            setError("Missing active league or login session.");
            return;
          }
  
          const response = await fetch(
            `/api/leagues/${leagueId}/custom-players/${customPlayerId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );
  
          const data = await response.json();
  
          if (!response.ok) {
            setError(data.error || "Failed to load player.");
            return;
          }
  
          setPlayer(data.player);
          setValuation(null);
          return;
        }
  
        const [playerRes, valuationRes] = await Promise.all([
          apiClient.getPlayer(id),
          apiClient.getValuation(id),
        ]);
  
        setPlayer(playerRes.player);
        setValuation(valuationRes.valuation);
      } catch (e) {
        setError("Failed to load player. Please try again.");
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
  
    fetchData();
  }, [id, isCustomPlayer, customPlayerId]);

  useEffect(() => {
    async function fetchLeagues() {
      if (!showAssignDialog) return;

      try {
        const token = localStorage.getItem("draftkit_token");
        if (!token) return;

        const response = await fetch("/api/leagues", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();
        if (response.ok) {
          setLeagues(data.leagues || []);
        }
      } catch (e) {
        console.error("Failed to load leagues:", e);
      }
    }
    fetchLeagues();
  }, [showAssignDialog]);

  useEffect(() => {
    const storedLeagueId = localStorage.getItem("draftkit_leagueId");
    if (storedLeagueId) {
      setActiveLeagueId(storedLeagueId);
    }
  }, []);

  useEffect(() => {
    async function fetchPlayerNote() {
      if (!activeLeagueId || !id) return;
  
      const token = localStorage.getItem("draftkit_token");
      if (!token) return;
  
      try {
        setNoteLoading(true);
        setNoteMessage(null);
  
        const response = await fetch(
          `/api/leagues/${activeLeagueId}/player-notes/${id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
  
        const data = await response.json();
  
        if (!response.ok) {
          setNoteMessage(data.error || "Failed to load player note.");
          return;
        }
  
        setPlayerNote(data.note ?? "");
      } catch (e) {
        console.error("Failed to load player note:", e);
        setNoteMessage("Failed to load player note.");
      } finally {
        setNoteLoading(false);
      }
    }
  
    fetchPlayerNote();
  }, [activeLeagueId, id]);

  async function handleAssignPlayer() {
    if (!player || !selectedLeague || !teamName.trim() || !position || !price) {
      setAssignError("All fields are required");
      return;
    }

    const token = localStorage.getItem("draftkit_token");
    if (!token) {
      setAssignError("You must be logged in");
      return;
    }

    try {
      setAssignLoading(true);
      setAssignError(null);

      const response = await fetch(`/api/players/${id}/assignment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          leagueId: selectedLeague,
          teamName: teamName.trim(),
          position,
          price: Number(price),
          playerName: player.name,
          mlbTeam: player.mlbTeam,
          positions: player.positions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAssignError(data.error || "Failed to assign player");
        return;
      }

      // Success - close dialog and reset form
      const assignedTeam = teamName.trim();
      setShowAssignDialog(false);
      setSelectedLeague("");
      setTeamName("");
      setPosition("");
      setPrice("");
      alert(
        `Player assigned to ${assignedTeam} as a keeper. They will be hidden from the live draft search and their salary counts against the team's budget.`,
      );
    } catch (e) {
      setAssignError("Something went wrong. Please try again.");
      console.error(e);
    } finally {
      setAssignLoading(false);
    }
  }

  async function handleSavePlayerNote() {
    if (!player || !activeLeagueId) {
      setNoteMessage("No active league selected.");
      return;
    }
  
    const token = localStorage.getItem("draftkit_token");
    if (!token) {
      setNoteMessage("You must be logged in.");
      return;
    }
  
    try {
      setNoteSaving(true);
      setNoteMessage(null);
  
      const response = await fetch(
        `/api/leagues/${activeLeagueId}/player-notes/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            playerName: player.name,
            note: playerNote,
          }),
        },
      );
  
      const data = await response.json();
  
      if (!response.ok) {
        setNoteMessage(data.error || "Failed to save player note.");
        return;
      }
  
      setNoteMessage("Player note saved.");
    } catch (e) {
      console.error("Failed to save player note:", e);
      setNoteMessage("Failed to save player note.");
    } finally {
      setNoteSaving(false);
    }
  }
  
  async function handleDeletePlayerNote() {
    if (!activeLeagueId) {
      setNoteMessage("No active league selected.");
      return;
    }
  
    const token = localStorage.getItem("draftkit_token");
    if (!token) {
      setNoteMessage("You must be logged in.");
      return;
    }
  
    try {
      setNoteSaving(true);
      setNoteMessage(null);
  
      const response = await fetch(
        `/api/leagues/${activeLeagueId}/player-notes/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
  
      const data = await response.json();
  
      if (!response.ok) {
        setNoteMessage(data.error || "Failed to delete player note.");
        return;
      }
  
      setPlayerNote("");
      setNoteMessage("Player note deleted.");
    } catch (e) {
      console.error("Failed to delete player note:", e);
      setNoteMessage("Failed to delete player note.");
    } finally {
      setNoteSaving(false);
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/players">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Players
          </Link>
        </Button>
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error ?? "Player not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/players">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Players
        </Link>
      </Button>

      {/* Player Header */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold text-foreground">{player.name}</h1>

          {isCustomPlayer ? (
            <Badge variant="outline" className="text-xs">
              Custom
            </Badge>
          ) : null}

          {player.age != null && (
            <span className="text-lg text-muted-foreground font-medium">
              Age {player.age}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-muted-foreground font-mono font-medium">
            {player.mlbTeam ?? "—"}
          </span>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex gap-1 flex-wrap">
            {player.positions.map((pos) => (
              <Badge key={pos} variant="outline" className="text-xs">
                {pos}
              </Badge>
            ))}
          </div>
          {player.risk && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full border ${riskColors[player.risk]}`}
              >
                {player.risk} risk
              </span>
            </>
          )}
          {player.injuryStatus && player.injuryStatus !== "Active" && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full border ${injuryColors[player.injuryStatus] ?? ""}`}
              >
                {player.injuryStatus}
              </span>
            </>
          )}
        </div>
        {player.injuryStatus && player.injuryStatus !== "Active" && (player.injuryNote || player.injuryReturn) && (
          <div className="mt-2 text-sm text-muted-foreground">
            {player.injuryNote && <span>{player.injuryNote}</span>}
            {player.injuryNote && player.injuryReturn && <span className="mx-1">·</span>}
            {player.injuryReturn && (
              <span>Est. return {new Date(player.injuryReturn).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* Valuation Card */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-primary">
            <TrendingUp className="h-5 w-5" />
            Valuation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isCustomPlayer ? (
            <p className="text-sm text-muted-foreground">
              Custom players do not have Player API valuations, but can still be used
              for notes, drafting, and roster management.
            </p>
          ) : valuation ? (
            <>
              <div className="flex items-end gap-2">
                <span className="text-5xl font-bold text-primary">
                  ${valuation.dollarValue}
                </span>
                <span className="text-muted-foreground mb-1">
                  estimated auction value
                </span>
              </div>
              {valuation.explanation && (
                <p className="text-sm text-muted-foreground">
                  {valuation.explanation}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Last updated:{" "}
                {new Date(valuation.updatedAt).toLocaleDateString()}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Valuation not available.
            </p>
          )}
        </CardContent>
      </Card>
      

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Player Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!activeLeagueId ? (
            <p className="text-sm text-muted-foreground">
              Select an active league to save player notes.
            </p>
          ) : noteLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading note...
            </div>
          ) : (
            <>
              <textarea
                placeholder="Write notes for this player in the current league..."
                value={playerNote}
                onChange={(e) => setPlayerNote(e.target.value)}
                rows={5}
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />

              {noteMessage && (
                <p className="text-sm text-muted-foreground">{noteMessage}</p>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleSavePlayerNote}
                  disabled={noteSaving || !activeLeagueId}
                >
                  {noteSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Note"
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleDeletePlayerNote}
                  disabled={noteSaving || !activeLeagueId || !playerNote.trim()}
                >
                  Delete Note
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Assign to Roster Button */}
      <div className="flex justify-center">
        <Button
          onClick={() => setShowAssignDialog(true)}
          className="w-full max-w-sm"
          size="lg"
        >
          Assign to Roster
        </Button>
      </div>

      {/* Risk Warning */}
      {player.risk === "High" && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="flex items-start gap-3 pt-4">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-800">Risk Flag</p>
              <p className="text-sm text-yellow-700 mt-1">
                This player has been flagged for elevated risk. Consider injury
                history, role volatility, or recent performance trends before
                bidding.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Player Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Player Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">MLB Team</p>
              <p className="font-medium mt-0.5">{player.mlbTeam ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Depth Role</p>
              <p className="font-medium mt-0.5">{player.depthRole ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Positions</p>
              <p className="font-medium mt-0.5">
                {player.positions.join(", ")}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Bats / Throws</p>
              <p className="font-medium mt-0.5">
                {player.bats ?? "—"} / {player.throws ?? "—"}
              </p>
            </div>
            {player.age != null && (
              <div>
                <p className="text-muted-foreground">Age</p>
                <p className="font-medium mt-0.5">{player.age}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2025 Stats */}
      {(() => {
        const hitterPrev = player.hitterPrevStats ?? (!player.positions.includes("P") ? (player.prevStats as HitterStats | undefined) : undefined);
        const pitcherPrev = player.pitcherPrevStats ?? (player.positions.includes("P") ? (player.prevStats as PitcherStats | undefined) : undefined);
        if (!hitterPrev && !pitcherPrev) return null;
        const hitterRows = hitterPrev
          ? [
              { label: "G", value: hitterPrev.games },
              { label: "HR", value: hitterPrev.hr },
              { label: "RBI", value: hitterPrev.rbi },
              { label: "R", value: hitterPrev.r },
              { label: "SB", value: hitterPrev.sb },
              { label: "AVG", value: hitterPrev.avg?.toFixed(3) },
            ]
          : [];
        const pitcherRows = pitcherPrev
          ? [
              { label: "W", value: pitcherPrev.w },
              { label: "ERA", value: pitcherPrev.era?.toFixed(2) },
              { label: "WHIP", value: pitcherPrev.whip?.toFixed(2) },
              { label: "K", value: pitcherPrev.k },
              { label: "SV", value: pitcherPrev.sv },
              { label: "IP", value: pitcherPrev.ip },
            ]
          : [];
        const showHeaders = hitterPrev && pitcherPrev;
        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">2025 Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hitterPrev && (
                <div>
                  {showHeaders && <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Hitting</p>}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    {hitterRows.map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-muted-foreground">{label}</p>
                        <p className="font-medium mt-0.5">{value ?? "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {pitcherPrev && (
                <div>
                  {showHeaders && <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Pitching</p>}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    {pitcherRows.map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-muted-foreground">{label}</p>
                        <p className="font-medium mt-0.5">{value ?? "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Baseball Savant (Statcast) */}
      {(() => {
        const hitterSavant = player.hitterSavantStats ?? (!player.positions.includes("P") ? (player.savantStats as HitterSavantStats | undefined) : undefined);
        const pitcherSavant = player.pitcherSavantStats ?? (player.positions.includes("P") ? (player.savantStats as PitcherSavantStats | undefined) : undefined);
        if (!hitterSavant && !pitcherSavant) return null;
        const pct = (v: number | undefined) => (v != null ? `${(v * 100).toFixed(1)}%` : undefined);
        const hitterRows = hitterSavant
          ? [
              { label: "xBA", value: hitterSavant.xba?.toFixed(3) },
              { label: "xSLG", value: hitterSavant.xslg?.toFixed(3) },
              { label: "xwOBA", value: hitterSavant.xwoba?.toFixed(3) },
              { label: "Barrel%", value: pct(hitterSavant.barrelPct) },
              { label: "Hard-Hit%", value: pct(hitterSavant.hardHitPct) },
              { label: "Exit Velo", value: hitterSavant.exitVelo?.toFixed(1) },
              { label: "K%", value: pct(hitterSavant.kPct) },
              { label: "BB%", value: pct(hitterSavant.bbPct) },
              { label: "Sprint Speed", value: hitterSavant.sprintSpeed?.toFixed(1) },
            ]
          : [];
        const pitcherRows = pitcherSavant
          ? [
              { label: "xERA", value: pitcherSavant.xera?.toFixed(2) },
              { label: "Whiff%", value: pct(pitcherSavant.whiffPct) },
              { label: "K%", value: pct(pitcherSavant.kPct) },
              { label: "BB%", value: pct(pitcherSavant.bbPct) },
              { label: "Barrel%", value: pct(pitcherSavant.barrelPctAgainst) },
              { label: "Hard-Hit%", value: pct(pitcherSavant.hardHitPctAgainst) },
              { label: "Exit Velo", value: pitcherSavant.exitVeloAgainst?.toFixed(1) },
            ]
          : [];
        const showHeaders = hitterSavant && pitcherSavant;
        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Baseball Savant (Statcast)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hitterSavant && (
                <div>
                  {showHeaders && <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Hitting</p>}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    {hitterRows.map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-muted-foreground">{label}</p>
                        <p className="font-medium mt-0.5">{value ?? "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {pitcherSavant && (
                <div>
                  {showHeaders && <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Pitching</p>}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    {pitcherRows.map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-muted-foreground">{label}</p>
                        <p className="font-medium mt-0.5">{value ?? "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* 2026 Projections */}
      {(() => {
        const hitterProj = player.hitterProjStats ?? (!player.positions.includes("P") ? (player.projStats as HitterStats | undefined) : undefined);
        const pitcherProj = player.pitcherProjStats ?? (player.positions.includes("P") ? (player.projStats as PitcherStats | undefined) : undefined);
        if (!hitterProj && !pitcherProj) return null;
        const hitterRows = hitterProj
          ? [
              { label: "HR", value: hitterProj.hr },
              { label: "RBI", value: hitterProj.rbi },
              { label: "R", value: hitterProj.r },
              { label: "SB", value: hitterProj.sb },
              { label: "AVG", value: hitterProj.avg?.toFixed(3) },
            ]
          : [];
        const pitcherRows = pitcherProj
          ? [
              { label: "W", value: pitcherProj.w },
              { label: "ERA", value: pitcherProj.era?.toFixed(2) },
              { label: "WHIP", value: pitcherProj.whip?.toFixed(2) },
              { label: "K", value: pitcherProj.k },
              { label: "SV", value: pitcherProj.sv },
              { label: "IP", value: pitcherProj.ip },
            ]
          : [];
        const showHeaders = hitterProj && pitcherProj;
        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">2026 Projections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hitterProj && (
                <div>
                  {showHeaders && <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Hitting</p>}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    {hitterRows.map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-muted-foreground">{label}</p>
                        <p className="font-medium mt-0.5">{value ?? "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {pitcherProj && (
                <div>
                  {showHeaders && <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Pitching</p>}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    {pitcherRows.map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-muted-foreground">{label}</p>
                        <p className="font-medium mt-0.5">{value ?? "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Assignment Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Player to Roster</DialogTitle>
            <DialogDescription>
              Assign {player?.name} to a roster position in one of your leagues.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="league">League</Label>
              <Select value={selectedLeague} onValueChange={setSelectedLeague}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a league" />
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

            <div>
              <Label htmlFor="team">Team Name</Label>
              <Input
                id="team"
                placeholder="Enter team name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="position">Position</Label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger>
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  {(player ? getEligibleSlots(player.positions) : ["C","1B","2B","3B","SS","OF","MI","CI","U","P","SP","RP","BN"]).map((slot) => (
                    <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="price">Price ($)</Label>
              <Input
                id="price"
                type="number"
                placeholder="Enter price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min="0"
              />
            </div>

            {assignError && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {assignError}
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowAssignDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssignPlayer}
                disabled={assignLoading}
                className="flex-1"
              >
                {assignLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  "Assign"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
