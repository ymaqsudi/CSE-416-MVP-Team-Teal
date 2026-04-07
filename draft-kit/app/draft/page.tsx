import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { mockPlayers } from "@/lib/mock-data";

const mockDraftState = {
  currentNominator: "Team Rocket",
  round: 3,
  pick: 7,
  nominatedPlayer: mockPlayers[0],
  currentBid: 22,
  leadingBidder: "Team Rocket",
};

const mockRecentPicks = [
  { player: mockPlayers[12], team: "Team Alpha", price: 55 },
  { player: mockPlayers[2], team: "Team Bravo", price: 41 },
  { player: mockPlayers[11], team: "Team Charlie", price: 38 },
];

export default function DraftPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Live Draft</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Round {mockDraftState.round} · Pick {mockDraftState.pick}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/draft-history">Draft history</Link>
          </Button>
          <Badge className="bg-green-100 text-green-800 border-green-200 border">
            Draft In Progress
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — current nomination */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-muted-foreground font-normal">
                Now Nominating —{" "}
                <span className="text-foreground font-semibold">
                  {mockDraftState.currentNominator}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {mockDraftState.nominatedPlayer.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-muted-foreground font-mono text-sm">
                      {mockDraftState.nominatedPlayer.mlbTeam}
                    </span>
                    {mockDraftState.nominatedPlayer.positions.map((pos) => (
                      <Badge key={pos} variant="outline" className="text-xs">
                        {pos}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Est. Value</p>
                  <p className="text-2xl font-bold text-primary">
                    {/* ${mockDraftState.nominatedPlayer.estimatedValue} */}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Current Bid</p>
                  <p className="text-3xl font-bold text-foreground">
                    ${mockDraftState.currentBid}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Leading: {mockDraftState.leadingBidder}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Your bid"
                    className="w-28"
                  />
                  <Button>Bid</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Picks */}
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">
              Recent Picks
            </h2>
            <div className="rounded-md border border-border overflow-hidden">
              {mockRecentPicks.map((pick, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-4 py-3 text-sm ${
                    i % 2 === 0 ? "bg-background" : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{pick.player.name}</span>
                    <span className="text-muted-foreground font-mono text-xs">
                      {pick.player.mlbTeam}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">{pick.team}</span>
                    <span className="font-bold text-primary">
                      ${pick.price}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — my status */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">My Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Remaining Budget</span>
                <span className="font-bold text-primary">$191</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Roster Slots Left</span>
                <span className="font-bold">12</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Bid</span>
                <span className="font-bold text-primary">$180</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">My Turn?</span>
                <Badge className="bg-green-100 text-green-800 border border-green-200">
                  Not yet
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
