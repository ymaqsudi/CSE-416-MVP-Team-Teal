"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Player, Valuation } from "@/lib/shared/types";
import { apiClient } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, AlertTriangle, TrendingUp, Loader2 } from "lucide-react";

const riskColors: Record<string, string> = {
  Low: "bg-green-100 text-green-800 border-green-200",
  Med: "bg-yellow-100 text-yellow-800 border-yellow-200",
  High: "bg-red-100 text-red-800 border-red-200",
};

export default function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [player, setPlayer] = useState<Player | null>(null);
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
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
  }, [id]);

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
        <h1 className="text-3xl font-bold text-foreground">{player.name}</h1>
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
        </div>
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
          {valuation ? (
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
