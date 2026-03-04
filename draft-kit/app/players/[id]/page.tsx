"use client";

import { use } from "react";
import Link from "next/link";
import { mockPlayers } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, AlertTriangle, TrendingUp } from "lucide-react";

const riskColors: Record<string, string> = {
  low: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  high: "bg-red-100 text-red-800 border-red-200",
};

const mockValuation = {
  estimatedDollarValue: 0,
  valuationLabel: "fair" as "overpay" | "fair" | "underpay",
  explanation:
    "Strong track record with elite contact rate and positional scarcity at this tier.",
  lastUpdated: "2026-03-04",
};

const valuationColors = {
  overpay: "bg-red-50 border-red-200 text-red-800",
  fair: "bg-green-50 border-green-200 text-green-800",
  underpay: "bg-blue-50 border-blue-200 text-blue-800",
};

const valuationLabels = {
  overpay: "⚠ Overpay Risk",
  fair: "✓ Fair Value",
  underpay: "↓ Potential Underpay",
};

export default function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const player = mockPlayers.find((p) => p.id === id);

  if (!player) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/players">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Players
          </Link>
        </Button>
        <p className="text-muted-foreground">Player not found.</p>
      </div>
    );
  }

  const valuation = {
    ...mockValuation,
    estimatedDollarValue: player.estimatedValue,
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/players">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Players
        </Link>
      </Button>

      {/* Player Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{player.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-muted-foreground font-mono font-medium">
              {player.mlbTeam}
            </span>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex gap-1">
              {player.positions.map((pos) => (
                <Badge key={pos} variant="outline" className="text-xs">
                  {pos}
                </Badge>
              ))}
            </div>
            <Separator orientation="vertical" className="h-4" />
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full border ${riskColors[player.riskLevel]}`}
            >
              {player.riskLevel} risk
            </span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Valuation Card — the core MVP interaction */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-primary">
            <TrendingUp className="h-5 w-5" />
            Valuation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2">
            <span className="text-5xl font-bold text-primary">
              ${valuation.estimatedDollarValue}
            </span>
            <span className="text-muted-foreground mb-1">
              estimated auction value
            </span>
          </div>
          <div
            className={`text-sm font-medium px-3 py-2 rounded-md border ${valuationColors[valuation.valuationLabel]}`}
          >
            {valuationLabels[valuation.valuationLabel]}
          </div>
          <p className="text-sm text-muted-foreground">
            {valuation.explanation}
          </p>
          <p className="text-xs text-muted-foreground">
            Last updated: {valuation.lastUpdated}
          </p>
        </CardContent>
      </Card>

      {/* Risk Warning */}
      {player.riskLevel === "high" && (
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
              <p className="font-medium mt-0.5">{player.mlbTeam}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Depth Status</p>
              <p className="font-medium mt-0.5 capitalize">
                {player.depthStatus}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Positions</p>
              <p className="font-medium mt-0.5">
                {player.positions.join(", ")}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Eligibility</p>
              <p
                className={`font-medium mt-0.5 ${player.isEligible ? "text-green-600" : "text-red-600"}`}
              >
                {player.isEligible ? "Eligible" : "Ineligible"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
